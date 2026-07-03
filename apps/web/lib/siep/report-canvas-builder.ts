import type {
  ReportCanvasFieldType,
  ReportCanvasRegion,
  ReportCanvasSection,
  ReportCanvasState,
} from '@/lib/siep/report-canvas-types';
import { buildCanvasSectionsFromRegions, sortRegionsBySectionOrder, syncCanvasSections } from '@/lib/siep/report-canvas-layout';
import { docxCoordsForNewTableRow } from '@/lib/siep/report-docx-roundtrip';
function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function createBlankCanvas(name?: string): ReportCanvasState {
  return syncCanvasSections({
    version: 1,
    format: 'markdown',
    templateFileId: 'blank',
    templateFileName: name || 'Formato personalizado',
    regions: [],
    sections: [],
  });
}

export function reorderCanvasSections(
  state: ReportCanvasState,
  draggedSectionId: string,
  targetSectionId: string,
): ReportCanvasState {
  const sections = [...(state.sections || buildCanvasSectionsFromRegions(state.regions))];
  const from = sections.findIndex((s) => s.id === draggedSectionId);
  const to = sections.findIndex((s) => s.id === targetSectionId);
  if (from < 0 || to < 0 || from === to) return state;

  const [moved] = sections.splice(from, 1);
  sections.splice(to, 0, moved);

  const byId = new Map(state.regions.map((r) => [r.id, r]));
  const orderedIds = sections.flatMap((s) => s.regionIds);
  const used = new Set<string>();
  const regions: ReportCanvasRegion[] = [];
  for (const id of orderedIds) {
    const r = byId.get(id);
    if (r) {
      regions.push(r);
      used.add(id);
    }
  }
  for (const r of state.regions) {
    if (!used.has(r.id)) regions.push(r);
  }

  return syncCanvasSections({ ...state, regions, sections });
}

export function removeCanvasRegion(state: ReportCanvasState, regionId: string): ReportCanvasState {
  return syncCanvasSections({
    ...state,
    regions: state.regions.filter((r) => r.id !== regionId),
  });
}

export function updateCanvasRegion(
  state: ReportCanvasState,
  regionId: string,
  patch: Partial<Pick<ReportCanvasRegion, 'label' | 'text' | 'instruction' | 'fieldType' | 'missing'>>,
): ReportCanvasState {
  return syncCanvasSections({
    ...state,
    regions: state.regions.map((r) =>
      r.id === regionId
        ? {
            ...r,
            ...patch,
            missing: patch.missing ?? (patch.text != null ? !patch.text.trim() : r.missing),
          }
        : r,
    ),
  });
}

export function updateSectionTitle(
  state: ReportCanvasState,
  sectionId: string,
  title: string,
): ReportCanvasState {
  const sections = (state.sections || buildCanvasSectionsFromRegions(state.regions)).map((s) =>
    s.id === sectionId ? { ...s, title } : s,
  );
  const section = sections.find((s) => s.id === sectionId);
  if (!section) return state;

  const regions = state.regions.map((r) =>
    section.regionIds.includes(r.id) ? { ...r, tableTitle: title, label: r.label || title } : r,
  );

  return { ...syncCanvasSections({ ...state, regions }), sections };
}

/** Reordena regionIds dentro de uma secção (drag-and-drop de campos). */
export function reorderRegionsInSection(
  state: ReportCanvasState,
  sectionId: string,
  draggedRegionId: string,
  targetRegionId: string,
): ReportCanvasState {
  const sections = [...(state.sections || buildCanvasSectionsFromRegions(state.regions))];
  const section = sections.find((s) => s.id === sectionId);
  if (!section) return state;

  const ids = [...section.regionIds];
  const from = ids.indexOf(draggedRegionId);
  const to = ids.indexOf(targetRegionId);
  if (from < 0 || to < 0 || from === to) return state;

  const [moved] = ids.splice(from, 1);
  ids.splice(to, 0, moved);

  const nextSections = sections.map((s) => (s.id === sectionId ? { ...s, regionIds: ids } : s));
  return syncCanvasSections({
    ...state,
    regions: sortRegionsBySectionOrder(state.regions, nextSections),
    sections: nextSections,
  });
}

function sortRegionsBySections(
  regions: ReportCanvasRegion[],
  sections: ReportCanvasSection[],
): ReportCanvasRegion[] {
  return sortRegionsBySectionOrder(regions, sections);
}

function getTableSection(state: ReportCanvasState, sectionId: string) {
  const sections = state.sections || buildCanvasSectionsFromRegions(state.regions);
  const section = sections.find((s) => s.id === sectionId);
  if (!section || section.kind !== 'table') return null;
  const regions = state.regions.filter((r) => section.regionIds.includes(r.id));
  const tableId = regions[0]?.tableId || newId('table');
  return { section, regions, tableId, columns: section.columns || [] };
}

/** Renomeia cabeçalho de coluna numa tabela. */
export function renameTableColumn(
  state: ReportCanvasState,
  sectionId: string,
  colIndex: number,
  newLabel: string,
): ReportCanvasState {
  const ctx = getTableSection(state, sectionId);
  if (!ctx) return state;

  const regions = state.regions.map((r) => {
    if (!ctx.section.regionIds.includes(r.id) || r.tableCol !== colIndex) return r;
    const rowNum = r.tableRow ?? 1;
    return {
      ...r,
      columnLabel: newLabel,
      label: `${newLabel} · linha ${rowNum}`,
    };
  });

  const sections = (state.sections || buildCanvasSectionsFromRegions(state.regions)).map((s) => {
    if (s.id !== sectionId || !s.columns) return s;
    const cols = [...s.columns];
    cols[colIndex] = newLabel;
    return { ...s, columns: cols };
  });

  return { ...syncCanvasSections({ ...state, regions }), sections };
}

/** Adiciona coluna à tabela (células vazias em cada linha existente). */
export function addTableColumn(
  state: ReportCanvasState,
  sectionId: string,
  columnLabel?: string,
): ReportCanvasState {
  const ctx = getTableSection(state, sectionId);
  if (!ctx) return state;

  const colIndex = ctx.columns.length;
  const label = columnLabel || `Coluna ${String.fromCharCode(65 + colIndex)}`;
  const rowIndices = [...new Set(ctx.regions.map((r) => r.tableRow ?? 1))].sort((a, b) => a - b);
  if (!rowIndices.length) rowIndices.push(1);

  const newRegions: ReportCanvasRegion[] = rowIndices.map((rowNum) => ({
    id: newId('t'),
    kind: 'tableCell' as const,
    label: `${label} · linha ${rowNum}`,
    text: '',
    fieldType: 'table' as const,
    sectionId: ctx.section.id,
    tableId: ctx.tableId,
    tableTitle: ctx.section.title,
    columnLabel: label,
    tableRow: rowNum,
    tableCol: colIndex,
    missing: true,
  }));

  const sections = (state.sections || buildCanvasSectionsFromRegions(state.regions)).map((s) =>
    s.id === sectionId ? { ...s, columns: [...(s.columns || []), label], regionIds: [...s.regionIds, ...newRegions.map((r) => r.id)] } : s,
  );

  return syncCanvasSections({
    ...state,
    regions: [...state.regions, ...newRegions],
    sections,
  });
}

/** Remove coluna da tabela. */
export function removeTableColumn(state: ReportCanvasState, sectionId: string, colIndex: number): ReportCanvasState {
  const ctx = getTableSection(state, sectionId);
  if (!ctx || ctx.columns.length <= 1) return state;

  const removeIds = new Set(
    state.regions.filter((r) => ctx.section.regionIds.includes(r.id) && r.tableCol === colIndex).map((r) => r.id),
  );

  const regions = state.regions
    .filter((r) => !removeIds.has(r.id))
    .map((r) => {
      if (!ctx.section.regionIds.includes(r.id) || r.tableCol == null || r.tableCol < colIndex) return r;
      return { ...r, tableCol: r.tableCol - 1 };
    });

  const sections = (state.sections || buildCanvasSectionsFromRegions(state.regions)).map((s) => {
    if (s.id !== sectionId) return s;
    const cols = (s.columns || []).filter((_, i) => i !== colIndex);
    return { ...s, columns: cols, regionIds: s.regionIds.filter((id) => !removeIds.has(id)) };
  });

  return syncCanvasSections({ ...state, regions, sections });
}

/** Adiciona linha vazia à tabela. */
export function addTableRow(state: ReportCanvasState, sectionId: string): ReportCanvasState {
  return addTableRowWithCells(state, sectionId, []);
}

/** Adiciona linha à tabela com conteúdo por coluna (tableCol = índice 0-based). */
export function addTableRowWithCells(
  state: ReportCanvasState,
  sectionId: string,
  cells: Array<{ tableCol: number; text?: string }>,
): ReportCanvasState {
  const ctx = getTableSection(state, sectionId);
  if (!ctx) return state;

  const cols = ctx.columns.length ? ctx.columns : ['Col A', 'Col B'];
  const nextRow = Math.max(0, ...ctx.regions.map((r) => r.tableRow ?? 0)) + 1;
  const cellByCol = new Map(cells.map((c) => [c.tableCol, c.text ?? '']));

  const newRegions: ReportCanvasRegion[] = cols.map((col, ci) => {
    const text = cellByCol.get(ci) ?? '';
    return {
      id: newId('t'),
      kind: 'tableCell' as const,
      label: `${col} · linha ${nextRow}`,
      text,
      fieldType: 'table' as const,
      sectionId: ctx.section.id,
      tableId: ctx.tableId,
      tableTitle: ctx.section.title,
      columnLabel: col,
      tableRow: nextRow,
      tableCol: ci,
      missing: !text.trim(),
      ...docxCoordsForNewTableRow(ctx.regions, nextRow, ci),
    };
  });

  const sections = (state.sections || buildCanvasSectionsFromRegions(state.regions)).map((s) =>
    s.id === sectionId ? { ...s, regionIds: [...s.regionIds, ...newRegions.map((r) => r.id)] } : s,
  );

  return syncCanvasSections({
    ...state,
    regions: [...state.regions, ...newRegions],
    sections,
  });
}

/** Remove uma linha de dados da tabela (todos os tableRow). */
export function removeTableRow(state: ReportCanvasState, sectionId: string, tableRow: number): ReportCanvasState {
  const ctx = getTableSection(state, sectionId);
  if (!ctx) return state;

  const rowNums = new Set(ctx.regions.map((r) => r.tableRow ?? 0));
  if (rowNums.size <= 1) return state;

  const removeIds = ctx.regions.filter((r) => (r.tableRow ?? 0) === tableRow).map((r) => r.id);
  return removeIds.reduce((s, id) => removeCanvasRegion(s, id), state);
}

/** Troca a ordem de duas linhas (valores tableRow). */
export function reorderTableRows(
  state: ReportCanvasState,
  sectionId: string,
  draggedRow: number,
  targetRow: number,
): ReportCanvasState {
  const ctx = getTableSection(state, sectionId);
  if (!ctx || draggedRow === targetRow) return state;

  const regions = state.regions.map((r) => {
    if (!ctx.section.regionIds.includes(r.id)) return r;
    if ((r.tableRow ?? 0) === draggedRow) return { ...r, tableRow: targetRow };
    if ((r.tableRow ?? 0) === targetRow) return { ...r, tableRow: draggedRow };
    return r;
  });

  return syncCanvasSections({ ...state, regions });
}

/** Substitui todas as linhas de dados — apaga conteúdo antigo e cria linhas novas na ordem indicada. */
export function replaceTableDataRows(
  state: ReportCanvasState,
  sectionId: string,
  rows: Array<{ cells: Array<{ tableCol: number; text?: string }> }>,
): ReportCanvasState {
  const ctx = getTableSection(state, sectionId);
  if (!ctx) return state;

  const cols = ctx.columns.length ? ctx.columns : ['Col A', 'Col B'];
  const removeIds = new Set(ctx.regions.map((r) => r.id));
  const meta = ctx.regions.find((r) => r.docxTableIndex != null);
  const baseDocxRow = Math.min(
    ...ctx.regions.map((r) => r.docxRowIndex ?? r.tableRow ?? 0),
  );
  const newRegions: ReportCanvasRegion[] = [];

  rows.forEach((row, rowIndex) => {
    const docxRow = baseDocxRow + rowIndex;
    const cellByCol = new Map(row.cells.map((c) => [c.tableCol, c.text ?? '']));
    for (let ci = 0; ci < cols.length; ci += 1) {
      const col = cols[ci];
      const text = cellByCol.get(ci) ?? '';
      newRegions.push({
        id: `t-${meta?.docxTableIndex ?? 0}-r-${docxRow}-c-${ci}`,
        kind: 'tableCell',
        label: `${col} · linha ${docxRow}`,
        text,
        fieldType: 'table',
        sectionId: ctx.section.id,
        tableId: ctx.tableId,
        tableTitle: ctx.section.title,
        columnLabel: col,
        tableRow: docxRow,
        tableCol: ci,
        missing: !text.trim(),
        docxKind: 'tableCell',
        docxTableIndex: meta?.docxTableIndex,
        docxRowIndex: docxRow,
        docxColIndex: ci,
      });
    }
  });

  const regions = [...state.regions.filter((r) => !removeIds.has(r.id)), ...newRegions];
  const sections = (state.sections || buildCanvasSectionsFromRegions(state.regions)).map((s) =>
    s.id === sectionId ? { ...s, regionIds: newRegions.map((r) => r.id) } : s,
  );

  return syncCanvasSections({ ...state, regions, sections });
}

function pushSection(state: ReportCanvasState, section: ReportCanvasSection, regions: ReportCanvasRegion[]) {
  return syncCanvasSections({
    ...state,
    regions: [...state.regions, ...regions],
    sections: [...(state.sections || buildCanvasSectionsFromRegions(state.regions)), section],
  });
}

export function addShortField(state: ReportCanvasState, label = 'Resposta curta'): ReportCanvasState {
  const sectionId = newId('sec');
  const region: ReportCanvasRegion = {
    id: newId('f'),
    kind: 'paragraph',
    label,
    text: '',
    fieldType: 'short',
    sectionId,
    missing: true,
  };
  const section: ReportCanvasSection = {
    id: sectionId,
    kind: 'fields',
    title: label,
    regionIds: [region.id],
  };
  return pushSection(state, section, [region]);
}

export function addLongField(state: ReportCanvasState, label = 'Resposta longa'): ReportCanvasState {
  const sectionId = newId('sec');
  const region: ReportCanvasRegion = {
    id: newId('f'),
    kind: 'paragraph',
    label,
    text: '',
    fieldType: 'long',
    sectionId,
    missing: true,
  };
  const section: ReportCanvasSection = {
    id: sectionId,
    kind: 'narrative',
    title: label,
    regionIds: [region.id],
  };
  return pushSection(state, section, [region]);
}

export function addOtherField(state: ReportCanvasState, label = 'Campo'): ReportCanvasState {
  const sectionId = newId('sec');
  const region: ReportCanvasRegion = {
    id: newId('f'),
    kind: 'paragraph',
    label,
    text: '',
    fieldType: 'other',
    sectionId,
    missing: true,
  };
  const section: ReportCanvasSection = {
    id: sectionId,
    kind: 'fields',
    title: label,
    regionIds: [region.id],
  };
  return pushSection(state, section, [region]);
}

export function addTableBlock(
  state: ReportCanvasState,
  title = 'Nova tabela',
  columns: string[] = ['Coluna A', 'Coluna B', 'Coluna C'],
  dataRows = 3,
): ReportCanvasState {
  const tableId = newId('table');
  const sectionId = newId('sec');
  const regions: ReportCanvasRegion[] = [];

  for (let ri = 0; ri < dataRows; ri += 1) {
    for (let ci = 0; ci < columns.length; ci += 1) {
      regions.push({
        id: newId('t'),
        kind: 'tableCell',
        label: `${columns[ci]} · linha ${ri + 1}`,
        text: '',
        fieldType: 'table',
        sectionId,
        tableId,
        tableTitle: title,
        columnLabel: columns[ci],
        tableRow: ri + 1,
        tableCol: ci,
        missing: true,
      });
    }
  }

  const section: ReportCanvasSection = {
    id: sectionId,
    kind: 'table',
    title,
    regionIds: regions.map((r) => r.id),
    columns,
  };

  return pushSection(state, section, regions);
}

export function addFieldToSection(
  state: ReportCanvasState,
  sectionId: string,
  fieldType: ReportCanvasFieldType,
  label: string,
): ReportCanvasState {
  const sections = state.sections || buildCanvasSectionsFromRegions(state.regions);
  const section = sections.find((s) => s.id === sectionId);
  if (!section || section.kind !== 'table') {
    const region: ReportCanvasRegion = {
      id: newId('f'),
      kind: 'paragraph',
      label,
      text: '',
      fieldType,
      sectionId: section?.id || sectionId,
      missing: true,
    };
    return syncCanvasSections({
      ...state,
      regions: [...state.regions, region],
    });
  }

  const colCount = section.columns?.length || 2;
  const nextRow =
    Math.max(0, ...state.regions.filter((r) => r.tableId && section.regionIds.includes(r.id)).map((r) => r.tableRow ?? 0)) + 1;
  const cols = section.columns || Array.from({ length: colCount }, (_, i) => `Col ${i + 1}`);
  const newRegions: ReportCanvasRegion[] = cols.map((col, ci) => ({
    id: newId('t'),
    kind: 'tableCell' as const,
    label: `${col} · linha ${nextRow}`,
    text: '',
    fieldType: 'table' as const,
    sectionId: section.id,
    tableId: state.regions.find((r) => section.regionIds.includes(r.id))?.tableId || newId('table'),
    tableTitle: section.title,
    columnLabel: col,
    tableRow: nextRow,
    tableCol: ci,
    missing: true,
  }));

  return syncCanvasSections({
    ...state,
    regions: [...state.regions, ...newRegions],
    sections: sections.map((s) =>
      s.id === sectionId ? { ...s, regionIds: [...s.regionIds, ...newRegions.map((r) => r.id)] } : s,
    ),
  });
}

export const FIELD_TYPE_LABELS: Record<ReportCanvasFieldType, string> = {
  short: 'Resposta curta',
  long: 'Resposta longa',
  table: 'Tabela',
  other: 'Outro',
};
