/** Etholys Studio — tipos partilhados (cliente + servidor). Spec: docs/architecture/etholys-studio.md */

export const STUDIO_FORMATS = [
  'report',
  'proposal',
  'brief',
  'letter',
  'presentation',
  'diagram',
  'other',
] as const;

export type StudioFormat = (typeof STUDIO_FORMATS)[number];

/** Tamanhos de folha (vista + export) */
export const STUDIO_PAGE_SIZES = ['A4', 'A3', 'A5', 'Letter', 'Legal', 'Slide'] as const;
export type StudioPageSize = (typeof STUDIO_PAGE_SIZES)[number];

/** Dimensões em mm */
export const STUDIO_PAGE_SIZE_MM: Record<StudioPageSize, { w: number; h: number }> = {
  A4: { w: 210, h: 297 },
  A3: { w: 297, h: 420 },
  A5: { w: 148, h: 210 },
  Letter: { w: 216, h: 279 },
  Legal: { w: 216, h: 356 },
  Slide: { w: 338, h: 190 },
};

export type StudioBlockKind =
  | 'heading'
  | 'paragraph'
  | 'bullets'
  | 'table'
  | 'diagram'
  | 'callout'
  | 'image';

export type StudioBlock = {
  id: string;
  kind: StudioBlockKind;
  title?: string;
  text: string;
  diagramLang?: 'mermaid' | 'text';
  imageUrl?: string | null;
  order: number;
};

export type StudioPage = {
  id: string;
  title: string;
  order: number;
  blocks: StudioBlock[];
  pageSize?: StudioPageSize;
  /** blank = desenhar do zero; mold = usar molde gráfico */
  layoutMode?: 'blank' | 'mold';
  moldId?: string | null;
};

export type StudioCanvasState = {
  version: 1;
  format: StudioFormat;
  pageSize?: StudioPageSize;
  pages: StudioPage[];
};

export type StudioCanvasPatch = {
  pageId?: string;
  blockId: string;
  text?: string;
  title?: string;
  kind?: StudioBlockKind;
};

export type StudioConsentSource = {
  id: string;
  label: string;
  system?: string;
  description?: string;
};

export type StudioConsentRequest = {
  question: string;
  sources: StudioConsentSource[];
};

export type StudioCopilotPayload = {
  message: string;
  canvasPatches?: StudioCanvasPatch[];
  consentRequest?: StudioConsentRequest | null;
  suggestedTitle?: string;
};

export function isStudioFormat(v: unknown): v is StudioFormat {
  return typeof v === 'string' && (STUDIO_FORMATS as readonly string[]).includes(v);
}

export function isStudioPageSize(v: unknown): v is StudioPageSize {
  return typeof v === 'string' && (STUDIO_PAGE_SIZES as readonly string[]).includes(v);
}

export function emptyStudioCanvas(format: StudioFormat = 'report'): StudioCanvasState {
  const pageSize: StudioPageSize = format === 'presentation' ? 'Slide' : 'A4';
  return {
    version: 1,
    format,
    pageSize,
    pages: [
      {
        id: 'page-1',
        title: 'Página 1',
        order: 0,
        pageSize,
        layoutMode: 'blank',
        blocks: [
          {
            id: 'block-title',
            kind: 'heading',
            title: 'Título',
            text: '',
            order: 0,
          },
          {
            id: 'block-body',
            kind: 'paragraph',
            title: 'Corpo',
            text: '',
            order: 1,
          },
        ],
      },
    ],
  };
}

/** Normaliza canvas legado (sem pageSize / layoutMode). */
export function normalizeStudioCanvas(raw: unknown): StudioCanvasState {
  const base = emptyStudioCanvas('report');
  if (!raw || typeof raw !== 'object') return base;
  const c = raw as Partial<StudioCanvasState>;
  const format = isStudioFormat(c.format) ? c.format : 'report';
  const pageSize = isStudioPageSize(c.pageSize)
    ? c.pageSize
    : format === 'presentation'
      ? 'Slide'
      : 'A4';
  const pages =
    Array.isArray(c.pages) && c.pages.length
      ? c.pages.map((p, i) => ({
          id: typeof p.id === 'string' ? p.id : `page-${i + 1}`,
          title: typeof p.title === 'string' ? p.title : `Página ${i + 1}`,
          order: typeof p.order === 'number' ? p.order : i,
          pageSize: isStudioPageSize(p.pageSize) ? p.pageSize : pageSize,
          layoutMode: p.layoutMode === 'mold' ? ('mold' as const) : ('blank' as const),
          moldId: typeof p.moldId === 'string' ? p.moldId : null,
          blocks: Array.isArray(p.blocks)
            ? p.blocks.map((b, j) => ({
                id: typeof b.id === 'string' ? b.id : `block-${j}`,
                kind: (b.kind as StudioBlockKind) || 'paragraph',
                title: b.title,
                text: typeof b.text === 'string' ? b.text : '',
                diagramLang: b.diagramLang,
                imageUrl: b.imageUrl ?? null,
                order: typeof b.order === 'number' ? b.order : j,
              }))
            : [],
        }))
      : base.pages;
  return { version: 1, format, pageSize, pages };
}

export function applyStudioCanvasPatches(
  canvas: StudioCanvasState,
  patches: StudioCanvasPatch[],
): StudioCanvasState {
  if (!patches.length) return canvas;
  const pages = canvas.pages.map((page) => ({
    ...page,
    blocks: page.blocks.map((block) => {
      const patch = patches.find(
        (p) => p.blockId === block.id && (!p.pageId || p.pageId === page.id),
      );
      if (!patch) return block;
      return {
        ...block,
        text: patch.text !== undefined ? patch.text : block.text,
        title: patch.title !== undefined ? patch.title : block.title,
        kind: patch.kind ?? block.kind,
      };
    }),
  }));
  return { ...canvas, pages };
}

/** Largura CSS da folha no ecrã (px), altura proporcional. */
export function studioPageCssSize(
  size: StudioPageSize = 'A4',
  maxWidthPx = 720,
): { width: number; height: number } {
  const mm = STUDIO_PAGE_SIZE_MM[size] || STUDIO_PAGE_SIZE_MM.A4;
  const width = Math.min(maxWidthPx, Math.round(mm.w * 2.8));
  const height = Math.round((width * mm.h) / mm.w);
  return { width, height };
}
