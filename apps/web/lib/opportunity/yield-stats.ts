/** Yield / custo da descoberta — UI Buscar (R2). */

export type YieldRunInput = {
  id: string;
  status: string;
  created?: number | null;
  scanned?: number | null;
  estimatedCostUsd?: number | null;
  startedAt?: string | Date | null;
};

export type YieldInboxInput = {
  pendingOpen: number;
  pendingReference: number;
  later: number;
  catalogTotal: number;
};

export type YieldSnapshot = {
  lastRunCostUsd: number | null;
  lastRunCandidates: number;
  costPerCandidateUsd: number | null;
  avgCostLastRunsUsd: number | null;
  runsWithCost: number;
  inboxOpen: number;
  inboxReference: number;
  inboxLater: number;
  catalogTotal: number;
};

export function buildYieldSnapshot(
  runs: YieldRunInput[],
  inbox: YieldInboxInput,
): YieldSnapshot {
  const completed = runs.filter((r) => r.status === 'completed' || r.status === 'failed');
  const withCost = completed.filter(
    (r) => typeof r.estimatedCostUsd === 'number' && (r.estimatedCostUsd as number) >= 0,
  );
  const last = completed[0];
  const lastCost =
    last && typeof last.estimatedCostUsd === 'number' ? last.estimatedCostUsd : null;
  const lastCandidates = last?.created ?? last?.scanned ?? 0;
  const costPer =
    lastCost != null && lastCandidates > 0
      ? Math.round((lastCost / lastCandidates) * 1_000_000) / 1_000_000
      : null;
  const avg =
    withCost.length > 0
      ? Math.round(
          (withCost.reduce((s, r) => s + (r.estimatedCostUsd as number), 0) / withCost.length) *
            1_000_000,
        ) / 1_000_000
      : null;

  return {
    lastRunCostUsd: lastCost,
    lastRunCandidates: lastCandidates,
    costPerCandidateUsd: costPer,
    avgCostLastRunsUsd: avg,
    runsWithCost: withCost.length,
    inboxOpen: inbox.pendingOpen,
    inboxReference: inbox.pendingReference,
    inboxLater: inbox.later,
    catalogTotal: inbox.catalogTotal,
  };
}

export function formatUsd(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—';
  if (n < 0.01 && n > 0) return `$${n.toFixed(4)}`;
  return `$${n.toFixed(2)}`;
}
