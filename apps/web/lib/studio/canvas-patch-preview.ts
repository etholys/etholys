import {
  buildStructureDevelopPatches,
  parseStructureProposalSections,
} from '@/lib/studio/structure-apply';
import { buildStructureMigrationPatches } from '@/lib/studio/structure-migrate';
import type { StudioCanvasPatch, StudioCanvasState } from '@/lib/studio/types';

export type CanvasPatchSummary = {
  patchCount: number;
  blockIds: string[];
  pageNumbers: number[];
  sectionCount: number;
};

export function blockIdsToPageNumbers(canvas: StudioCanvasState, blockIds: string[]): number[] {
  const sorted = canvas.pages.slice().sort((a, b) => a.order - b.order);
  const nums = new Set<number>();
  for (const id of blockIds) {
    const idx = sorted.findIndex((p) => p.blocks.some((b) => b.id === id));
    if (idx >= 0) nums.add(idx + 1);
  }
  return [...nums].sort((a, b) => a - b);
}

export function findPageIdForBlock(canvas: StudioCanvasState, blockId: string): string | null {
  for (const page of canvas.pages) {
    if (page.blocks.some((b) => b.id === blockId)) return page.id;
  }
  return null;
}

export function summarizeCanvasPatches(
  canvas: StudioCanvasState,
  patches: StudioCanvasPatch[],
): CanvasPatchSummary {
  const blockIds = [...new Set(patches.map((p) => p.blockId))];
  const headingCount = patches.filter((p) => p.kind === 'heading').length;
  return {
    patchCount: patches.length,
    blockIds,
    pageNumbers: blockIdsToPageNumbers(canvas, blockIds),
    sectionCount: headingCount,
  };
}

/** Pré-visualização local antes de «Aplicar» / «Migrar» estrutura. */
export function previewStructurePatches(
  canvas: StudioCanvasState,
  proposalText: string,
  mode: 'apply' | 'migrate',
): CanvasPatchSummary {
  const patches =
    mode === 'migrate'
      ? buildStructureMigrationPatches(canvas, proposalText)
      : buildStructureDevelopPatches(canvas, proposalText);
  const sections = parseStructureProposalSections(proposalText).length;
  const summary = summarizeCanvasPatches(canvas, patches);
  return { ...summary, sectionCount: sections || summary.sectionCount };
}

export function formatPageRange(pages: number[], locale: string): string {
  if (!pages.length) return '';
  if (pages.length === 1) return String(pages[0]);
  const loc = locale === 'es' ? 'es' : locale === 'en' ? 'en' : 'pt';
  if (loc === 'es') return `${pages[0]}–${pages[pages.length - 1]}`;
  if (loc === 'en') return `${pages[0]}-${pages[pages.length - 1]}`;
  return `${pages[0]}–${pages[pages.length - 1]}`;
}
