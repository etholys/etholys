export const dynamic = 'force-dynamic';
export const maxDuration = 120;

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { llmGenerateContent } from '@/lib/llm-client';
import { getStudioBrandKit } from '@/lib/studio/brand';
import { recordStudioActivity, truncatePreview } from '@/lib/studio/activity';
import { canEditStudioContent, getDocumentAccess } from '@/lib/studio/share';
import { normalizeStudioCanvas } from '@/lib/studio/types';
import { flattenStudioTextForDesign } from '@/lib/studio/design-layout-ai';
import { generateStudioImage } from '@/lib/studio/image-gen';
import {
  applyDesignGenerateToCanvas,
  buildDesignGenerateSystemPrompt,
  parseDesignGenerateJson,
  requiresSourceText,
  type StudioDesignGenerateMode,
} from '@/lib/studio/design-media-ai';

const MODES = new Set<StudioDesignGenerateMode>(['layout', 'magic', 'deck', 'images', 'video']);

/**
 * POST /api/studio/documents/[id]/design-generate
 * Body: { mode, prompt?, locale?, generateImages?: boolean }
 */
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> | { id: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const params = await Promise.resolve(ctx.params);
  const doc = await prisma.studioDocument.findUnique({ where: { id: params.id } });
  if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const access = await getDocumentAccess(user.id, doc);
  if (!canEditStudioContent(access)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    mode?: string;
    prompt?: string;
    locale?: string;
    generateImages?: boolean;
  };
  const mode = (MODES.has(body.mode as StudioDesignGenerateMode)
    ? body.mode
    : 'layout') as StudioDesignGenerateMode;
  const prompt = String(body.prompt || '').trim();
  const locale = body.locale === 'en' || body.locale === 'es' ? body.locale : 'pt';
  const generateImages = body.generateImages !== false;

  const canvas = normalizeStudioCanvas(doc.canvasState);
  const sourceText = flattenStudioTextForDesign(canvas);

  if (requiresSourceText(mode) && !sourceText.trim()) {
    return NextResponse.json(
      {
        error:
          locale === 'es'
            ? 'Escribe contenido en Redacción primero, o usa Magic Design / Deck.'
            : locale === 'en'
              ? 'Write content in Write mode first, or use Magic Design / Deck.'
              : 'Escreve conteúdo em Redação primeiro, ou usa Magic Design / Deck.',
      },
      { status: 400 },
    );
  }

  if (!prompt && mode !== 'layout') {
    return NextResponse.json(
      { error: locale === 'es' ? 'Describe qué quieres crear.' : 'Descreve o que queres criar.' },
      { status: 400 },
    );
  }

  const brand = await getStudioBrandKit(doc.companyId);
  const system = buildDesignGenerateSystemPrompt({ mode, locale, prompt, brand, canvas });

  let raw: string;
  try {
    const { text, finishReason } = await llmGenerateContent({
      systemInstruction: system,
      userText: prompt || 'Diagrama com estilo profissional.',
      maxOutputTokens: 8192,
      temperature: mode === 'magic' || mode === 'deck' ? 0.55 : 0.4,
      responseMimeType: 'application/json',
    });
    if (finishReason === 'MAX_TOKENS') {
      return NextResponse.json({ error: 'Resposta cortada — brief mais curto.' }, { status: 502 });
    }
    raw = text;
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'LLM error' }, { status: 502 });
  }

  const parsed = parseDesignGenerateJson(raw);
  if (!parsed) {
    return NextResponse.json(
      { error: 'Layout inválido da IA.', rawPreview: raw.slice(0, 400) },
      { status: 422 },
    );
  }

  let nextCanvas = applyDesignGenerateToCanvas(canvas, parsed);

  if (generateImages && (mode === 'images' || mode === 'video' || mode === 'magic')) {
    nextCanvas = await fillImageBlocks(nextCanvas, brand, mode);
  }

  const updated = await prisma.studioDocument.update({
    where: { id: doc.id },
    data: {
      canvasState: nextCanvas,
      updatedById: user.id,
      format: nextCanvas.format,
    },
  });

  await recordStudioActivity({
    documentId: doc.id,
    companyId: doc.companyId,
    kind: 'ai_edit',
    summary: `Design IA (${mode}): ${truncatePreview(parsed.message || prompt)}`,
    actorUserId: user.id,
    meta: { designGenerate: mode, pageCount: nextCanvas.pages.length },
  });

  return NextResponse.json({
    message: parsed.message,
    mode,
    canvasState: nextCanvas,
    document: { id: updated.id, updatedAt: updated.updatedAt },
  });
}

async function fillImageBlocks(
  canvas: ReturnType<typeof normalizeStudioCanvas>,
  brand: Awaited<ReturnType<typeof getStudioBrandKit>>,
  mode: StudioDesignGenerateMode,
) {
  const pages = canvas.pages.map((p) => ({
    ...p,
    blocks: [...p.blocks],
  }));

  const aspect = mode === 'video' ? 'landscape' : mode === 'magic' ? 'square' : 'square';

  for (const page of pages) {
    for (let i = 0; i < page.blocks.length; i++) {
      const b = page.blocks[i]!;
      if (b.kind !== 'image' || b.imageUrl) continue;
      const imgPrompt = b.imagePrompt || b.text || b.title || 'Ilustração profissional';
      try {
        const result = await generateStudioImage({ prompt: imgPrompt, brand, aspect });
        if (result) {
          page.blocks[i] = { ...b, imageUrl: result.imageUrl, imagePrompt: imgPrompt };
        }
      } catch {
        /* keep placeholder */
      }
    }
  }

  return { ...canvas, pages };
}
