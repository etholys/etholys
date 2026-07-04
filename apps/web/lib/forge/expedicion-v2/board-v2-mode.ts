/** Tabuleiro em modo V2: movimentos Eco vão ao ledger V2 (eventos only). */

import type { GameSpecV1 } from '@/lib/forge/schemas/game-spec-v1';

export function usesV2Ledger(raw: Record<string, unknown>): boolean {
  return raw.v2FinancialMode === true || raw.v2Team != null;
}

export function adjustEcoCredits(current: number, delta: number, useV2: boolean): number {
  if (useV2) return current;
  return Math.max(0, current + delta);
}

/** Detecta game spec da Expedición Sostenible V2. */
export function isExpedicionV2Spec(spec: GameSpecV1): boolean {
  const ext = spec as GameSpecV1 & { expedicionV2?: boolean };
  if (ext.expedicionV2 === true) return true;
  return spec.board?.spaces === 20 && /expedici/i.test(spec.title ?? '');
}

export function withExpedicionV2RoomFlags(
  state: Record<string, unknown>
): Record<string, unknown> {
  return { ...state, v2FinancialMode: true };
}
