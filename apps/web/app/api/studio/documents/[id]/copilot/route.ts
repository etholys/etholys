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
import { buildStudioSystemPrompt, parseStudioCopilotJson } from '@/lib/studio/agent';
import {
  applyStudioCanvasPatches,
  type StudioCanvasState,
} from '@/lib/studio/types';
import { prismaHasEnumValue } from '@/lib/prisma-has-field';
import {
  buildStudioContextLlmParts,
  loadStudioUserContextText,
} from '@/lib/studio/context-assets';
import { canEditStudioContent, getDocumentAccess } from '@/lib/studio/share';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

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

  const locale = typeof body.locale === 'string' ? body.locale : 'pt';
  const approvedSources = Array.isArray(body.approvedSources)
    ? body.approvedSources.filter((s): s is string => typeof s === 'string')
    : [];
  const attachmentIds = Array.isArray(body.attachmentIds)
    ? body.attachmentIds.filter((s): s is string => typeof s === 'string')
    : [];

  let canvas = doc.canvasState as StudioCanvasState;
  if (body.canvasState && typeof body.canvasState === 'object') {
    canvas = body.canvasState as StudioCanvasState;
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

  await prisma.aiAdvisorMessage.create({
    data: {
      sessionId: aiSessionId,
      role: 'user',
      content: message,
      context: {
        approvedSources,
        attachmentIds,
        documentId: doc.id,
      },
    },
  });

  const [approvedContext, userUploadedContext, multimodalParts] = await Promise.all([
    loadApprovedStudioContext(effectiveCompanyId, approvedSources),
    loadStudioUserContextText({
      companyId: effectiveCompanyId,
      folderId: doc.folderId,
      documentId: doc.id,
      extraAssetIds: attachmentIds,
    }),
    buildStudioContextLlmParts(attachmentIds, effectiveCompanyId),
  ]);

  const system = buildStudioSystemPrompt({
    locale,
    documentTitle: doc.title,
    canvas,
    catalog: studioCatalogForCompany(),
    approvedContext: approvedContext || null,
    userUploadedContext: userUploadedContext || null,
  });

  let raw: string;
  try {
    const { text, finishReason } = await llmGenerateContent({
      systemInstruction: system,
      userText: multimodalParts.length ? undefined : message,
      userParts: multimodalParts.length
        ? [{ text: message }, ...multimodalParts]
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
  const nextCanvas = applyStudioCanvasPatches(canvas, payload.canvasPatches || []);

  const titleUpdate =
    payload.suggestedTitle && payload.suggestedTitle.length > 2
      ? payload.suggestedTitle.slice(0, 200)
      : undefined;

  await prisma.studioDocument.update({
    where: { id: doc.id },
    data: {
      canvasState: nextCanvas,
      ...(titleUpdate ? { title: titleUpdate } : {}),
    },
  });

  await prisma.aiAdvisorMessage.create({
    data: {
      sessionId: aiSessionId,
      role: 'assistant',
      content: payload.message,
      context: {
        canvasPatches: payload.canvasPatches,
        consentRequest: payload.consentRequest,
        suggestedTitle: payload.suggestedTitle,
      },
    },
  });

  return NextResponse.json({
    message: payload.message,
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

  return NextResponse.json({ messages });
}
