import { AGRICULTURE_MATRIX } from './agriculture';
import { AGROINDUSTRY_MATRIX } from './agroindustry';
import { CMM_MATURITY_OPTIONS, type SectorMatrix, type SectorMatrixItem } from './types';
import type { DiagnosticDepth } from '../nexus-incubation-program';

const BY_SECTOR: Record<string, SectorMatrix> = {
  agriculture: AGRICULTURE_MATRIX,
  agroindustry: AGROINDUSTRY_MATRIX,
};

export function getSectorMatrix(sectorId: string | null | undefined): SectorMatrix | null {
  if (!sectorId) return null;
  return BY_SECTOR[sectorId] || null;
}

export function hasDeepSectorMatrix(sectorId: string | null | undefined): boolean {
  return Boolean(getSectorMatrix(sectorId));
}

function matrixCap(depth: DiagnosticDepth, total: number): number {
  switch (depth) {
    case 'screening':
      return Math.min(10, total);
    case 'standard':
      return Math.min(18, total);
    case 'deep':
      return Math.min(26, total);
    case 'exhaustive':
      return total;
  }
}

function pickBalanced(items: SectorMatrixItem[], take: number): SectorMatrixItem[] {
  if (take >= items.length) return items;
  const byBlock = new Map<string, SectorMatrixItem[]>();
  for (const it of items) {
    const arr = byBlock.get(it.blockId) || [];
    arr.push(it);
    byBlock.set(it.blockId, arr);
  }
  const blocks = [...byBlock.keys()];
  const picked: SectorMatrixItem[] = [];
  let round = 0;
  while (picked.length < take) {
    let added = false;
    for (const b of blocks) {
      const arr = byBlock.get(b)!;
      if (round < arr.length && picked.length < take) {
        picked.push(arr[round]!);
        added = true;
      }
    }
    if (!added) break;
    round += 1;
  }
  return picked;
}

export type MatrixDxShape = {
  id: string;
  sectorId: string;
  source: 'base';
  section: 'sector';
  pillarSlug: string;
  areaName: string;
  prompt: { es: string; pt: string; en: string };
  help: { es: string; pt: string; en: string };
  options: typeof CMM_MATURITY_OPTIONS;
  weight: number;
};

export function matrixItemsToDxQuestions(sectorId: string, depth: DiagnosticDepth): MatrixDxShape[] {
  const matrix = getSectorMatrix(sectorId);
  if (!matrix) return [];
  const take = matrixCap(depth, matrix.items.length);
  const items = pickBalanced(matrix.items, take);
  return items.map((it) => ({
    id: it.id,
    sectorId,
    source: 'base' as const,
    section: 'sector' as const,
    pillarSlug: it.pillarSlug,
    areaName: it.areaName.es,
    prompt: it.prompt,
    help: {
      es: `${it.help.es} · Nivel 5: ${it.level5.es}`,
      pt: `${it.help.pt} · Nível 5: ${it.level5.pt}`,
      en: `${it.help.en} · Level 5: ${it.level5.en}`,
    },
    options: CMM_MATURITY_OPTIONS,
    weight: it.weight,
  }));
}

export { CMM_MATURITY_OPTIONS, AGRICULTURE_MATRIX, AGROINDUSTRY_MATRIX };
