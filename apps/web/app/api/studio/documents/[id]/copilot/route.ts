import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { llmGenerateContent } from '@/lib/llm-client';
import {
  loadApprovedStudioContext,
  resolveStudioCompanyId,
  studioCatalogForCompany,
} from '@/lib/studio/access';
import { recordStudioActivity, truncatePreview } from '@/lib/studio/activity';
import { buildStudioSystemPrompt, parseStudioCopilotJson } from '@/lib/studio/agent';
import { buildStudioCopilotUserText } from '@/lib/studio/copilot-history';
import {
  actionAssistantMessage,
  actionUserMessage,
  buildStudioCopilotModeAddendum,
  inferStudioCopilotMode,
  normalizeStudioCopilotAction,
  normalizeStudioCopilotMode,
  pendingStructureActions,
} from '@/lib/studio/copilot-modes';
import {
  loadStudioCopilotSession,
  saveStudioCopilotSession,
} from '@/lib/studio/copilot-session';
import {
  buildStructureApprovalPatches,
  buildStructureApprovalSystemAddendum,
  buildStructureDevelopPatches,
  buildStudioStructureState,
  findStructureProposalMessage,
  isStructureApprovalMessage,
  isStructureDevelopRequest,
  isStructureProposalContent,
  readStudioStructureState,
  structureApplySuccessMessage,
} from '@/lib/studio/structure-apply';
import {
  buildStructureMigrationPatches,
  canvasWarrantsStructureMigration,
} from '@/lib/studio/structure-migrate';
import { shouldTrustClientStudioCanvas } from '@/lib/studio/document-scope';
import {
  applyStudioCanvasPatches,
  normalizeStudioCanvas,
  sanitizeStudioCanvasPatches,
  type StudioCanvasState,
} from '@/lib/studio/types';
import { prismaHasEnumValue } from '@/lib/prisma-has-field';
import {
  buildStudioContextLlmParts,
  loadStudioUserContextText,
} from '@/lib/studio/context-assets';
import { canEditStudioContent, getDocumentAccess } from '@/lib/studio/share';
import { loadDocumentLinksContext } from '@/lib/document-links';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

function actorLabel(u: { name: string | null; email: string }) {
  return u.name?.trim() || u.email;
}

/** POST /api/studio/documents/[id]/copilot */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const locale = typeof body.locale === 'string' ? body.locale : 'pt';

  const action = normalizeStudioCopilotAction(body.action);
  const requestedMode = normalizeStudioCopilotMode(body.mode);
  let message = typeof body.message === 'string' ? body.message.trim() : '';
  if (!message && action) message = actionUserMessage(action, locale);
  if (!message) return NextResponse.json({ error: 'Message required' }, { status: 400 });

  const doc = await prisma.studioDocument.findFirst({
    where: { id: params.id },
  });
  if (!doc) return NextResponse.json({ error: 'Document not found' }, { status: 404 });

  const access = await getDocumentAccess(user.id, doc);
  if (!canEditStudioContent(access)) {
    return NextResponse.json({ error: 'Sem permissão para editar' }, { status: 403 });
  }
  const effectiveCompanyId = doc.companyId;

  if (typeof body.documentId === 'string' && body.documentId !== doc.id) {
    return NextResponse.json({ error: 'Document mismatch' }, { status: 400 });
  }

  const approvedSources = Array.isArray(body.approvedSources)
    ? body.approvedSources.filter((s): s is string => typeof s === 'string')
    : [];
  const attachmentIds = Array.isArray(body.attachmentIds)
    ? body.attachmentIds.filter((s): s is string => typeof s === 'string')
    : [];
  const targetBlockIds = Array.isArray(body.targetBlockIds)
    ? body.targetBlockIds.filter((s): s is string => typeof s === 'string').slice(0, 40)
    : typeof body.targetBlockId === 'string' && body.targetBlockId
      ? [body.targetBlockId]
      : [];

  let canvas = normalizeStudioCanvas(doc.canvasState) as StudioCanvasState;
  if (body.canvasState && typeof body.canvasState === 'object') {
    const clientDirty = body.clientDirty === true;
    const clientRevision =
      typeof body.clientRevision === 'string' ? body.clientRevision : null;
    if (
      shouldTrustClientStudioCanvas(clientDirty, clientRevision, doc.updatedAt)
    ) {
      canvas = body.canvasState as StudioCanvasState;
    }
  }

  let aiSessionId = doc.aiSessionId;
  if (!aiSessionId) {
    const kind = prismaHasEnumValue('AiAdvisorSessionKind', 'STUDIO_DOC')
      ? 'STUDIO_DOC'
      : 'WORKSPACE_ADVISOR';
    const sess = await prisma.aiAdvisorSession.create({
      data: {
        companyId: effectiveCompanyId,
        userId: user.id,
        title: `Studio: ${doc.title}`.slice(0, 120),
        kind: kind as 'STUDIO_DOC' | 'WORKSPACE_ADVISOR',
      },
    });
    aiSessionId = sess.id;
    await prisma.studioDocument.update({
      where: { id: doc.id },
      data: { aiSessionId },
    });
  }

  const who = actorLabel(user);

  const priorMessages = aiSessionId
    ? await prisma.aiAdvisorMessage.findMany({
        where: { sessionId: aiSessionId },
        orderBy: { createdAt: 'asc' },
        take: 40,
        select: { role: true, content: true, context: true },
      })
    : [];

  const sessionMirror = aiSessionId ? await loadStudioCopilotSession(prisma, aiSessionId) : null;
  const structureStateBefore =
    sessionMirror?.structureState || readStudioStructureState(priorMessages);

  let proposalText =
    structureStateBefore?.proposalText ||
    findStructureProposalMessage(priorMessages)?.content ||
    null;

  let effectiveMode = inferStudioCopilotMode({
    requested:
      action === 'adjust_plan' || action === 'cancel_plan'
        ? 'discuss'
        : action === 'apply_structure' || action === 'migrate_structure'
          ? 'apply'
          : requestedMode,
    targetBlockIds,
    structureStatus: structureStateBefore?.status,
  });

  if (targetBlockIds.length) effectiveMode = 'edit_selection';

  let structureApproval =
    isStructureApprovalMessage(message) || action === 'approve_structure';
  let structureDevelop =
    isStructureDevelopRequest(message) ||
    action === 'apply_structure' ||
    action === 'migrate_structure';
  const structureMigrate = action === 'migrate_structure';
  let useDeterministicStructureApply =
    !targetBlockIds.length &&
    !!proposalText &&
    (structureApproval || structureDevelop || action === 'apply_structure' || structureMigrate);
  let useDeterministicStructureMigrate =
    !targetBlockIds.length && !!proposalText && structureMigrate;
  let skipLlm = false;

  if (action === 'approve_structure' && proposalText) {
    skipLlm = true;
    structureApproval = true;
    useDeterministicStructureApply = false;
  }
  if (action === 'apply_structure' && proposalText) {
    skipLlm = true;
    structureDevelop = true;
    useDeterministicStructureApply = true;
    useDeterministicStructureMigrate = false;
    effectiveMode = 'apply';
  }
  if (action === 'migrate_structure' && proposalText) {
    skipLlm = true;
    structureDevelop = true;
    useDeterministicStructureApply = false;
    useDeterministicStructureMigrate = true;
    effectiveMode = 'apply';
  }
  if (action === 'adjust_plan') {
    skipLlm = true;
    effectiveMode = 'discuss';
  }
  if (action === 'cancel_plan') {
    skipLlm = true;
    proposalText = null;
    effectiveMode = 'discuss';
  }

  const applyMode: 'apply' | 'develop' | 'migrate' =
    action === 'migrate_structure' || useDeterministicStructureMigrate
      ? 'migrate'
      : structureDevelop ||
          action === 'apply_structure' ||
          structureStateBefore?.status === 'approved'
        ? 'develop'
        : 'apply';

  await prisma.aiAdvisorMessage.create({
    data: {
      sessionId: aiSessionId,
      role: 'user',
      content: message,
      context: {
        approvedSources,
        attachmentIds,
        targetBlockIds,
        documentId: doc.id,
        userId: user.id,
        userName: user.name,
        userEmail: user.email,
        copilotMode: effectiveMode,
        copilotAction: action,
      },
    },
  });

  await recordStudioActivity({
    documentId: doc.id,
    companyId: effectiveCompanyId,
    kind: 'ai_prompt',
    summary: `${who} falou com a IA: «${truncatePreview(message)}»`,
    actorUserId: user.id,
    meta: {
      messagePreview: truncatePreview(message, 240),
      attachmentCount: attachmentIds.length,
      approvedSources,
    },
  });

  const [approvedContext, userUploadedContext, linkContext, multimodalParts] = await Promise.all([
    loadApprovedStudioContext(effectiveCompanyId, approvedSources),
    loadStudioUserContextText({
      companyId: effectiveCompanyId,
      folderId: doc.folderId,
      documentId: doc.id,
      extraAssetIds: attachmentIds,
    }),
    loadDocumentLinksContext({
      targetType: 'studio',
      studioDocumentId: doc.id,
    }),
    buildStudioContextLlmParts(attachmentIds, effectiveCompanyId),
  ]);

  const mergedUserContext = [userUploadedContext, linkContext].filter(Boolean).join('\n\n');

  const scopedUserText =
    targetBlockIds.length > 0
      ? `[Âmbito de edição — só estes blockId: ${targetBlockIds.join(', ')}]\n\n${message}`
      : message;

  let system = buildStudioSystemPrompt({
    locale,
    documentTitle: doc.title,
    canvas,
    catalog: studioCatalogForCompany(),
    approvedContext: approvedContext || null,
    userUploadedContext: mergedUserContext || null,
    targetBlockIds: targetBlockIds.length ? targetBlockIds : null,
  });

  system += `\n\n${buildStudioCopilotModeAddendum(effectiveMode, locale)}`;

  if (
    proposalText &&
    (structureApproval || structureDevelop) &&
    !useDeterministicStructureApply &&
    !useDeterministicStructureMigrate
  ) {
    system += `\n\n${buildStructureApprovalSystemAddendum(proposalText, locale, applyMode)}`;
  }

  let raw = '';
  let payload = { message: 'Pronto.', canvasPatches: [] as ReturnType<typeof parseStudioCopilotJson>['canvasPatches'], consentRequest: null as ReturnType<typeof parseStudioCopilotJson>['consentRequest'], suggestedTitle: undefined as string | undefined };

  if ((useDeterministicStructureApply || useDeterministicStructureMigrate) && proposalText) {
    payload = {
      message: structureApplySuccessMessage(locale, 0, applyMode),
      canvasPatches: [],
      consentRequest: null,
      suggestedTitle: undefined,
    };
  } else if (skipLlm && action) {
    payload = {
      message: actionAssistantMessage(action, locale),
      canvasPatches: [],
      consentRequest: null,
      suggestedTitle: undefined,
    };
  } else if (skipLlm) {
    payload = {
      message: 'Pronto.',
      canvasPatches: [],
      consentRequest: null,
      suggestedTitle: undefined,
    };
  } else {
    try {
      const llmOpts = multimodalParts.length
        ? {
            systemInstruction: system,
            userParts: [
              {
                text: buildStudioCopilotUserText(
                  priorMessages.map((m) => ({ role: m.role, content: m.content })),
                  scopedUserText,
                  locale,
                ),
              },
              ...multimodalParts,
            ],
            maxOutputTokens: 8000,
            temperature: 0.1,
            responseMimeType: 'application/json' as const,
          }
        : {
            systemInstruction: system,
            chatMessages: [
              ...priorMessages.map((m) => ({
                role: m.role as 'user' | 'assistant',
                content: m.content,
              })),
              { role: 'user' as const, content: scopedUserText },
            ],
            maxOutputTokens: 8000,
            temperature: 0.1,
            responseMimeType: 'application/json' as const,
          };

      const { text, finishReason } = await llmGenerateContent(llmOpts);
      if (finishReason === 'MAX_TOKENS') {
        return NextResponse.json(
          { error: 'LLM truncated', detail: 'Resposta cortada — tente um pedido mais curto.' },
          { status: 502 },
        );
      }
      raw = text;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      return NextResponse.json({ error: 'LLM failed', detail: msg }, { status: 502 });
    }

    payload = parseStudioCopilotJson(raw);
  }

  let patches = payload.canvasPatches || [];

  if (useDeterministicStructureMigrate && proposalText) {
    patches = buildStructureMigrationPatches(canvas, proposalText);
  } else if (useDeterministicStructureApply && proposalText) {
    patches = buildStructureDevelopPatches(canvas, proposalText);
  } else if (action === 'apply_structure' && proposalText) {
    patches = buildStructureDevelopPatches(canvas, proposalText);
  } else if (action === 'migrate_structure' && proposalText) {
    patches = buildStructureMigrationPatches(canvas, proposalText);
  } else if (
    (structureApproval || structureDevelop || effectiveMode === 'apply') &&
    proposalText &&
    !patches.length
  ) {
    patches = buildStructureDevelopPatches(canvas, proposalText);
  } else if (structureApproval && proposalText && !patches.length) {
    patches = buildStructureApprovalPatches(canvas, proposalText);
  }

  if (
    (effectiveMode === 'discuss' || effectiveMode === 'propose') &&
    !useDeterministicStructureApply &&
    action !== 'apply_structure' &&
    action !== 'migrate_structure'
  ) {
    patches = [];
  }

  const sanitized = sanitizeStudioCanvasPatches(canvas, patches, {
    targetBlockIds,
    allowApprovedRestructure:
      structureApproval ||
      structureDevelop ||
      useDeterministicStructureApply ||
      useDeterministicStructureMigrate,
  });
  const safePatches = sanitized.patches;
  const nextCanvas = applyStudioCanvasPatches(canvas, safePatches);
  const patchCount = safePatches.length;

  let assistantMessage = payload.message || 'Pronto.';
  if (
    (useDeterministicStructureApply || useDeterministicStructureMigrate) &&
    patchCount > 0
  ) {
    assistantMessage = structureApplySuccessMessage(locale, patchCount, applyMode);
  } else if ((structureApproval || structureDevelop) && patchCount > 0 && !payload.canvasPatches?.length) {
    assistantMessage = structureApplySuccessMessage(locale, patchCount, applyMode);
  }

  let studioStructureState = structureStateBefore;
  if (action === 'cancel_plan') {
    studioStructureState = null;
  } else if (proposalText) {
    if ((useDeterministicStructureApply || useDeterministicStructureMigrate) && patchCount > 0) {
      studioStructureState = buildStudioStructureState(proposalText, 'applied');
    } else if (structureApproval || action === 'approve_structure') {
      studioStructureState = buildStudioStructureState(proposalText, 'approved');
    } else if (isStructureProposalContent(assistantMessage)) {
      studioStructureState = buildStudioStructureState(assistantMessage, 'pending_approval');
    }
  }

  const nextCopilotSession = {
    mode:
      action === 'adjust_plan' || action === 'cancel_plan'
        ? 'discuss'
        : patchCount > 0 && effectiveMode === 'apply'
          ? 'discuss'
          : effectiveMode,
    structureState: studioStructureState,
  } as const;

  try {
    await saveStudioCopilotSession(prisma, aiSessionId, nextCopilotSession);
  } catch (e) {
    console.warn('[studio] copilot session save skipped', e);
  }
  if (sanitized.blockedFullRewrite) {
    assistantMessage +=
      locale === 'es'
        ? '\n\n⚠️ Bloqueé una reescritura completa del documento. Selecciona la sección (bloque) a ajustar e inténtalo de nuevo.'
        : locale === 'en'
          ? '\n\n⚠️ Blocked a full-document rewrite. Select the section (block) to adjust and try again.'
          : '\n\n⚠️ Bloqueei uma reescrita completa do documento. Seleciona a secção (bloco) a ajustar e tenta de novo.';
  } else if (sanitized.dropped > 0 && targetBlockIds.length) {
    assistantMessage +=
      locale === 'es'
        ? `\n\n(Se ignoraron ${sanitized.dropped} cambio(s) fuera del ámbito seleccionado.)`
        : locale === 'en'
          ? `\n\n(Ignored ${sanitized.dropped} change(s) outside the selected scope.)`
          : `\n\n(Ignorei ${sanitized.dropped} alteração(ões) fora do âmbito selecionado.)`;
  }

  const titleUpdate =
    !targetBlockIds.length &&
    payload.suggestedTitle &&
    payload.suggestedTitle.length > 2
      ? payload.suggestedTitle.slice(0, 200)
      : undefined;

  // Snapshot before AI edit when patches apply
  if (patchCount > 0) {
    try {
      await prisma.studioDocumentVersion.create({
        data: {
          documentId: doc.id,
          title: doc.title,
          canvasState: canvas as object,
          label: 'Antes da edição IA',
          createdById: user.id,
        },
      });
    } catch (e) {
      console.warn('[studio] ai version snapshot skipped', e);
    }
  }

  await prisma.studioDocument.update({
    where: { id: doc.id },
    data: {
      canvasState: nextCanvas,
      ...(titleUpdate ? { title: titleUpdate } : {}),
    },
  });
  try {
    await prisma.studioDocument.update({
      where: { id: doc.id },
      data: { updatedById: user.id },
    });
  } catch {
    /* updatedById ainda não migrado */
  }

  await prisma.aiAdvisorMessage.create({
    data: {
      sessionId: aiSessionId,
      role: 'assistant',
      content: assistantMessage,
      context: {
        canvasPatches: safePatches,
        consentRequest: payload.consentRequest,
        suggestedTitle: payload.suggestedTitle,
        triggeredByUserId: user.id,
        triggeredByName: user.name,
        triggeredByEmail: user.email,
        patchCount,
        targetBlockIds,
        droppedPatches: sanitized.dropped,
        blockedFullRewrite: sanitized.blockedFullRewrite,
        ...(studioStructureState ? { studioStructureState } : {}),
        deterministicStructureApply: useDeterministicStructureApply,
      },
    },
  });

  await recordStudioActivity({
    documentId: doc.id,
    companyId: effectiveCompanyId,
    kind: 'ai_response',
    summary: `IA respondeu a ${who}: «${truncatePreview(assistantMessage)}»`,
    actorUserId: user.id,
    meta: {
      messagePreview: truncatePreview(assistantMessage, 240),
      patchCount,
      suggestedTitle: titleUpdate || null,
      targetBlockIds,
    },
  });

  if (patchCount > 0) {
    await recordStudioActivity({
      documentId: doc.id,
      companyId: effectiveCompanyId,
      kind: 'ai_edit',
      summary: `IA alterou o documento (${patchCount} bloco${patchCount === 1 ? '' : 's'}) a pedido de ${who}`,
      actorUserId: user.id,
      meta: {
        patchCount,
        blockIds: safePatches.map((p) => p.blockId).slice(0, 40),
        targetBlockIds,
      },
    });
  }

  return NextResponse.json({
    message: assistantMessage,
    canvasState: nextCanvas,
    consentRequest: payload.consentRequest ?? null,
    suggestedTitle: titleUpdate ?? null,
    aiSessionId,
    title: titleUpdate ?? doc.title,
    copilotSession: {
      mode: nextCopilotSession.mode,
      structureState: studioStructureState,
      pendingActions: pendingStructureActions(studioStructureState, {
        canMigrate: canvasWarrantsStructureMigration(nextCanvas),
      }),
    },
    patchedBlockIds: safePatches.map((p) => p.blockId),
    patchCount,
  });
}

/** GET messages for studio document session */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  const companyId = await resolveStudioCompanyId(
    user.id,
    req.nextUrl.searchParams.get('companyId'),
  );

  const doc = await prisma.studioDocument.findFirst({
    where: companyId ? { id: params.id, companyId } : { id: params.id },
    select: {
      id: true,
      companyId: true,
      createdById: true,
      folderId: true,
      visibility: true,
      aiSessionId: true,
      canvasState: true,
    },
  });
  if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const access = await getDocumentAccess(user.id, doc);
  if (access === 'none') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  if (!doc.aiSessionId) {
    return NextResponse.json({
      messages: [],
      copilotSession: { mode: 'discuss', structureState: null, pendingActions: [] },
    });
  }

  const sessionMirror = await loadStudioCopilotSession(prisma, doc.aiSessionId);
  const messages = await prisma.aiAdvisorMessage.findMany({
    where: { sessionId: doc.aiSessionId },
    orderBy: { createdAt: 'asc' },
    take: 100,
    select: { id: true, role: true, content: true, context: true, createdAt: true },
  });

  const enriched = messages.map((m) => {
    const ctx = (m.context && typeof m.context === 'object' ? m.context : {}) as Record<
      string,
      unknown
    >;
    const actorName =
      (typeof ctx.userName === 'string' && ctx.userName) ||
      (typeof ctx.triggeredByName === 'string' && ctx.triggeredByName) ||
      null;
    const actorEmail =
      (typeof ctx.userEmail === 'string' && ctx.userEmail) ||
      (typeof ctx.triggeredByEmail === 'string' && ctx.triggeredByEmail) ||
      null;
    const actorUserId =
      (typeof ctx.userId === 'string' && ctx.userId) ||
      (typeof ctx.triggeredByUserId === 'string' && ctx.triggeredByUserId) ||
      null;
    return {
      ...m,
      actor: actorUserId || actorName || actorEmail
        ? {
            id: actorUserId,
            name: actorName,
            email: actorEmail,
          }
        : null,
    };
  });

  const structureState =
    sessionMirror?.structureState ||
    readStudioStructureState(
      messages.map((m) => ({
        role: m.role,
        content: m.content,
        context: m.context,
      })),
    );

  const canvas = normalizeStudioCanvas(doc.canvasState);
  const canMigrate = canvasWarrantsStructureMigration(canvas);

  return NextResponse.json({
    messages: enriched,
    copilotSession: {
      mode: sessionMirror?.mode || 'discuss',
      structureState,
      pendingActions: pendingStructureActions(structureState, { canMigrate }),
    },
  });
}
