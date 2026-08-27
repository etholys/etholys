import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  enrichPptxSlidesWithImages,
  extractStudioPptxSlides,
  studioCanvasToPptxBuffer,
} from '@/lib/studio/pptx-export';
import type { StudioCanvasState } from '@/lib/studio/types';
import { emptyStudioCanvas } from '@/lib/studio/types';

/** 1×1 PNG transparente (base64). */
const TINY_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

describe('extractStudioPptxSlides', () => {
  it('maps pages to title + bullets + speaker notes', () => {
    const canvas: StudioCanvasState = {
      ...emptyStudioCanvas('presentation'),
      pages: [
        {
          id: 'p1',
          title: 'Slide 1',
          order: 0,
          blocks: [
            { id: 'b1', kind: 'heading', text: 'Título principal', order: 0 },
            { id: 'b2', kind: 'bullets', text: '- Item A\n- Item B', order: 1 },
            {
              id: 'b3',
              kind: 'image',
              text: 'Frame',
              order: 2,
              mediaMeta: { type: 'video-scene', durationSec: 8, narration: 'Locução plano 1' },
            },
          ],
        },
      ],
    };
    const slides = extractStudioPptxSlides(canvas);
    assert.equal(slides.length, 1);
    assert.equal(slides[0]!.title, 'Título principal');
    assert.deepEqual(slides[0]!.bullets, ['Item A', 'Item B']);
    assert.match(slides[0]!.notes, /Locução plano 1/);
    assert.match(slides[0]!.notes, /8s/);
  });
});

describe('enrichPptxSlidesWithImages', () => {
  it('embeds data-url images from image blocks', async () => {
    const canvas: StudioCanvasState = {
      ...emptyStudioCanvas('presentation'),
      pages: [
        {
          id: 'p1',
          title: 'Slide 1',
          order: 0,
          layoutMode: 'blank',
          moldId: null,
          blocks: [
            { id: 'h', kind: 'heading', text: 'Com imagem', order: 0 },
            {
              id: 'img',
              kind: 'image',
              text: 'Hero',
              order: 1,
              imageUrl: TINY_PNG,
              layout: { xPct: 10, yPct: 20, wPct: 80, hPct: 50 },
            },
          ],
        },
      ],
    };
    const base = extractStudioPptxSlides(canvas);
    const enriched = await enrichPptxSlidesWithImages(canvas, base);
    assert.equal(enriched[0]!.images.length, 1);
    assert.equal(enriched[0]!.images[0]!.ext, 'png');
    assert.ok(enriched[0]!.images[0]!.buffer.length > 10);
  });
});

describe('studioCanvasToPptxBuffer', () => {
  it('produces a valid pptx zip buffer', async () => {
    const canvas = emptyStudioCanvas('presentation');
    canvas.pages[0]!.blocks = [
      { id: 'h', kind: 'heading', text: 'Hello', order: 0 },
      { id: 'p', kind: 'bullets', text: '- One\n- Two', order: 1 },
    ];
    const buf = await studioCanvasToPptxBuffer('Test deck', canvas);
    assert.ok(buf.length > 500);
    assert.equal(buf[0], 0x50); // PK zip header 'P'
    assert.equal(buf[1], 0x4b);
  });

  it('includes media folder when slide has image', async () => {
    const canvas = emptyStudioCanvas('presentation');
    canvas.pages[0]!.blocks = [
      { id: 'h', kind: 'heading', text: 'Visual', order: 0 },
      { id: 'img', kind: 'image', text: 'Pic', order: 1, imageUrl: TINY_PNG },
    ];
    const buf = await studioCanvasToPptxBuffer('Images', canvas);
    const JSZip = (await import('jszip')).default;
    const zip = await JSZip.loadAsync(buf);
    const media = Object.keys(zip.files).filter((k) => k.startsWith('ppt/media/'));
    assert.ok(media.length >= 1);
  });
});
