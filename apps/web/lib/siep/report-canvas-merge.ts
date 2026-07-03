import type { CanvasPatch, CopilotCanvasPayload, ReportCanvasState, AddTableRowPayload, ReplaceTableRowsPayload } from '@/lib/siep/report-canvas-types';
import { syncCanvasSections } from '@/lib/siep/report-canvas-layout';
import { addTableRowWithCells, replaceTableDataRows } from '@/lib/siep/report-canvas-builder';

export function applyCanvasPatches(
  state: ReportCanvasState,
  patches: CanvasPatch[],
): ReportCanvasState {
  if (!patches.length) return state;
  const byId = new Map(patches.map((p) => [p.regionId, p]));
  const regions = state.regions.map((r) => {
    const patch = byId.get(r.id);
    if (!patch) return r;

    let nextLabel = r.label;
    let nextText = r.text;

    if (patch.label != null) {
      nextLabel = patch.label;
    }

    if (patch.text != null) {
      const isTableCell = r.kind === 'tableCell' || r.kind === 'cell' || r.fieldType === 'table';
      if (isTableCell) {
        // Células de tabela: conteúdo vai sempre em text (nunca no rótulo)
        nextText = patch.text;
      } else if (
        patch.label == null &&
        !r.text.trim() &&
        patch.text.length <= 200 &&
        !patch.text.includes('\n')
      ) {
        // Campos curtos vazios: heurística legada (rótulo curto)
        nextLabel = patch.text;
        nextText = '';
      } else {
        nextText = patch.text;
      }
    }

    return {
      ...r,
      label: nextLabel,
      text: nextText,
      missing: patch.missing ?? (nextText.trim().length === 0),
      ...(patch.fieldType != null ? { fieldType: patch.fieldType } : {}),
      ...(patch.instruction != null ? { instruction: patch.instruction } : {}),
      ...(patch.sectionId != null ? { sectionId: patch.sectionId } : {}),
      ...(patch.tableId != null ? { tableId: patch.tableId } : {}),
      ...(patch.tableTitle != null ? { tableTitle: patch.tableTitle } : {}),
      ...(patch.columnLabel != null ? { columnLabel: patch.columnLabel } : {}),
      ...(patch.tableRow != null ? { tableRow: patch.tableRow } : {}),
      ...(patch.tableCol != null ? { tableCol: patch.tableCol } : {}),
    };
  });
  return syncCanvasSections({ ...state, regions });
}

export function updateRegionText(
  state: ReportCanvasState,
  regionId: string,
  text: string,
): ReportCanvasState {
  return applyCanvasPatches(state, [{ regionId, text, missing: !text.trim() }]);
}

export function markMissingRegions(state: ReportCanvasState, regionIds: string[]): ReportCanvasState {
  const set = new Set(regionIds);
  return {
    ...state,
    regions: state.regions.map((r) => ({
      ...r,
      missing: set.has(r.id) || (!r.text.trim() && r.missing),
    })),
  };
}

export function removeCanvasRegions(state: ReportCanvasState, regionIds: string[]): ReportCanvasState {
  if (!regionIds.length) return state;
  const remove = new Set(regionIds);
  return syncCanvasSections({
    ...state,
    regions: state.regions.filter((r) => !remove.has(r.id)),
  });
}

export function applyCopilotCanvasUpdate(
  state: ReportCanvasState,
  patches: CanvasPatch[],
  missingRegionIds: string[] = [],
  removeRegionIds: string[] = [],
  addTableRows: AddTableRowPayload[] = [],
  replaceTableRows: ReplaceTableRowsPayload[] = [],
): ReportCanvasState {
  const tableIds = new Set(
    state.regions.filter((r) => r.kind === 'tableCell' || r.kind === 'cell').map((r) => r.id),
  );
  const safeRemove = removeRegionIds.filter((id) => !tableIds.has(id));

  let next = state;
  for (const block of replaceTableRows) {
    if (!block.sectionId || !block.rows?.length) continue;
    next = replaceTableDataRows(next, block.sectionId, block.rows);
  }
  for (const row of addTableRows) {
    if (!row.sectionId || !row.cells?.length) continue;
    next = addTableRowWithCells(next, row.sectionId, row.cells);
  }
  next = applyCanvasPatches(next, patches);
  next = markMissingRegions(next, missingRegionIds);
  next = removeCanvasRegions(next, safeRemove);
  return syncCanvasSections(next);
}

export function regionsFromDraftContent(
  state: ReportCanvasState,
  content: string,
  findings?: string,
  recommendations?: string,
): ReportCanvasState {
  const extra: import('@/lib/siep/report-canvas-types').ReportCanvasRegion[] = [];
  if (findings?.trim()) {
    extra.push({ id: 'findings', kind: 'paragraph', label: 'Hallazgos', text: findings });
  }
  if (recommendations?.trim()) {
    extra.push({ id: 'recommendations', kind: 'paragraph', label: 'Recomendaciones', text: recommendations });
  }

  if (state.format === 'markdown' && state.regions.length === 1 && state.regions[0].id === 'body') {
    return {
      ...state,
      regions: [{ ...state.regions[0], text: content }, ...extra],
    };
  }

  const main = state.regions.filter((r) => r.kind !== 'paragraph' || !['findings', 'recommendations'].includes(r.id));
  if (main.length && content) {
    const firstEmpty = main.find((r) => !r.text.trim() && r.kind === 'paragraph');
    if (firstEmpty) {
      return {
        ...state,
        regions: main.map((r) => (r.id === firstEmpty.id ? { ...r, text: content, missing: false } : r)).concat(extra),
      };
    }
  }
  return { ...state, regions: [...main, ...extra] };
}
