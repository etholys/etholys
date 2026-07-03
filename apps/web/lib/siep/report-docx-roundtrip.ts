import type { ReportCanvasRegion } from '@/lib/siep/report-canvas-types';

export type DocxCellCoords = {
  tableIndex: number;
  rowIndex: number;
  colIndex: number;
};

export function resolveDocxCellCoords(region: ReportCanvasRegion): DocxCellCoords | null {
  if (
    region.docxTableIndex != null &&
    region.docxRowIndex != null &&
    region.docxColIndex != null
  ) {
    return {
      tableIndex: region.docxTableIndex,
      rowIndex: region.docxRowIndex,
      colIndex: region.docxColIndex,
    };
  }
  const m = region.id.match(/^t-(\d+)-r-(\d+)-c-(\d+)$/);
  if (m) {
    return {
      tableIndex: Number(m[1]),
      rowIndex: Number(m[2]),
      colIndex: Number(m[3]),
    };
  }
  return null;
}

export function tableDocxMetaFromRegions(regions: ReportCanvasRegion[]) {
  const withCoords = regions.map(resolveDocxCellCoords).filter(Boolean) as DocxCellCoords[];
  const tableIndex = regions.find((r) => r.docxTableIndex != null)?.docxTableIndex ?? withCoords[0]?.tableIndex;
  const rowIndices = withCoords.map((c) => c.rowIndex);
  const minDataRow = rowIndices.length ? Math.min(...rowIndices) : 0;
  const maxDataRow = rowIndices.length ? Math.max(...rowIndices) : 0;
  return { tableIndex, minDataRow, maxDataRow };
}

export function docxCoordsForNewTableRow(
  siblingRegions: ReportCanvasRegion[],
  logicalRow: number,
  colIndex: number,
): Pick<ReportCanvasRegion, 'docxTableIndex' | 'docxRowIndex' | 'docxColIndex' | 'docxKind'> {
  const meta = tableDocxMetaFromRegions(siblingRegions);
  const tableIndex = meta.tableIndex ?? 0;
  const baseLogical = Math.min(...siblingRegions.map((r) => r.tableRow ?? 1));
  const baseDocx = meta.minDataRow;
  const rowIndex = baseDocx + (logicalRow - baseLogical);
  return {
    docxKind: 'tableCell',
    docxTableIndex: tableIndex,
    docxRowIndex: rowIndex,
    docxColIndex: colIndex,
  };
}
