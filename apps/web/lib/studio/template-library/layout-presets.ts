import {
  DEFAULT_STUDIO_MARGINS_MM,
  type StudioBlock,
  type StudioCanvasState,
  type StudioFormat,
} from '@/lib/studio/types';

export type LayoutVariant = 'cover' | 'report' | 'slide' | 'social' | 'print' | 'photo' | 'video';

const PRESETS: Record<LayoutVariant, Array<{ x: number; y: number; w: number; scale?: StudioBlock['style'] }>> = {
  cover: [
    { x: 8, y: 22, w: 84, scale: { textScale: 'xl', align: 'center' } },
    { x: 14, y: 48, w: 72, scale: { textScale: 'md', align: 'center' } },
    { x: 10, y: 72, w: 80, scale: { frame: 'accent', align: 'center' } },
  ],
  report: [
    { x: 6, y: 6, w: 88, scale: { textScale: 'lg' } },
    { x: 6, y: 22, w: 55, scale: { frame: 'card' } },
    { x: 64, y: 22, w: 30, scale: { frame: 'subtle', textScale: 'sm' } },
    { x: 6, y: 52, w: 88, scale: {} },
    { x: 6, y: 68, w: 42, scale: { frame: 'subtle' } },
    { x: 52, y: 68, w: 42, scale: { frame: 'subtle' } },
    { x: 6, y: 82, w: 88, scale: { frame: 'accent' } },
  ],
  slide: [
    { x: 8, y: 18, w: 84, scale: { textScale: 'xl', align: 'center' } },
    { x: 10, y: 52, w: 80, scale: { textScale: 'md' } },
  ],
  social: [
    { x: 8, y: 10, w: 84, scale: { textScale: 'lg', align: 'center' } },
    { x: 8, y: 38, w: 84, scale: { align: 'center' } },
    { x: 8, y: 72, w: 84, scale: { frame: 'accent', align: 'center', textScale: 'sm' } },
  ],
  print: [
    { x: 5, y: 5, w: 90, scale: { textScale: 'xl', align: 'center' } },
    { x: 8, y: 28, w: 84, scale: {} },
    { x: 8, y: 55, w: 40, scale: { frame: 'card' } },
    { x: 52, y: 55, w: 40, scale: { frame: 'card' } },
    { x: 8, y: 82, w: 84, scale: { textScale: 'sm' } },
  ],
  photo: [
    { x: 6, y: 6, w: 88 },
    { x: 8, y: 62, w: 84, scale: { textScale: 'lg', align: 'center' } },
    { x: 10, y: 78, w: 80, scale: { textScale: 'sm', align: 'center' } },
  ],
  video: [
    { x: 5, y: 5, w: 58 },
    { x: 66, y: 5, w: 29, scale: { textScale: 'sm', frame: 'subtle' } },
    { x: 5, y: 42, w: 28 },
    { x: 36, y: 42, w: 28 },
    { x: 67, y: 42, w: 28 },
    { x: 5, y: 78, w: 90, scale: { frame: 'accent', textScale: 'sm' } },
  ],
};

export function applyLayoutPreset(blocks: StudioBlock[], variant: LayoutVariant): StudioBlock[] {
  const ps = PRESETS[variant] || PRESETS.report;
  return blocks.map((b, i) => {
    const p = ps[i] || { x: 6, y: Math.min(85, 8 + i * 12), w: 88 };
    return {
      ...b,
      layout: { xPct: p.x, yPct: p.y, wPct: p.w },
      style: { ...(p.scale || {}), ...(b.style || {}) },
    };
  });
}

export function designPageCanvas(
  blocks: StudioBlock[],
  format: StudioFormat = 'report',
  variant: LayoutVariant = 'report',
  pageSize: StudioCanvasState['pageSize'] = format === 'presentation' ? 'Slide' : 'A4',
): StudioCanvasState {
  return {
    version: 1,
    format,
    pageSize,
    orientation: pageSize === 'Slide' ? 'landscape' : 'portrait',
    marginsMm: { ...DEFAULT_STUDIO_MARGINS_MM },
    studioMode: 'design',
    pages: [
      {
        id: 'page-1',
        title: 'Página 1',
        order: 0,
        pageSize,
        layoutMode: 'blank',
        blocks: applyLayoutPreset(blocks, variant),
      },
    ],
  };
}

/** Camada Conteúdo — redação contínua (Word / Excel / guión PPT / PDF). */
export function writePageCanvas(
  blocks: StudioBlock[],
  format: StudioFormat = 'report',
  pageSize: StudioCanvasState['pageSize'] = format === 'presentation' ? 'Slide' : 'A4',
): StudioCanvasState {
  return {
    version: 1,
    format,
    pageSize,
    orientation: pageSize === 'Slide' ? 'landscape' : 'portrait',
    marginsMm: { ...DEFAULT_STUDIO_MARGINS_MM },
    studioMode: 'write',
    pages: [
      {
        id: 'page-1',
        title: 'Página 1',
        order: 0,
        pageSize,
        layoutMode: 'blank',
        blocks: blocks.map((b, i) => ({ ...b, order: i, layout: undefined })),
      },
    ],
  };
}

/** Guión PPT em modo Redação — uma página por slide, sem diagramação %. */
export function writeSlidesOutline(
  slides: Array<{ title: string; notes: string }>,
): StudioCanvasState {
  return {
    version: 1,
    format: 'presentation',
    pageSize: 'Slide',
    orientation: 'landscape',
    marginsMm: { ...DEFAULT_STUDIO_MARGINS_MM },
    studioMode: 'write',
    pages: slides.map((s, i) => ({
      id: `page-${i + 1}`,
      title: `Slide ${i + 1}`,
      order: i,
      pageSize: 'Slide' as const,
      layoutMode: 'blank' as const,
      blocks: [
        {
          id: `h-${i}`,
          kind: 'heading' as const,
          title: s.title,
          text: s.title,
          order: 0,
        },
        {
          id: `n-${i}`,
          kind: 'paragraph' as const,
          title: 'Notas del ponente',
          text: s.notes,
          order: 1,
        },
      ],
    })),
  };
}
