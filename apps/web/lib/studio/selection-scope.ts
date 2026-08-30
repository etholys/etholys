import type { StudioCanvasState } from '@/lib/studio/types';

export type PageSelectionState = 'none' | 'partial' | 'full';

export function blockIdsForPage(canvas: StudioCanvasState, pageId: string): string[] {
  const page = canvas.pages.find((p) => p.id === pageId);
  if (!page) return [];
  return page.blocks.map((b) => b.id);
}

export function pageSelectionState(
  canvas: StudioCanvasState,
  pageId: string,
  selectedBlockIds: string[],
): PageSelectionState {
  const ids = blockIdsForPage(canvas, pageId);
  if (!ids.length) return 'none';
  const selected = ids.filter((id) => selectedBlockIds.includes(id));
  if (!selected.length) return 'none';
  if (selected.length >= ids.length) return 'full';
  return 'partial';
}

export function togglePageBlockSelection(
  canvas: StudioCanvasState,
  pageId: string,
  selectedBlockIds: string[],
): string[] {
  const ids = blockIdsForPage(canvas, pageId);
  if (!ids.length) return selectedBlockIds;
  const allSelected = ids.every((id) => selectedBlockIds.includes(id));
  if (allSelected) {
    return selectedBlockIds.filter((id) => !ids.includes(id));
  }
  return [...new Set([...selectedBlockIds, ...ids])];
}

export function blockPageIndex(canvas: StudioCanvasState, blockId: string): number {
  const sorted = canvas.pages.slice().sort((a, b) => a.order - b.order);
  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i].blocks.some((b) => b.id === blockId)) return i + 1;
  }
  return 0;
}

export function blockLabelWithPage(canvas: StudioCanvasState, blockId: string): string {
  for (const page of canvas.pages) {
    const b = page.blocks.find((x) => x.id === blockId);
    if (!b) continue;
    const pageNum = blockPageIndex(canvas, blockId);
    const raw = (b.title || b.text || b.kind).replace(/\s+/g, ' ').trim();
    const label = raw.slice(0, 36) || b.kind;
    return pageNum ? `P.${pageNum} · ${label}` : label;
  }
  return blockId;
}

export type ScopeSummary = {
  blockCount: number;
  pageNumbers: number[];
  byPage: Array<{ pageId: string; pageNumber: number; blockIds: string[] }>;
};

export function buildScopeSummary(
  canvas: StudioCanvasState,
  selectedBlockIds: string[],
): ScopeSummary {
  const sorted = canvas.pages.slice().sort((a, b) => a.order - b.order);
  const byPage: ScopeSummary['byPage'] = [];
  const pageNumbers: number[] = [];

  sorted.forEach((page, idx) => {
    const blockIds = page.blocks.map((b) => b.id).filter((id) => selectedBlockIds.includes(id));
    if (!blockIds.length) return;
    const pageNumber = idx + 1;
    pageNumbers.push(pageNumber);
    byPage.push({ pageId: page.id, pageNumber, blockIds });
  });

  return {
    blockCount: selectedBlockIds.length,
    pageNumbers,
    byPage,
  };
}

export function scopeSummaryLabel(summary: ScopeSummary, locale: string): string {
  const loc = locale === 'es' ? 'es' : locale === 'en' ? 'en' : 'pt';
  const pages = summary.pageNumbers.length;
  const blocks = summary.blockCount;
  if (loc === 'es') {
    return `${blocks} bloque${blocks === 1 ? '' : 's'} · ${pages} hoja${pages === 1 ? '' : 's'}`;
  }
  if (loc === 'en') {
    return `${blocks} block${blocks === 1 ? '' : 's'} · ${pages} page${pages === 1 ? '' : 's'}`;
  }
  return `${blocks} bloco${blocks === 1 ? '' : 's'} · ${pages} folha${pages === 1 ? '' : 's'}`;
}
