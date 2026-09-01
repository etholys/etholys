/**
 * One-off recovery: re-apply canvasPatches from 30/8/2026 22:01 IA edit.
 * Usage (on server with DATABASE_URL):
 *   cd apps/web && npx tsx scripts/restore-kumiai-patches.ts
 */
import { PrismaClient } from '@prisma/client';
import {
  applyStudioCanvasPatches,
  normalizeStudioCanvas,
  type StudioCanvasPatch,
  type StudioCanvasState,
} from '../lib/studio/types';

const DOC_ID = 'cmtf392qv0149qp3t9r2ut5k1';
const MSG_ID = 'cmtgpop0b0047lk3u56qq59o0';
const RECOVERED_VERSION_ID = 'recov11d3b86c73176a4a687';

function blockTexts(canvas: StudioCanvasState): string[] {
  return canvas.pages
    .slice()
    .sort((a, b) => a.order - b.order)
    .flatMap((p) =>
      p.blocks
        .slice()
        .sort((a, b) => a.order - b.order)
        .map((b) => String(b.text || '').slice(0, 40)),
    );
}

async function main() {
  const prisma = new PrismaClient();
  try {
    const doc = await prisma.studioDocument.findUnique({ where: { id: DOC_ID } });
    const msg = await prisma.aiAdvisorMessage.findUnique({ where: { id: MSG_ID } });
    if (!doc || !msg) throw new Error('Document or AI message not found');

    const ctx = (msg.context && typeof msg.context === 'object' ? msg.context : {}) as Record<
      string,
      unknown
    >;
    const raw = Array.isArray(ctx.canvasPatches) ? ctx.canvasPatches : [];
    const patches = raw
      .filter((p): p is StudioCanvasPatch => p && typeof p === 'object' && typeof (p as StudioCanvasPatch).blockId === 'string')
      .map((p) => ({
        blockId: p.blockId,
        // pageId omitido — blocos mudaram de página após reflow; match só por blockId
        text: typeof p.text === 'string' ? p.text : undefined,
        title: typeof p.title === 'string' ? p.title : undefined,
        kind: p.kind,
      }));

    if (patches.length !== 11) {
      console.warn(`Expected 11 patches, got ${patches.length}`);
    }

    const canvas = normalizeStudioCanvas(doc.canvasState);
    const next = applyStudioCanvasPatches(canvas, patches);

    const previews = blockTexts(next);
    const mustHave = ['4. Líneas de Producto', '6. Estructura de Ingresos', 'PARTE II'];
    for (const needle of mustHave) {
      const hay = previews.join(' | ');
      if (!hay.includes(needle.slice(0, 20))) {
        throw new Error(`Recovery validation failed: missing «${needle}»`);
      }
    }

    await prisma.studioDocument.update({
      where: { id: DOC_ID },
      data: { canvasState: next as object },
    });

    const ver = await prisma.studioDocumentVersion.findFirst({
      where: { id: RECOVERED_VERSION_ID, documentId: DOC_ID },
    });
    if (ver) {
      await prisma.studioDocumentVersion.update({
        where: { id: RECOVERED_VERSION_ID },
        data: { canvasState: next as object },
      });
    } else {
      await prisma.studioDocumentVersion.create({
        data: {
          id: RECOVERED_VERSION_ID,
          documentId: DOC_ID,
          title: doc.title,
          canvasState: next as object,
          label: 'Recuperado: 11 secciones (30/8 IA)',
        },
      });
    }

    console.log('OK — document restored from 11 patches');
    console.log('Block previews:', previews);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
