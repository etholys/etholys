import JSZip from 'jszip';
import * as XLSX from 'xlsx';
import type { ReportCanvasState } from '@/lib/siep/report-canvas-types';
import { buildCanvasSectionsFromRegions } from '@/lib/siep/report-canvas-layout';

/** Bump when template parsing heuristics change — força re-leitura de modelos guardados. */
export const TEMPLATE_PARSE_VERSION = 5;

function decodeXmlText(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function extractWtText(xml: string): string {
  const parts: string[] = [];
  const re = /<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) parts.push(m[1]);
  return decodeXmlText(parts.join(''));
}

/** Extrai blocos w:p / w:tbl / w:tr / w:tc — evita confundir w:tblPr, w:trPr, etc. */
function splitBlocks(xml: string, tag: 'p' | 'tc' | 'tr' | 'tbl'): string[] {
  const openRe = new RegExp(`<w:${tag}(?:\\s[^>]*)?>`, 'g');
  const close = `</w:${tag}>`;
  const blocks: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = openRe.exec(xml)) !== null) {
    const start = match.index;
    const end = xml.indexOf(close, start);
    if (end < 0) break;
    blocks.push(xml.slice(start, end + close.length));
    openRe.lastIndex = end + close.length;
  }
  return blocks;
}

type BodyBlock = { kind: 'paragraph'; xml: string } | { kind: 'table'; xml: string };

function splitBodyBlocks(docXml: string): BodyBlock[] {
  const bodyMatch = docXml.match(/<w:body[^>]*>([\s\S]*)<\/w:body>/i);
  const body = bodyMatch?.[1] ?? docXml;
  const blocks: BodyBlock[] = [];
  const tagRe = /<w:(p|tbl)(?:\s[^>]*)?>/g;
  let match: RegExpExecArray | null;
  while ((match = tagRe.exec(body)) !== null) {
    const tag = match[1];
    const start = match.index;
    const close = `</w:${tag}>`;
    const end = body.indexOf(close, start);
    if (end < 0) continue;
    const xml = body.slice(start, end + close.length);
    blocks.push({ kind: tag === 'tbl' ? 'table' : 'paragraph', xml });
    tagRe.lastIndex = end + close.length;
  }
  return blocks;
}

function isHelperHintText(text: string): boolean {
  const t = text.trim();
  if (/add rows|agregue filas|insert rows|añadir filas|as needed|según sea necesario/i.test(t)) return true;
  return false;
}

export function isInstructionParagraph(text: string): boolean {
  const t = text.trim();
  if (!t || t.length < 70) return false;
  if (/formulario|beneficiarios|presentar|instructions|please complete|through this form|a través de este/i.test(t)) {
    return true;
  }
  if (t.split(/\s+/).length >= 12 && /[.!?]/.test(t)) return true;
  return false;
}

export function isBilingualLabel(text: string): boolean {
  const t = text.trim();
  if (!t.includes(' / ') || t.length > 240) return false;
  const parts = t.split(' / ').map((p) => p.trim()).filter(Boolean);
  if (parts.length < 2 || parts.length > 3) return false;
  if (parts.some((p) => p.split(/\s+/).length > 14)) return false;
  if (parts.some((p) => isInstructionParagraph(p))) return false;
  return true;
}

export function isSectionHeader(text: string): boolean {
  const t = text.trim();
  if (!t || t.endsWith(':')) return false;
  if (/^(part|section|sección|parte|anexo|appendix)\s+[0-9a-z]/i.test(t)) return true;
  if (/^(award information|información de la adjudicación|financial report|informe financiero)/i.test(t)) {
    return true;
  }
  if (/^(monthly relevant activities|actividades relevantes|media coverage|press coverage|cobertura mediática)/i.test(t)) {
    return true;
  }
  if (/^[A-Z][A-Z0-9\s/&-]{8,}$/.test(t) && !t.includes(' / ')) return true;
  return false;
}

export function isDocxLabelText(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  if (isHelperHintText(t) || isInstructionParagraph(t)) return false;
  if (t.endsWith(':') && t.length < 180) return true;
  if (isBilingualLabel(t)) return true;
  if (isSectionHeader(t)) return false;
  if (t.length <= 90 && !/[.!?]/.test(t) && !/^_{2,}$|^\.{3,}$|^\[.*\]$|^<.*>$|^{{.*}}$/i.test(t)) {
    return true;
  }
  return false;
}

export function isFillableSlotText(text: string): boolean {
  const t = text.trim();
  if (!t) return true;
  if (isHelperHintText(t)) return false;
  if (isDocxLabelText(t)) return false;
  if (isInstructionParagraph(t)) return false;
  if (isSectionHeader(t)) return false;
  if (/^_{2,}$|^\.{3,}$|^\[.*\]$|^<.*>$|^{{.*}}$/i.test(t)) return true;
  if (/^(tbd|n\/a|xxx|pendente|completar|inserir|descrever aqui)$/i.test(t)) return true;
  if (/^\(.*\)$/.test(t) && t.length < 80 && !isHelperHintText(t)) return true;
  return false;
}

function isTableTitleRow(cells: string[]): string | null {
  if (cells.length > 1) return null;
  const nonEmpty = cells.map((c) => c.trim()).filter(Boolean);
  if (nonEmpty.length !== 1) return null;
  const t = nonEmpty[0];
  if (isSectionHeader(t) || isBilingualLabel(t) || /^[A-Z][A-Z0-9\s/&-]{4,}$/.test(t)) return t;
  if (t.length < 120 && !isInstructionParagraph(t) && !isFillableSlotText(t)) return t;
  return null;
}

function isGridHeaderRow(cells: string[]): boolean {
  const nonEmpty = cells.filter((c) => c.trim());
  if (nonEmpty.length < 2) return false;
  return nonEmpty.every(
    (c) => c.trim().length < 100 && !isInstructionParagraph(c) && !isFillableSlotText(c.trim()),
  );
}

function pushParagraphRegion(
  regions: ReportCanvasState['regions'],
  pIdx: number,
  label: string,
  text: string,
  sectionId: string,
) {
  regions.push({
    id: `p-${pIdx}`,
    kind: 'paragraph',
    label: label.slice(0, 200),
    text,
    docxIndex: pIdx,
    docxKind: 'paragraph',
    sectionId,
    missing: !text.trim(),
  });
}

function pushTableCell(
  regions: ReportCanvasState['regions'],
  opts: {
    tableIndex: number;
    rowIdx: number;
    colIdx: number;
    tableId: string;
    tableTitle: string;
    sectionId: string;
    columnLabel?: string;
    label: string;
    text: string;
  },
) {
  const { tableIndex, rowIdx, colIdx, tableId, tableTitle, sectionId, columnLabel, label, text } = opts;
  regions.push({
    id: `t-${tableIndex}-r-${rowIdx}-c-${colIdx}`,
    kind: 'tableCell',
    label: label.slice(0, 200),
    text,
    docxKind: 'tableCell',
    docxTableIndex: tableIndex,
    docxRowIndex: rowIdx,
    docxColIndex: colIdx,
    sectionId,
    tableId,
    tableTitle,
    columnLabel,
    tableRow: rowIdx,
    tableCol: colIdx,
    missing: !text.trim(),
  });
}

function parseTwoColumnTable(
  regions: ReportCanvasState['regions'],
  rows: string[][],
  tableIndex: number,
  tableTitle: string,
  sectionId: string,
  rowOffset: number,
) {
  const tableId = `table-${tableIndex}`;
  rows.forEach((cells, rowIdx) => {
    if (cells.length < 2) return;
    const left = cells[0]?.trim() ?? '';
    const right = cells[1]?.trim() ?? '';
    if (!left || isInstructionParagraph(left) || isSectionHeader(left)) return;
    if (!isDocxLabelText(left)) return;
    if (isInstructionParagraph(right)) return;

    pushTableCell(regions, {
      tableIndex,
      rowIdx: rowOffset + rowIdx,
      colIdx: 1,
      tableId,
      tableTitle,
      sectionId,
      label: left.replace(/:$/, ''),
      text: right,
    });
  });
}

function parseSingleColumnTable(
  regions: ReportCanvasState['regions'],
  rows: string[][],
  tableIndex: number,
  tableTitle: string,
  sectionId: string,
  promptLabel: string,
  rowOffset: number,
) {
  const tableId = `table-${tableIndex}`;
  for (let rowIdx = rows.length - 1; rowIdx >= 0; rowIdx -= 1) {
    const text = rows[rowIdx][0]?.trim() ?? '';
    const absRow = rowOffset + rowIdx;
    if (!text && rowIdx === rows.length - 1) {
      pushTableCell(regions, {
        tableIndex,
        rowIdx: absRow,
        colIdx: 0,
        tableId,
        tableTitle,
        sectionId,
        label: promptLabel || tableTitle,
        text: '',
      });
      return;
    }
    if (isFillableSlotText(text) || (rowIdx > 0 && !isInstructionParagraph(text))) {
      if (rowIdx > 0 || !isInstructionParagraph(rows[0][0] || '')) {
        pushTableCell(regions, {
          tableIndex,
          rowIdx: absRow,
          colIdx: 0,
          tableId,
          tableTitle,
          sectionId,
          label: promptLabel || tableTitle,
          text,
        });
        return;
      }
    }
  }
}

function parseGridTable(
  regions: ReportCanvasState['regions'],
  rows: string[][],
  tableIndex: number,
  tableTitle: string,
  sectionId: string,
  headerRow: string[],
  dataStartRow: number,
) {
  const tableId = `table-${tableIndex}`;
  const headers = headerRow.map((h, i) => h.trim() || `Coluna ${i + 1}`);

  for (let rowIdx = dataStartRow; rowIdx < rows.length; rowIdx += 1) {
    const cells = rows[rowIdx];

    for (let colIdx = 0; colIdx < headers.length; colIdx += 1) {
      const text = cells[colIdx]?.trim() ?? '';
      const columnLabel = headers[colIdx] || `Col ${colIdx + 1}`;
      pushTableCell(regions, {
        tableIndex,
        rowIdx,
        colIdx,
        tableId,
        tableTitle,
        sectionId,
        columnLabel,
        label: `${columnLabel}${rows.length > dataStartRow + 1 ? ` · linha ${rowIdx - dataStartRow + 1}` : ''}`,
        text,
      });
    }
  }
}

function parseDocxTable(
  regions: ReportCanvasState['regions'],
  tblXml: string,
  tableIndex: number,
  sectionId: string,
  precedingParagraph: string,
) {
  const rowXmls = splitBlocks(tblXml, 'tr');
  const rows = rowXmls.map((row) => splitBlocks(row, 'tc').map(extractWtText));
  if (!rows.length) return;

  let tableTitle = precedingParagraph.trim();
  if (isHelperHintText(tableTitle)) tableTitle = '';
  let startRow = 0;

  const titleFromRow = isTableTitleRow(rows[0]);
  if (titleFromRow) {
    tableTitle = titleFromRow;
    startRow = 1;
  }
  if (!tableTitle) tableTitle = `Tabela ${tableIndex + 1}`;

  const sectionForTable = `${sectionId}-${tableIndex}`;

  if (rows.every((r) => r.length <= 2) && rows.some((r) => r.length === 2)) {
    if (!tableTitle || isHelperHintText(tableTitle)) {
      tableTitle = 'Award information / Información de la adjudicación';
    }
    parseTwoColumnTable(regions, rows.slice(startRow), tableIndex, tableTitle, sectionForTable, startRow);
    return;
  }

  if (rows.every((r) => r.length === 1)) {
    const prompt = rows[startRow]?.[0]?.trim() || tableTitle;
    parseSingleColumnTable(regions, rows.slice(startRow), tableIndex, tableTitle, sectionForTable, prompt, startRow);
    return;
  }

  let headerRowIdx = startRow;
  let headerRow = rows[headerRowIdx] || [];
  if (!isGridHeaderRow(headerRow) && rows[headerRowIdx + 1] && isGridHeaderRow(rows[headerRowIdx + 1])) {
    headerRowIdx += 1;
    headerRow = rows[headerRowIdx];
  }

  if (isGridHeaderRow(headerRow)) {
    if (!tableTitle || isHelperHintText(tableTitle)) {
      if (/event|article|media|prensa/i.test(headerRow.join(' '))) {
        tableTitle = 'Media / Press coverage';
      } else if (/activity|outcome|deliverable/i.test(headerRow.join(' '))) {
        tableTitle = 'MONTHLY RELEVANT ACTIVITIES';
      } else {
        tableTitle = tableTitle || `Tabela ${tableIndex + 1}`;
      }
    }
    parseGridTable(
      regions,
      rows,
      tableIndex,
      tableTitle,
      sectionForTable,
      headerRow,
      headerRowIdx + 1,
    );
    return;
  }

  parseTwoColumnTable(regions, rows.slice(startRow), tableIndex, tableTitle, sectionForTable, startRow);
}

export async function parseDocxTemplate(
  buffer: Buffer,
  templateFileId: string,
  fileName: string,
): Promise<ReportCanvasState> {
  const zip = await JSZip.loadAsync(buffer);
  const docXml = await zip.file('word/document.xml')?.async('string');
  if (!docXml) {
    throw new Error('DOCX inválido — falta word/document.xml');
  }

  const regions: ReportCanvasState['regions'] = [];
  const blocks = splitBodyBlocks(docXml);
  let pIdx = 0;
  let tableIndex = 0;
  let currentSection = 'doc';
  let lastParagraph = '';

  for (const block of blocks) {
    if (block.kind === 'paragraph') {
      const text = extractWtText(block.xml);
      if (isSectionHeader(text)) {
        currentSection = text.slice(0, 80).replace(/\s+/g, '-').toLowerCase();
        lastParagraph = text;
        pIdx += 1;
        continue;
      }
      if (isInstructionParagraph(text)) {
        lastParagraph = '';
        pIdx += 1;
        continue;
      }
      lastParagraph = text;
      pIdx += 1;
      continue;
    }

    parseDocxTable(regions, block.xml, tableIndex, currentSection, lastParagraph);
    tableIndex += 1;
    lastParagraph = '';
  }

  if (!regions.length) {
    regions.push({
      id: 'p-0',
      kind: 'paragraph',
      label: 'Conteúdo do informe',
      text: '',
      docxIndex: 0,
      docxKind: 'paragraph',
      sectionId: 'doc',
      missing: true,
    });
  }

  return {
    version: 1,
    parseVersion: TEMPLATE_PARSE_VERSION,
    format: 'docx',
    templateFileId,
    templateFileName: fileName,
    regions,
    sections: buildCanvasSectionsFromRegions(regions),
  };
}

function buildSheetGrid(sheet: XLSX.WorkSheet, range: XLSX.Range): string[][] {
  const grid: string[][] = [];
  for (let r = range.s.r; r <= range.e.r; r += 1) {
    const row: string[] = [];
    for (let c = range.s.c; c <= range.e.c; c += 1) {
      const addr = XLSX.utils.encode_cell({ r, c });
      const cell = sheet[addr];
      row.push(cell?.v != null ? decodeXmlText(String(cell.v)) : '');
    }
    grid.push(row);
  }
  return grid;
}

function resolveCellLabel(grid: string[][], r: number, c: number): string | null {
  const left = c > 0 ? grid[r][c - 1]?.trim() : '';
  const above = r > 0 ? grid[r - 1][c]?.trim() : '';
  const aboveLeft = r > 0 && c > 0 ? grid[r - 1][c - 1]?.trim() : '';

  for (const candidate of [left, above, aboveLeft]) {
    if (candidate && isDocxLabelText(candidate) && !isSectionHeader(candidate)) {
      return candidate.replace(/:$/, '');
    }
  }

  if (left && left.length <= 100 && !isFillableSlotText(left) && !isInstructionParagraph(left)) {
    return left.replace(/:$/, '');
  }

  if (above && above.length <= 100 && !isFillableSlotText(above) && !isInstructionParagraph(above)) {
    return above.replace(/:$/, '');
  }

  return null;
}

export async function parseXlsxTemplate(
  buffer: Buffer,
  templateFileId: string,
  fileName: string,
): Promise<ReportCanvasState> {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const regions: ReportCanvasState['regions'] = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet?.['!ref']) continue;
    const range = XLSX.utils.decode_range(sheet['!ref']);
    const grid = buildSheetGrid(sheet, range);

    for (let ri = 0; ri < grid.length; ri += 1) {
      const row = grid[ri];
      for (let ci = 0; ci < row.length; ci += 1) {
        const text = row[ci]?.trim() ?? '';
        if (!isFillableSlotText(text)) continue;

        const label = resolveCellLabel(grid, ri, ci);
        if (!label) continue;

        if (isSectionHeader(label) || isInstructionParagraph(label) || isHelperHintText(label)) {
          continue;
        }

        const r = range.s.r + ri;
        const c = range.s.c + ci;
        const addr = XLSX.utils.encode_cell({ r, c });

        regions.push({
          id: `${sheetName}!${addr}`,
          kind: 'cell',
          sheet: sheetName,
          row: r,
          col: c,
          label,
          text: text.trim() ? text : '',
          sectionId: sheetName,
          missing: !text.trim(),
        });
      }
    }
  }

  if (!regions.length) {
    const sn = workbook.SheetNames[0] || 'Sheet1';
    regions.push({
      id: `${sn}!A1`,
      kind: 'cell',
      sheet: sn,
      row: 0,
      col: 0,
      label: `${sn} · A1`,
      text: '',
      sectionId: sn,
      missing: true,
    });
  }

  return {
    version: 1,
    parseVersion: TEMPLATE_PARSE_VERSION,
    format: 'xlsx',
    templateFileId,
    templateFileName: fileName,
    regions,
    sections: buildCanvasSectionsFromRegions(regions),
  };
}

export async function parseReportTemplate(
  buffer: Buffer,
  fileName: string,
  templateFileId: string,
  mimeType?: string | null,
): Promise<ReportCanvasState> {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.xlsx') || lower.endsWith('.xls') || mimeType?.includes('spreadsheet')) {
    return parseXlsxTemplate(buffer, templateFileId, fileName);
  }
  if (lower.endsWith('.docx') || mimeType?.includes('wordprocessingml')) {
    return parseDocxTemplate(buffer, templateFileId, fileName);
  }
  throw new Error('Formato não suportado — use .docx ou .xlsx');
}

export function detectCanvasFormat(fileName: string, mimeType?: string | null): 'docx' | 'xlsx' | null {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.xlsx') || lower.endsWith('.xls') || mimeType?.includes('spreadsheet')) return 'xlsx';
  if (lower.endsWith('.docx') || mimeType?.includes('wordprocessingml')) return 'docx';
  return null;
}
