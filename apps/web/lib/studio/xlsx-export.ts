/**
 * Export XLSX (Excel) — tabelas markdown → OOXML spreadsheet via JSZip.
 */
import type { StudioCanvasState } from '@/lib/studio/types';
import { parseMarkdownTable } from '@/lib/studio/table-markdown';
import { displayTableCellValue, isTableFormula } from '@/lib/studio/table-formulas';

function escXml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function colName(n: number): string {
  let s = '';
  let x = n;
  do {
    s = String.fromCharCode(65 + (x % 26)) + s;
    x = Math.floor(x / 26) - 1;
  } while (x >= 0);
  return s;
}

function cellRef(row: number, col: number): string {
  return `${colName(col)}${row + 1}`;
}

function cellXml(val: string, grid: { headers: string[]; rows: string[][] }, ri: number, c: number): string {
  const display = displayTableCellValue(val, grid);
  if (isTableFormula(val)) {
    const n = Number(String(display).replace(/[^\d.-]/g, ''));
    if (Number.isFinite(n) && display !== '#ERR') {
      return `<c r="${cellRef(ri + 1, c)}"><v>${n}</v></c>`;
    }
    return `<c r="${cellRef(ri + 1, c)}" t="inlineStr"><is><t>${escXml(display)}</t></is></c>`;
  }
  const num = Number(String(val).replace(/[^\d.-]/g, ''));
  const isNum =
    val.trim() !== '' &&
    Number.isFinite(num) &&
    /^[\d.,\-+%$€\s]*[\d.,]+[\d%$€\s]*$/.test(val.trim());
  if (isNum) return `<c r="${cellRef(ri + 1, c)}"><v>${num}</v></c>`;
  return `<c r="${cellRef(ri + 1, c)}" t="inlineStr"><is><t>${escXml(val)}</t></is></c>`;
}

function sheetXml(name: string, headers: string[], rows: string[][]): string {
  void name;
  const grid = { headers, rows };
  const maxRow = rows.length;
  const maxCol = Math.max(headers.length, 1) - 1;
  const dim = `A1:${cellRef(maxRow, maxCol)}`;

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <dimension ref="${dim}"/>
  <sheetViews><sheetView workbookViewId="0"/></sheetViews>
  <sheetFormatPr defaultRowHeight="15"/>
  <sheetData>
    <row r="1">${headers.map((h, c) => `<c r="${cellRef(0, c)}" t="inlineStr" s="1"><is><t>${escXml(h)}</t></is></c>`).join('')}</row>
    ${rows.map((row, ri) => `<row r="${ri + 2}">${row.map((val, c) => cellXml(val, grid, ri, c)).join('')}</row>`).join('\n    ')}
  </sheetData>
</worksheet>`;
}

export type StudioXlsxSheet = { name: string; headers: string[]; rows: string[][] };

/** Extrai todas as tabelas do canvas para sheets Excel. */
export function extractStudioXlsxSheets(canvas: StudioCanvasState): StudioXlsxSheet[] {
  const sheets: StudioXlsxSheet[] = [];
  const pages = canvas.pages.slice().sort((a, b) => a.order - b.order);

  for (const page of pages) {
    for (const block of page.blocks.slice().sort((a, b) => a.order - b.order)) {
      if (block.kind !== 'table') continue;
      const grid = parseMarkdownTable(block.text || '');
      if (!grid) continue;
      const baseName = page.title || `Sheet ${sheets.length + 1}`;
      const name = sheets.filter((s) => s.name.startsWith(baseName.slice(0, 20))).length
        ? `${baseName.slice(0, 18)}_${sheets.length + 1}`
        : baseName.slice(0, 31);
      sheets.push({
        name: name.replace(/[\\/*?:\[\]]/g, '_') || `Table${sheets.length + 1}`,
        headers: grid.headers,
        rows: grid.rows,
      });
    }
  }

  if (!sheets.length) {
    sheets.push({
      name: 'Dados',
      headers: ['Coluna A', 'Coluna B', 'Coluna C'],
      rows: [['', '', '']],
    });
  }

  return sheets;
}

export async function studioCanvasToXlsxBuffer(
  title: string,
  canvas: StudioCanvasState,
): Promise<Buffer> {
  void title;
  const JSZip = (await import('jszip')).default;
  const zip = new JSZip();
  const sheets = extractStudioXlsxSheets(canvas);

  const sheetEntries = sheets.map((s, i) => ({
    id: i + 1,
    name: s.name,
    xml: sheetXml(s.name, s.headers, s.rows),
  }));

  zip.folder('xl')?.folder('worksheets')?.file(
    'styles.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>
  <fills count="1"><fill><patternFill patternType="none"/></fill></fills>
  <borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs>
</styleSheet>`,
  );

  for (const sh of sheetEntries) {
    zip.folder('xl')?.folder('worksheets')?.file(`sheet${sh.id}.xml`, sh.xml);
    zip
      .folder('xl')
      ?.folder('worksheets')
      ?.folder('_rels')
      ?.file(
        `sheet${sh.id}.xml.rels`,
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>`,
      );
  }

  const workbookSheets = sheetEntries
    .map(
      (sh) =>
        `<sheet name="${escXml(sh.name)}" sheetId="${sh.id}" r:id="rId${sh.id}"/>`,
    )
    .join('');
  const workbookRels = sheetEntries
    .map(
      (sh) =>
        `<Relationship Id="rId${sh.id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${sh.id}.xml"/>`,
    )
    .join('\n  ');

  zip.folder('xl')?.file(
    'workbook.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>${workbookSheets}</sheets>
</workbook>`,
  );

  zip.folder('xl')?.folder('_rels')?.file(
    'workbook.xml.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  ${workbookRels}
  <Relationship Id="rId${sheetEntries.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`,
  );

  const overrides = sheetEntries
    .map(
      (sh) =>
        `<Override PartName="/xl/worksheets/sheet${sh.id}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
    )
    .join('\n  ');

  zip.file(
    '[Content_Types].xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
  ${overrides}
</Types>`,
  );

  zip.folder('_rels')?.file(
    '.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`,
  );

  const buf = await zip.generateAsync({ type: 'nodebuffer' });
  return Buffer.from(buf);
}
