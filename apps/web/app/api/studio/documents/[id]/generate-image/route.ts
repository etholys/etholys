export const dynamic = 'force-dynamic';
export const maxDuration = 120;

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { getStudioBrandKit } from '@/lib/studio/brand';
import { recordStudioActivity, truncatePreview } from '@/lib/studio/activity';
import { canEditStudioContent, getDocumentAccess } from '@/lib/studio/share';
import { normalizeStudioCanvas } from '@/lib/studio/types';
import { generateStudioImage } from '@/lib/studio/image-gen';

/**
 * POST /api/studio/documents/[id]/generate-image
 * Body: { blockId, prompt?, aspect? }
 * Gera imagem (DALL·E / Flux / SVG fallback) para um bloco image.
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
    blockId?: string;
    prompt?: string;
    aspect?: 'square' | 'landscape' | 'portrait';
  };
  const blockId = String(body.blockId || '').trim();
  if (!blockId) return NextResponse.json({ error: 'blockId required' }, { status: 400 });

  const canvas = normalizeStudioCanvas(doc.canvasState);
  let found: { prompt: string; aspect?: 'square' | 'landscape' | 'portrait' } | null = null;
  for (const p of canvas.pages) {
    const b = p.blocks.find((x) => x.id === blockId);
    if (!b || b.kind !== 'image') continue;
    found = {
      prompt:
        String(body.prompt || '').trim() ||
        b.imagePrompt ||
        b.text ||
        b.title ||
        'Ilustração profissional',
      aspect:
        body.aspect ||
        (b.mediaMeta?.type === 'video-scene' ? 'landscape' : 'square'),
    };
    break;
  }
  if (!found) return NextResponse.json({ error: 'Image block not found' }, { status: 404 });

  const brand = await getStudioBrandKit(doc.companyId);
  let imageUrl: string | null = null;
  let provider: string | null = null;
  try {
    const result = await generateStudioImage({
      prompt: found.prompt,
      brand,
      aspect: found.aspect,
    });
    if (result) {
      imageUrl = result.imageUrl;
      provider = result.provider;
    }
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Image error' }, { status: 502 });
  }

  if (!imageUrl) {
    return NextResponse.json({ error: 'Não foi possível gerar a imagem.' }, { status: 422 });
  }

  const nextPages = canvas.pages.map((p) => ({
    ...p,
    blocks: p.blocks.map((b) =>
      b.id === blockId ? { ...b, imageUrl, imagePrompt: found!.prompt } : b,
    ),
  }));
  const nextCanvas = { ...canvas, pages: nextPages };

  await prisma.studioDocument.update({
    where: { id: doc.id },
    data: { canvasState: nextCanvas, updatedById: user.id },
  });

  await recordStudioActivity({
    documentId: doc.id,
    companyId: doc.companyId,
    kind: 'ai_edit',
    summary: `Imagem IA (${provider || '?'}): ${truncatePreview(found.prompt)}`,
    actorUserId: user.id,
    meta: { generateImage: blockId, provider },
  });

  return NextResponse.json({ imageUrl, provider, canvasState: nextCanvas });
}
