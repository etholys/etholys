/**
 * Uma varredura mundial pode passar dos 8 min. Só está morta se deixar de
 * gravar progresso (updatedAt). O POST seguinte pode então abrir outra.
 */
export const DISCOVERY_RUN_STALE_IDLE_MS = 25 * 60 * 1000;

export function isDiscoveryRunStale(
  run: { updatedAt: Date | string; status?: string | null },
  now = Date.now(),
): boolean {
  if (run.status && run.status !== 'running') return false;
  const updated = new Date(run.updatedAt).getTime();
  if (!Number.isFinite(updated)) return false;
  return now - updated > DISCOVERY_RUN_STALE_IDLE_MS;
}
