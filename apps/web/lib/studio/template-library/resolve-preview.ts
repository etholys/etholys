import { findSystemTemplate } from '@/lib/studio/templates';
import { normalizeStudioCanvas, type StudioCanvasState } from '@/lib/studio/types';

/** Canvas de pré-visualização / criação (sistema + biblioteca pública). */
export function resolveTemplatePreviewCanvas(templateKey: string): StudioCanvasState | null {
  const key = templateKey.trim();
  if (!key) return null;
  const tpl = findSystemTemplate(key);
  if (!tpl) return null;
  return normalizeStudioCanvas(tpl.buildCanvas());
}

export function countTemplatePages(canvas: StudioCanvasState): number {
  return canvas.pages?.length || 0;
}

export function templateHasDesignLayout(canvas: StudioCanvasState): boolean {
  if (canvas.studioMode === 'design') return true;
  return canvas.pages.some((p) =>
    p.blocks.some((b) => b.layout && (b.layout.xPct != null || b.layout.yPct != null)),
  );
}
