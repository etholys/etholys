/**
 * Histórico leve do diagnóstico NEXUS (localStorage por âmbito empresa/rede).
 * Sem migrações Prisma; serve para comparar corridas ao longo do tempo.
 */

import type { DiagnosticResult } from '@/lib/nexus-diagnostic-quiz';

const STORAGE_VERSION = 1;
const MAX_ENTRIES = 40;
const prefix = () => `nexus_dx_hist_v${STORAGE_VERSION}`;

export type NexusDiagnosisScope = {
  companyId: string | null;
  networkId: string | null;
};

export type NexusDiagnosisSnapshot = {
  id: string;
  savedAt: string;
  scope: NexusDiagnosisScope;
  overallScore: number;
  sectorScores: Array<{ slug: string; name: string; score: number }>;
  weakestSectorNames: string[];
};

function scopeKey(scope: NexusDiagnosisScope): string {
  const c = scope.companyId || 'noc';
  const n = scope.networkId || 'nonet';
  return `${c}__${n}`;
}

export function storageKey(scope: NexusDiagnosisScope): string {
  return `${prefix()}::${scopeKey(scope)}`;
}

export function loadDiagnosisHistory(scope: NexusDiagnosisScope): NexusDiagnosisSnapshot[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(storageKey(scope));
    if (!raw) return [];
    const arr = JSON.parse(raw) as NexusDiagnosisSnapshot[];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function writeHistory(scope: NexusDiagnosisScope, items: NexusDiagnosisSnapshot[]) {
  try {
    localStorage.setItem(storageKey(scope), JSON.stringify(items.slice(0, MAX_ENTRIES)));
  } catch {
    /* quota */
  }
}

export function appendDiagnosisSnapshot(
  scope: NexusDiagnosisScope,
  result: DiagnosticResult,
): NexusDiagnosisSnapshot | null {
  if (typeof window === 'undefined') return null;
  const sectorScores = result.sectors.map((s) => ({
    slug: s.sectorSlug,
    name: s.sectorName,
    score: s.score,
  }));
  const snap: NexusDiagnosisSnapshot = {
    id: `dx-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    savedAt: new Date().toISOString(),
    scope,
    overallScore: result.overall,
    sectorScores,
    weakestSectorNames: result.weakestSectors.slice(0, 4).map((s) => s.sectorName),
  };

  const prev = loadDiagnosisHistory(scope);
  const next = [snap, ...prev.filter((x) => x.id !== snap.id)].slice(0, MAX_ENTRIES);
  writeHistory(scope, next);
  return snap;
}

export function removeDiagnosisSnapshot(scope: NexusDiagnosisScope, id: string): void {
  const filtered = loadDiagnosisHistory(scope).filter((x) => x.id !== id);
  writeHistory(scope, filtered);
}

export function exportSnapshotsMarkdown(scope: NexusDiagnosisScope, items: NexusDiagnosisSnapshot[], title: string): string {
  const lines: string[] = [`# ${title}`, '', `Gerado em ${new Date().toISOString().slice(0, 10)}`, ''];
  for (const s of items) {
    lines.push(`## ${s.savedAt.slice(0, 10)} — score global ${s.overallScore}/100`);
    lines.push('');
    lines.push(
      '| Sector | Score |',
      '|--------|------:|',
      ...s.sectorScores.map((x) => `| ${x.name} | ${x.score} |`),
    );
    lines.push('');
    if (s.weakestSectorNames.length > 0) {
      lines.push(`**Atenção:** ${s.weakestSectorNames.join(', ')}`);
      lines.push('');
    }
  }
  return lines.join('\n');
}
