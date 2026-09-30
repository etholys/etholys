/** Parse CSV / TSV / "|" rows for funder import preview. */

import { isLikelyDuplicateFund, normalizeFundIdentity } from '@/lib/opportunity/scan-filters';

export type FunderImportRow = {
  rowIndex: number;
  name: string;
  institution: string;
  linkOficial?: string;
  type?: string;
  notes?: string;
  issues: string[];
  ok: boolean;
  /** Id do fundo no catálogo quando dedupe encontra match. */
  duplicateOfFundId?: string;
};

export type CatalogFundRef = {
  id?: string;
  name: string;
  institution?: string;
  linkOficial?: string | null;
};

/** Normaliza URL para comparação de dedupe (host + path sem trailing slash). */
export function normalizeImportUrl(url: string | null | undefined): string {
  if (!url?.trim()) return '';
  try {
    const u = new URL(url.trim());
    const host = u.hostname.replace(/^www\./i, '').toLowerCase();
    const path = u.pathname.replace(/\/+$/, '') || '';
    return `${host}${path}`.toLowerCase();
  } catch {
    return url.trim().toLowerCase().replace(/\/+$/, '');
  }
}

/**
 * Marca linhas que já existem no catálogo (nome ou URL oficial).
 * Não inventa fundos — só anota issues `duplicate_catalog`.
 */
export function annotateImportAgainstCatalog(
  rows: FunderImportRow[],
  catalog: CatalogFundRef[],
): FunderImportRow[] {
  if (!catalog.length) return rows;
  const byUrl = new Map<string, CatalogFundRef>();
  for (const f of catalog) {
    const key = normalizeImportUrl(f.linkOficial);
    if (key) byUrl.set(key, f);
  }

  return rows.map((row) => {
    const issues = [...row.issues];
    let duplicateOfFundId = row.duplicateOfFundId;

    const urlKey = normalizeImportUrl(row.linkOficial);
    const urlHit = urlKey ? byUrl.get(urlKey) : undefined;
    if (urlHit) {
      if (!issues.includes('duplicate_catalog')) issues.push('duplicate_catalog');
      duplicateOfFundId = urlHit.id ?? duplicateOfFundId;
    } else if (
      isLikelyDuplicateFund(
        { name: row.name, institution: row.institution },
        catalog.map((f) => ({ name: f.name, institution: f.institution })),
      )
    ) {
      if (!issues.includes('duplicate_catalog')) issues.push('duplicate_catalog');
      const match = catalog.find(
        (f) =>
          normalizeFundIdentity(f.name) === normalizeFundIdentity(row.name) ||
          isLikelyDuplicateFund(
            { name: row.name, institution: row.institution },
            [{ name: f.name, institution: f.institution }],
          ),
      );
      duplicateOfFundId = match?.id ?? duplicateOfFundId;
    }

    return {
      ...row,
      issues,
      duplicateOfFundId,
      // duplicate_catalog não invalida a linha — confirm skip-a.
      ok: row.ok,
    };
  });
}

export function isImportDuplicate(row: FunderImportRow): boolean {
  return row.issues.includes('duplicate_catalog');
}

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
