/**
 * Custo da varredura FundHub.
 * Fable ($10/$50 / MTok) + web_search ($10 / 1k) esgota o orçamento em poucos scans.
 * Sonnet 4.6 ($3/$15) é o default rentável; Fable só se OPT-IN explícito.
 */
export const FUNDHUB_DISCOVERY_MODEL = 'claude-sonnet-4-6';
export const FUNDHUB_SCAN_FALLBACK_MODEL = 'claude-sonnet-4-6';
/** Só usar Fable se ANTHROPIC permitir e FUNDHUB_USE_FABLE=1. */
export const FUNDHUB_PREMIUM_MODEL = 'claude-fable-5-1';

export function fundhubScoutModel(): string {
  const wantFable = process.env.FUNDHUB_USE_FABLE?.trim() === '1';
  return wantFable ? FUNDHUB_PREMIUM_MODEL : FUNDHUB_DISCOVERY_MODEL;
}
