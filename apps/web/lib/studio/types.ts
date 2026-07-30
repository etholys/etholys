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

export type StudioBlockKind = 'heading' | 'paragraph' | 'bullets' | 'table' | 'diagram' | 'callout';

export type StudioBlock = {
  id: string;
  kind: StudioBlockKind;
  title?: string;
  text: string;
  /** Para diagramas: mermaid / texto estruturado */
  diagramLang?: 'mermaid' | 'text';
  order: number;
};

export type StudioPage = {
  id: string;
  title: string;
  order: number;
  blocks: StudioBlock[];
};

export type StudioCanvasState = {
  version: 1;
  format: StudioFormat;
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

export function emptyStudioCanvas(format: StudioFormat = 'report'): StudioCanvasState {
  return {
    version: 1,
    format,
    pages: [
      {
        id: 'page-1',
        title: 'Página 1',
        order: 0,
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
