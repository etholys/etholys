import type { ReportCanvasRegion, ReportCanvasState } from '@/lib/siep/report-canvas-types';
import { resolveDocxCellCoords } from '@/lib/siep/report-docx-roundtrip';

function regionMatchKey(r: ReportCanvasRegion): string {
  return [
    r.tableTitle || '',
    r.tableId || '',
    r.columnLabel || '',
    String(r.tableRow ?? ''),
    String(r.tableCol ?? ''),
    r.label || '',
  ].join('|');
}

function regionLabelKey(r: ReportCanvasRegion): string {
  return [r.tableId || '', String(r.tableCol ?? ''), r.label || ''].join('|');
}

function applyTemplateCoords(
  base: ReportCanvasRegion,
  template: ReportCanvasRegion,
): ReportCanvasRegion {
  return {
    ...base,
    kind: 'tableCell',
    docxKind: 'tableCell',
    docxTableIndex: template.docxTableIndex,
    docxRowIndex: template.docxRowIndex,
    docxColIndex: template.docxColIndex,
    tableRow: template.docxRowIndex ?? template.tableRow,
  };
}

function matchTemplateCell(
  base: ReportCanvasRegion,
  templateCells: ReportCanvasRegion[],
  byKey: Map<string, ReportCanvasRegion>,
  byTableCol: Map<string, ReportCanvasRegion[]>,
  byLabel: Map<string, ReportCanvasRegion[]>,
): ReportCanvasRegion | null {
  const exact = byKey.get(regionMatchKey(base));
  if (exact?.docxTableIndex != null) return applyTemplateCoords(base, exact);

  const labelMatches = byLabel.get(regionLabelKey(base));
  if (labelMatches?.length === 1) return applyTemplateCoords(base, labelMatches[0]!);

  const tplForTable = templateCells.filter((c) => c.tableId === base.tableId);
  if (tplForTable.length === 1) return applyTemplateCoords(base, tplForTable[0]!);

  const tableColKey = `${base.tableId ?? ''}|${base.tableCol ?? 0}|${base.columnLabel ?? ''}`;
  const templateColCells = byTableCol.get(tableColKey);
  if (templateColCells?.length === 1) {
    return applyTemplateCoords(base, templateColCells[0]!);
  }

  if (templateColCells?.length && base.tableRow != null) {
    const minTplRow = templateColCells[0]!.tableRow ?? 0;
    const minDocxRow = Math.min(
      ...templateColCells.map((r) => r.docxRowIndex ?? r.tableRow ?? 0),
    );
    const tableIndex = templateColCells[0]!.docxTableIndex;
    if (tableIndex != null) {
      const docxRowIndex = minDocxRow + (base.tableRow - minTplRow);
      return {
        ...base,
        kind: 'tableCell',
        docxKind: 'tableCell',
        docxTableIndex: tableIndex,
        docxRowIndex,
        docxColIndex: base.tableCol ?? 0,
        tableRow: docxRowIndex,
      };
    }
  }

  return null;
}

/** Reconcilia coordenadas DOCX do modelo com o canvas editado (informes antigos). */
export function reconcileCanvasDocxCoords(
  templateCanvas: ReportCanvasState,
  editedCanvas: ReportCanvasState,
): ReportCanvasState {
  const templateCells = templateCanvas.regions.filter((r) => r.kind === 'tableCell');
  const byKey = new Map(templateCells.map((r) => [regionMatchKey(r), r]));
  const byTableCol = new Map<string, ReportCanvasRegion[]>();
  const byLabel = new Map<string, ReportCanvasRegion[]>();

  for (const cell of templateCells) {
    const colKey = `${cell.tableId ?? ''}|${cell.tableCol ?? 0}|${cell.columnLabel ?? ''}`;
    const colList = byTableCol.get(colKey) ?? [];
    colList.push(cell);
    byTableCol.set(colKey, colList);

    const labelKey = regionLabelKey(cell);
    const labelList = byLabel.get(labelKey) ?? [];
    labelList.push(cell);
    byLabel.set(labelKey, labelList);
  }

  for (const list of byTableCol.values()) {
    list.sort((a, b) => (a.tableRow ?? 0) - (b.tableRow ?? 0));
  }

  const forceRemap =
    (editedCanvas.parseVersion ?? 0) < (templateCanvas.parseVersion ?? 0);

  const regions = editedCanvas.regions.map((region) => {
    const isTableRegion =
      region.kind === 'tableCell' ||
      (region.tableId != null && region.tableRow != null && region.tableCol != null);
    if (!isTableRegion) return region;

    const base = region.kind === 'tableCell' ? region : { ...region, kind: 'tableCell' as const };

    if (!forceRemap && resolveDocxCellCoords(base)) {
      return { ...base, docxKind: 'tableCell' as const };
    }

    const matched = matchTemplateCell(base, templateCells, byKey, byTableCol, byLabel);
    if (matched) return matched;

    const siblings = editedCanvas.regions.filter(
      (r) =>
        r.tableId === base.tableId &&
        (r.kind === 'tableCell' ||
          (r.tableId != null && r.tableRow != null && r.tableCol != null)),
    );
    const withCoords = siblings
      .map((r) => ({ r, c: resolveDocxCellCoords(r) }))
      .filter((x): x is { r: ReportCanvasRegion; c: NonNullable<ReturnType<typeof resolveDocxCellCoords>> } => !!x.c);
    if (!withCoords.length) return base;

    const tableIndex = withCoords[0]!.c.tableIndex;
    const logicalRows = [...new Set(siblings.map((r) => r.tableRow ?? 0))].sort((a, b) => a - b);
    const logicalIndex = logicalRows.indexOf(base.tableRow ?? 0);
    const baseDocxRow = Math.min(...withCoords.map((x) => x.c.rowIndex));

    return {
      ...base,
      docxKind: 'tableCell' as const,
      docxTableIndex: tableIndex,
      docxRowIndex: baseDocxRow + logicalIndex,
      docxColIndex: base.tableCol ?? 0,
      tableRow: baseDocxRow + logicalIndex,
    };
  });

  return { ...editedCanvas, regions, parseVersion: templateCanvas.parseVersion };
}
