/**
 * Orçamento por varredura FundHub — o tecto é USD, não quantidade de candidatos.
 * Default $1.00 para medir custo real do produto sem caps artificiais de yield.
 */

import { getActiveLlmUsage } from '@/lib/llm-usage';

function envFloat(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/** Tecto USD por varredura (tokens + web_search estimados). */
export function scanBudgetUsd(): number {
  return envFloat('FUNDHUB_SCAN_BUDGET_USD', 1);
}

/** Reserva para o passo de estruturação JSON no fim. */
export function structureReserveUsd(): number {
  return envFloat('FUNDHUB_STRUCTURE_RESERVE_USD', 0.18);
}

export function spentUsdSoFar(): number {
  return getActiveLlmUsage()?.estimatedCostUsd ?? 0;
}

export function remainingScanBudgetUsd(reserve = 0): number {
  return Math.max(0, scanBudgetUsd() - spentUsdSoFar() - Math.max(0, reserve));
}

/** Pode lançar outro passo caro (pack web / 2º pass) sem estourar o tecto. */
export function canAffordDiscoveryStep(opts?: {
  /** Custo estimado do próximo passo (default ~$0.22 pack Sonnet+web). */
  estimatedStepUsd?: number;
  /** Guardar reserva para estrutura (default true). */
  keepStructureReserve?: boolean;
}): boolean {
  const step = opts?.estimatedStepUsd ?? 0.22;
  const reserve = opts?.keepStructureReserve === false ? 0 : structureReserveUsd();
  return remainingScanBudgetUsd(reserve) >= step * 0.85;
}

export type BudgetStopReason = 'ok' | 'budget_exhausted';

export function budgetStatus(): { spent: number; budget: number; remaining: number; stop: BudgetStopReason } {
  const budget = scanBudgetUsd();
  const spent = spentUsdSoFar();
  const remaining = Math.max(0, budget - spent);
  return {
    spent,
    budget,
    remaining,
    stop: remaining < 0.05 ? 'budget_exhausted' : 'ok',
  };
}
