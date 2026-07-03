import JSZip from 'jszip';
import * as XLSX from 'xlsx';
import type { ReportCanvasState } from '@/lib/siep/report-canvas-types';
import { resolveDocxCellCoords } from '@/lib/siep/report-docx-roundtrip';
import {
  replaceDocxCellText,
  replaceDocxParagraphText,
  splitDocxBlocks,
} from '@/lib/siep/report-docx-write';

type BodyBlock = { kind: 'paragraph'; xml: string; index: number } | { kind: 'table'; xml: string; index: number };

function splitBodyBlocks(docXml: string): BodyBlock[] {
  const bodyMatch = docXml.match(/<w:body[^>]*>([\s\S]*)<\/w:body>/i);
  const body = bodyMatch?.[1] ?? docXml;
  const blocks: BodyBlock[] = [];
  const tagRe = /<w:(p|tbl)(?:\s[^>]*)?>/g;
  let match: RegExpExecArray | null;
  let pIdx = 0;
  let tIdx = 0;
  while ((match = tagRe.exec(body)) !== null) {
    const tag = match[1];
    const start = match.index;
    const close = `</w:${tag}>`;
    const end = body.indexOf(close, start);
    if (end < 0) continue;
    const xml = body.slice(start, end + close.length);
    if (tag === 'tbl') {
      blocks.push({ kind: 'table', xml, index: tIdx });
      tIdx += 1;
    } else {
      blocks.push({ kind: 'paragraph', xml, index: pIdx });
      pIdx += 1;
    }
    tagRe.lastIndex = end + close.length;
  }
  return blocks;
}

function groupCanvasRowsByTable(canvas: ReportCanvasState) {
  const byTable = new Map<number, Map<number, Map<number, string>>>();

  for (const region of canvas.regions) {
    if (region.kind !== 'tableCell' && region.docxKind !== 'tableCell') continue;
    const coords = resolveDocxCellCoords(region);
    if (!coords) continue;

    if (!byTable.has(coords.tableIndex)) byTable.set(coords.tableIndex, new Map());
    const byRow = byTable.get(coords.tableIndex)!;
    if (!byRow.has(coords.rowIndex)) byRow.set(coords.rowIndex, new Map());
    byRow.get(coords.rowIndex)!.set(coords.colIndex, region.text);
  }

  return byTable;
}

function applyRowTexts(rowXml: string, colTexts: Map<number, string>): string {
  const cells = splitDocxBlocks(rowXml, 'tc');
  let next = rowXml;
  cells.forEach((cell, ci) => {
    if (!colTexts.has(ci)) return;
    const updated = replaceDocxCellText(cell, colTexts.get(ci) ?? '');
    next = next.replace(cell, updated);
  });
  return next;
}

function clearRowTexts(rowXml: string, colIndices?: Set<number>): string {
  const cells = splitDocxBlocks(rowXml, 'tc');
  let next = rowXml;
  cells.forEach((cell, ci) => {
    if (colIndices && !colIndices.has(ci)) return;
    const cleared = replaceDocxCellText(cell, '');
    next = next.replace(cell, cleared);
  });
  return next;
}

function rebuildTableXml(tblXml: string, rowXmls: string[]): string {
  const originalRows = splitDocxBlocks(tblXml, 'tr');
  if (!originalRows.length) return tblXml;

  let cursor = 0;
  let result = tblXml;
  for (const row of originalRows) {
    const replacement = rowXmls[cursor] ?? row;
    result = result.replace(row, replacement);
    cursor += 1;
  }

  if (rowXmls.length > originalRows.length) {
    const insert = rowXmls.slice(originalRows.length).join('');
    result = result.replace(/<\/w:tbl>/, `${insert}</w:tbl>`);
  }

  return result;
}

function exportTableInDoc(
  tblXml: string,
  rowMap: Map<number, Map<number, string>>,
): string {
  const rowXmls = splitDocxBlocks(tblXml, 'tr');
  if (!rowXmls.length || !rowMap.size) return tblXml;

  const canvasRowIndices = [...rowMap.keys()].sort((a, b) => a - b);
  const minRow = canvasRowIndices[0];
  const maxRow = canvasRowIndices[canvasRowIndices.length - 1];
  const dataCols = new Set<number>();
  for (const colMap of rowMap.values()) {
    for (const ci of colMap.keys()) dataCols.add(ci);
  }

  const cloneFrom = Math.min(Math.max(minRow, 0), rowXmls.length - 1);
  while (rowXmls.length <= maxRow) {
    rowXmls.push(rowXmls[cloneFrom] || rowXmls[rowXmls.length - 1]);
  }

  for (const rowIdx of canvasRowIndices) {
    rowXmls[rowIdx] = applyRowTexts(rowXmls[rowIdx], rowMap.get(rowIdx)!);
  }

  for (let i = minRow; i < rowXmls.length && i <= maxRow + 2; i += 1) {
    if (!rowMap.has(i)) rowXmls[i] = clearRowTexts(rowXmls[i], dataCols);
  }

  return rebuildTableXml(tblXml, rowXmls);
}

export async function exportDocxFromCanvas(
  templateBuffer: Buffer,
  canvas: ReportCanvasState,
): Promise<Buffer> {
  const zip = await JSZip.loadAsync(templateBuffer);
  let docXml = await zip.file('word/document.xml')?.async('string');
  if (!docXml) throw new Error('DOCX inválido');

  const bodyBlocks = splitBodyBlocks(docXml);
  const tableBlocks = bodyBlocks.filter((b): b is BodyBlock & { kind: 'table' } => b.kind === 'table');
  const byTable = groupCanvasRowsByTable(canvas);

  for (const [tableIndex, rowMap] of byTable) {
    const block = tableBlocks.find((b) => b.index === tableIndex);
    if (!block) continue;
    const updated = exportTableInDoc(block.xml, rowMap);
    docXml = docXml.replace(block.xml, updated);
    block.xml = updated;
  }

  const paraRegions = canvas.regions.filter(
    (r) =>
      r.docxKind === 'paragraph' &&
      r.docxIndex != null &&
      r.docxTableIndex == null &&
      !r.tableId &&
      r.kind === 'paragraph',
  );
  const paraBlocks = bodyBlocks.filter((b): b is BodyBlock & { kind: 'paragraph' } => b.kind === 'paragraph');

  for (const region of paraRegions) {
    const idx = region.docxIndex!;
    const block = paraBlocks.find((b) => b.index === idx);
    if (!block) continue;
    const updated = replaceDocxParagraphText(block.xml, region.text);
    docXml = docXml.replace(block.xml, updated);
    block.xml = updated;
  }

  zip.file('word/document.xml', docXml);
  return Buffer.from(await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }));
}

export async function exportXlsxFromCanvas(
  templateBuffer: Buffer,
  canvas: ReportCanvasState,
): Promise<Buffer> {
  const workbook = XLSX.read(templateBuffer, { type: 'buffer', cellDates: true });

  for (const region of canvas.regions) {
    if (region.kind !== 'cell' || !region.sheet || region.row == null || region.col == null) continue;
    let sheet = workbook.Sheets[region.sheet];
    if (!sheet) {
      sheet = {};
      workbook.Sheets[region.sheet] = sheet;
      if (!workbook.SheetNames.includes(region.sheet)) workbook.SheetNames.push(region.sheet);
    }
    const addr = XLSX.utils.encode_cell({ r: region.row, c: region.col });
    sheet[addr] = { t: 's', v: region.text };
  }

  for (const name of workbook.SheetNames) {
    const sheet = workbook.Sheets[name];
    if (sheet) sheet['!ref'] = XLSX.utils.encode_range(XLSX.utils.decode_range(sheet['!ref'] || 'A1'));
  }

  return Buffer.from(XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as ArrayBuffer);
}

export async function exportReportFromCanvas(
  templateBuffer: Buffer,
  canvas: ReportCanvasState,
  fileName: string,
): Promise<{ buffer: Buffer; mimeType: string; fileName: string }> {
  if (canvas.format === 'xlsx') {
    const buffer = await exportXlsxFromCanvas(templateBuffer, canvas);
    return {
      buffer,
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      fileName: fileName.replace(/\.[^.]+$/, '') + '_filled.xlsx',
    };
  }
  const buffer = await exportDocxFromCanvas(templateBuffer, canvas);
  return {
    buffer,
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    fileName: fileName.replace(/\.[^.]+$/, '') + '_filled.docx',
  };
}
