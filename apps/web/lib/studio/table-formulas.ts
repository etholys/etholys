/**
 * Fórmulas Excel-lite — SUM, AVG, MIN, MAX em células de tabela Markdown.
 */
import type { StudioTableGrid } from '@/lib/studio/table-markdown';

function colLetter(col: number): string {
  let s = '';
  let n = col;
  do {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return s;
}

function parseCellRef(ref: string): { row: number; col: number } | null {
  const m = ref.trim().toUpperCase().match(/^([A-Z]+)(\d+)$/);
  if (!m) return null;
  const letters = m[1]!;
  let col = 0;
  for (let i = 0; i < letters.length; i++) {
    col = col * 26 + (letters.charCodeAt(i) - 64);
  }
  col -= 1;
  const row = parseInt(m[2]!, 10) - 1;
  if (!Number.isFinite(row) || row < 0 || col < 0) return null;
  return { row, col };
}

function cellNumericValue(grid: StudioTableGrid, row: number, col: number, depth = 0): number | null {
  if (depth > 8) return null;
  if (row === 0) return null;
  const dataRow = row - 1;
  if (dataRow < 0 || dataRow >= grid.rows.length || col < 0 || col >= grid.headers.length) {
    return null;
  }
  const raw = grid.rows[dataRow]![col] ?? '';
  if (String(raw).trim().startsWith('=')) {
    const v = evaluateTableFormula(String(raw), grid, depth + 1);
    if (v == null || v === '') return null;
    const n = Number(String(v).replace(/[^\d.-]/g, ''));
    return Number.isFinite(n) ? n : null;
  }
  const n = Number(String(raw).replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? n : null;
}

function expandRange(grid: StudioTableGrid, range: string): Array<{ row: number; col: number }> {
  void grid;
  const parts = range.split(':').map((s) => s.trim());
  if (parts.length === 1) {
    const ref = parseCellRef(parts[0]!);
    return ref ? [ref] : [];
  }
  if (parts.length !== 2) return [];
  const a = parseCellRef(parts[0]!);
  const b = parseCellRef(parts[1]!);
  if (!a || !b) return [];
  const cells: Array<{ row: number; col: number }> = [];
  for (let r = Math.min(a.row, b.row); r <= Math.max(a.row, b.row); r++) {
    for (let c = Math.min(a.col, b.col); c <= Math.max(a.col, b.col); c++) {
      cells.push({ row: r, col: c });
    }
  }
  return cells;
}

function aggregate(
  fn: 'SUM' | 'AVG' | 'MIN' | 'MAX',
  grid: StudioTableGrid,
  args: string,
  depth: number,
): number | null {
  const refs = args.split(/[,;]/).flatMap((part) => expandRange(grid, part.trim()));
  const nums: number[] = [];
  for (const ref of refs) {
    const n = cellNumericValue(grid, ref.row, ref.col, depth);
    if (n != null) nums.push(n);
  }
  if (!nums.length) return null;
  switch (fn) {
    case 'SUM':
      return nums.reduce((a, b) => a + b, 0);
    case 'AVG':
      return nums.reduce((a, b) => a + b, 0) / nums.length;
    case 'MIN':
      return Math.min(...nums);
    case 'MAX':
      return Math.max(...nums);
  }
}

export function evaluateTableFormula(
  formula: string,
  grid: StudioTableGrid,
  depth = 0,
): string | null {
  const raw = String(formula || '').trim();
  if (!raw.startsWith('=')) return null;
  const expr = raw.slice(1).trim();
  const fnMatch = expr.match(/^(SUM|AVG|MIN|MAX)\(([^)]*)\)$/i);
  if (fnMatch) {
    const result = aggregate(fnMatch[1]!.toUpperCase() as 'SUM' | 'AVG' | 'MIN' | 'MAX', grid, fnMatch[2]!, depth);
    if (result == null) return '#ERR';
    return Number.isInteger(result) ? String(result) : result.toFixed(2).replace(/\.?0+$/, '');
  }
  return null;
}

export function isTableFormula(value: string): boolean {
  return String(value || '').trim().startsWith('=');
}

export function displayTableCellValue(value: string, grid: StudioTableGrid): string {
  if (!isTableFormula(value)) return value;
  return evaluateTableFormula(value, grid) ?? value;
}

export function tableCellRef(dataRowIndex: number, colIndex: number): string {
  return `${colLetter(colIndex)}${dataRowIndex + 2}`;
}
