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

  const doc = await prisma.studioDocument.findFirst({
    where: { id: params.id },
  });
  if (!doc) return NextResponse.json({ error: 'Document not found' }, { status: 404 });

  const access = await getDocumentAccess(user.id, doc);
  if (!canEditStudioContent(access)) {
    return NextResponse.json({ error: 'Sem permissão para editar' }, { status: 403 });
  }
  const effectiveCompanyId = doc.companyId;

  const message = typeof body.message === 'string' ? body.message.trim() : '';
  if (!message) return NextResponse.json({ error: 'Message required' }, { status: 400 });

  if (typeof body.documentId === 'string' && body.documentId !== doc.id) {
    return NextResponse.json({ error: 'Document mismatch' }, { status: 400 });
  }

  const locale = typeof body.locale === 'string' ? body.locale : 'pt';
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

  const system = buildStudioSystemPrompt({
    locale,
    documentTitle: doc.title,
    canvas,
    catalog: studioCatalogForCompany(),
    approvedContext: approvedContext || null,
    userUploadedContext: mergedUserContext || null,
    targetBlockIds: targetBlockIds.length ? targetBlockIds : null,
  });

  const scopedUserText =
    targetBlockIds.length > 0
      ? `[Âmbito de edição — só estes blockId: ${targetBlockIds.join(', ')}]\n\n${message}`
      : message;

  let raw: string;
  try {
    const { text, finishReason } = await llmGenerateContent({
      systemInstruction: system,
      userText: multimodalParts.length ? undefined : scopedUserText,
      userParts: multimodalParts.length
        ? [{ text: scopedUserText }, ...multimodalParts]
        : undefined,
      maxOutputTokens: 8000,
      temperature: 0.1,
      responseMimeType: 'application/json',
    });
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

  const payload = parseStudioCopilotJson(raw);
  const sanitized = sanitizeStudioCanvasPatches(canvas, payload.canvasPatches || [], {
    targetBlockIds,
  });
  const safePatches = sanitized.patches;
  const nextCanvas = applyStudioCanvasPatches(canvas, safePatches);
  const patchCount = safePatches.length;

  let assistantMessage = payload.message || 'Pronto.';
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
    select: { id: true, companyId: true, createdById: true, folderId: true, visibility: true, aiSessionId: true },
  });
  if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const access = await getDocumentAccess(user.id, doc);
  if (access === 'none') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  if (!doc.aiSessionId) return NextResponse.json({ messages: [] });

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

  return NextResponse.json({ messages: enriched });
}
