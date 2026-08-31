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
import {
  applyDesignLayoutToCanvas,
  buildDesignLayoutSystemPrompt,
  flattenStudioTextForDesign,
  parseDesignLayoutJson,
} from '@/lib/studio/design-layout-ai';

/**
 * POST /api/studio/documents/[id]/design-layout
 * Body: { prompt?: string, locale?: string }
 * Gera diagramação (modo design) a partir do texto + brand kit.
 */
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> | { id: string } },
) {
  try {
    const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const params = await Promise.resolve(ctx.params);
  const id = params.id;
  const doc = await prisma.studioDocument.findUnique({ where: { id } });
  if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const access = await getDocumentAccess(user.id, doc);
  if (!canEditStudioContent(access)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    prompt?: string;
    locale?: string;
  };
  const prompt = String(body.prompt || '').trim();
  const locale = body.locale === 'en' || body.locale === 'es' ? body.locale : 'pt';

  const canvas = normalizeStudioCanvas(doc.canvasState);
  const sourceText = flattenStudioTextForDesign(canvas);
  if (!sourceText.trim()) {
    return NextResponse.json(
      {
        error:
          locale === 'es'
            ? 'No hay texto en el documento para diagramar. Escribe primero en Redacción.'
            : locale === 'en'
              ? 'No text to layout. Write content in Write mode first.'
              : 'Não há texto no documento para diagramar. Escreve primeiro em Redação.',
      },
      { status: 400 },
    );
  }

  const brand = await getStudioBrandKit(doc.companyId);
  const system = buildDesignLayoutSystemPrompt({
    locale,
    brand,
    styleBrief: prompt || 'Diagramação moderna, limpa, institucional, estilo Gamma/Canva.',
    sourceText,
  });

  let raw: string;
  try {
    const { text, finishReason } = await llmGenerateContent({
      systemInstruction: system,
      userText:
        prompt ||
        (locale === 'es'
          ? 'Diagramá este documento con el brand kit y un estilo visual moderno.'
          : locale === 'en'
            ? 'Lay out this document using the brand kit and a modern visual style.'
            : 'Diagramá este documento com o brand kit e um estilo visual moderno.'),
      maxOutputTokens: 8192,
      temperature: 0.4,
      responseMimeType: 'application/json',
    });
    if (finishReason === 'MAX_TOKENS') {
      return NextResponse.json(
        { error: 'Resposta da IA cortada — tenta um brief mais curto.' },
        { status: 502 },
      );
    }
    raw = text;
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'LLM error' },
      { status: 502 },
    );
  }

  const parsed = parseDesignLayoutJson(raw);
  if (!parsed) {
    return NextResponse.json(
      {
        error: 'A IA não devolveu um layout válido. Tenta de novo com um brief mais claro.',
        rawPreview: raw.slice(0, 400),
      },
      { status: 422 },
    );
  }

  const nextCanvas = applyDesignLayoutToCanvas(canvas, parsed);
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
    summary: `Diagramação IA: ${truncatePreview(parsed.message || prompt || 'layout')}`,
    actorUserId: user.id,
    meta: { designLayout: true, pageCount: nextCanvas.pages.length },
  });

  return NextResponse.json({
    message: parsed.message,
    canvasState: nextCanvas,
    document: { id: updated.id, updatedAt: updated.updatedAt },
  });
  } catch (e: unknown) {
    console.error('[studio design-layout]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Erro interno ao diagramar.' },
      { status: 500 },
    );
  }
}
