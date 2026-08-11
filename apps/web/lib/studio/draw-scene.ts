/** Persistência de diagramas visuais (Excalidraw) no canvasState. */

export type StudioDrawScene = {
  v: 1;
  app: 'excalidraw';
  elements: unknown[];
  appState?: Record<string, unknown>;
  files?: Record<string, unknown>;
  /** SVG cache para preview/export (opcional) */
  svgPreview?: string | null;
};

export function emptyStudioDrawScene(): StudioDrawScene {
  return {
    v: 1,
    app: 'excalidraw',
    elements: [],
    appState: { viewBackgroundColor: '#ffffff' },
    files: {},
    svgPreview: null,
  };
}

export function parseStudioDrawScene(raw: string): StudioDrawScene | null {
  const t = (raw || '').trim();
  if (!t.startsWith('{')) return null;
  try {
    const o = JSON.parse(t) as Partial<StudioDrawScene>;
    if (o && o.app === 'excalidraw' && Array.isArray(o.elements)) {
      return {
        v: 1,
        app: 'excalidraw',
        elements: o.elements,
        appState: o.appState && typeof o.appState === 'object' ? o.appState : { viewBackgroundColor: '#ffffff' },
        files: o.files && typeof o.files === 'object' ? o.files : {},
        svgPreview: typeof o.svgPreview === 'string' ? o.svgPreview : null,
      };
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function serializeStudioDrawScene(scene: StudioDrawScene): string {
  return JSON.stringify(scene);
}

export function isStudioDrawBlock(block: { kind: string; diagramLang?: string; text?: string }): boolean {
  if (block.kind !== 'diagram') return false;
  if (block.diagramLang === 'draw') return true;
  if (block.diagramLang === 'mermaid' || block.diagramLang === 'text') return false;
  return !!parseStudioDrawScene(block.text || '');
}
