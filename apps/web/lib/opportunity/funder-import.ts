/** Parse CSV / TSV / "|" rows for funder import preview. */

export type FunderImportRow = {
  rowIndex: number;
  name: string;
  institution: string;
  linkOficial?: string;
  type?: string;
  notes?: string;
  issues: string[];
  ok: boolean;
};

/** Turn a sheet matrix (e.g. from xlsx) into the same text parser input. */
export function matrixToImportText(matrix: unknown[][]): string {
  return matrix
    .map((row) =>
      (Array.isArray(row) ? row : [])
        .map((cell) => String(cell ?? '').replace(/\r?\n/g, ' ').trim())
        .join('\t'),
    )
    .filter((line) => line.replace(/\t/g, '').trim())
    .join('\n');
}

function splitLine(line: string): string[] {
  if (line.includes('\t')) return line.split('\t').map((s) => s.trim());
  if (line.includes('|')) return line.split('|').map((s) => s.trim());
  // CSV simple (no nested quotes for v1)
  if (line.includes(';')) return line.split(';').map((s) => s.trim());
  return line.split(',').map((s) => s.trim());
}

function looksLikeHeader(cells: string[]): boolean {
  const joined = cells.join(' ').toLowerCase();
  return /nome|name|fondo|fund|instituc|url|link|tipo|type/.test(joined);
}

export function parseFunderImportText(raw: string): FunderImportRow[] {
  const lines = raw
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (!lines.length) return [];

  let start = 0;
  const first = splitLine(lines[0]);
  if (looksLikeHeader(first)) start = 1;

  const rows: FunderImportRow[] = [];
  for (let i = start; i < lines.length; i++) {
    const cells = splitLine(lines[i]);
    const name = (cells[0] || '').slice(0, 300);
    const institution = (cells[1] || cells[0] || '').slice(0, 200);
    const linkOficial = (cells[2] || '').slice(0, 800) || undefined;
    const type = (cells[3] || 'Grant').slice(0, 40);
    const notes = (cells[4] || '').slice(0, 500) || undefined;
    const issues: string[] = [];
    if (!name) issues.push('missing_name');
    if (!institution) issues.push('missing_institution');
    if (linkOficial && !/^https?:\/\//i.test(linkOficial)) issues.push('url_needs_http');
    rows.push({
      rowIndex: i + 1,
      name,
      institution,
      linkOficial,
      type,
      notes,
      issues,
      ok: issues.filter((x) => x === 'missing_name' || x === 'missing_institution').length === 0,
    });
  }
  return rows.slice(0, 500);
}
