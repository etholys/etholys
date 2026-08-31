/**
 * Importação em massa de MIPYMEs para um contrato AT.
 * Formatos: uma empresa por linha; opcional CSV com nome, sigla, setor.
 */

import { normalizeEconomicSectorId } from './nexus-economic-sectors';

export type BulkMipymeRow = {
  line: number;
  name: string;
  shortName?: string;
  sectorId?: string | null;
};

export type BulkMipymeParseResult = {
  rows: BulkMipymeRow[];
  skipped: number;
  errors: string[];
};

function splitLine(line: string): string[] {
  if (line.includes(';')) return line.split(';').map((c) => c.trim());
  if (line.includes('\t')) return line.split('\t').map((c) => c.trim());
  return line.split(',').map((c) => c.trim());
}

function shortFromName(name: string): string {
  const short =
    name
      .split(/\s+/)
      .slice(0, 3)
      .map((w) => w[0]?.toUpperCase() || '')
      .join('')
      .slice(0, 12) || name.slice(0, 12);
  return short;
}

export function parseBulkMipymeText(raw: string, defaultSectorId?: string | null): BulkMipymeParseResult {
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const rows: BulkMipymeRow[] = [];
  const errors: string[] = [];
  let skipped = 0;
  let startIdx = 0;

  if (lines[0] && /^(nombre|name|empresa|mipyme)\b/i.test(lines[0])) {
    startIdx = 1;
  }

  for (let i = startIdx; i < lines.length; i++) {
    const line = lines[i]!;
    const lineNo = i + 1;
    const parts = splitLine(line).filter(Boolean);
    if (parts.length === 0) continue;

    const name = (parts[0] || '').slice(0, 200);
    if (name.length < 2) {
      skipped += 1;
      errors.push(`Línea ${lineNo}: nombre demasiado corto.`);
      continue;
    }

    let shortName = shortFromName(name);
    let sectorId: string | null = defaultSectorId ? normalizeEconomicSectorId(defaultSectorId) : null;

    if (parts.length >= 3) {
      shortName = parts[1]!.slice(0, 40) || shortName;
      sectorId = normalizeEconomicSectorId(parts[2]!) || sectorId;
    } else if (parts.length === 2) {
      const maybeSector = normalizeEconomicSectorId(parts[1]!);
      if (maybeSector) sectorId = maybeSector;
      else shortName = parts[1]!.slice(0, 40) || shortName;
    }

    const key = name.toLowerCase();
    if (rows.some((r) => r.name.toLowerCase() === key)) {
      skipped += 1;
      continue;
    }

    rows.push({ line: lineNo, name, shortName, sectorId });
  }

  return { rows, skipped, errors };
}
