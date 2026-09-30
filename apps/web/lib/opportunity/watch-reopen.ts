/**
 * R2 — relógio robusto: detectar reabertura de janela em programas com watchOpen.
 * Pure helpers (sem DB / notificações).
 */

export type WatchFundStatus = 'open' | 'closed' | 'seasonal' | 'reference' | string;

const OPEN_STATUSES = new Set(['open', 'open_now', 'rolling']);
const WAITING_STATUSES = new Set(['closed', 'seasonal', 'reference', 'waiting']);

export function isOpenWindowStatus(status: string | null | undefined): boolean {
  if (!status) return false;
  return OPEN_STATUSES.has(status.trim().toLowerCase());
}

export function isWaitingWindowStatus(status: string | null | undefined): boolean {
  if (!status) return false;
  return WAITING_STATUSES.has(status.trim().toLowerCase());
}

/**
 * True quando o fundo passa de fechado/sazonal/referência → aberto.
 * firstSeenOpen: se nunca vimos estado e já está open, não notificar (evitar spam ao ligar o relógio).
 */
export function isWindowReopen(opts: {
  previousStatus?: string | null;
  nextStatus: string;
  /** Se true, o utilizador acabou de ligar o watch com fundo já aberto — notificar só se pedir. */
  watchJustEnabled?: boolean;
  notifyOnEnableWhileOpen?: boolean;
}): boolean {
  const nextOpen = isOpenWindowStatus(opts.nextStatus);
  if (!nextOpen) return false;

  if (opts.watchJustEnabled) {
    return Boolean(opts.notifyOnEnableWhileOpen);
  }

  const prev = opts.previousStatus?.trim().toLowerCase() ?? '';
  if (!prev) {
    // Sem histórico: não tratar como "reabriu" — só gravar lastSeen.
    return false;
  }
  if (isOpenWindowStatus(prev)) return false;
  return isWaitingWindowStatus(prev) || prev === 'unknown';
}

export type WatchReopenDecision = {
  shouldNotify: boolean;
  nextLastSeenStatus: string;
  reason: 'reopened' | 'enabled_while_open' | 'still_waiting' | 'still_open' | 'no_watch';
};

export function decideWatchReopenNotify(opts: {
  watchOpen: boolean;
  currentStatus: string;
  lastSeenStatus?: string | null;
  watchJustEnabled?: boolean;
}): WatchReopenDecision {
  if (!opts.watchOpen) {
    return {
      shouldNotify: false,
      nextLastSeenStatus: opts.currentStatus,
      reason: 'no_watch',
    };
  }

  const reopen = isWindowReopen({
    previousStatus: opts.lastSeenStatus,
    nextStatus: opts.currentStatus,
    watchJustEnabled: opts.watchJustEnabled,
    notifyOnEnableWhileOpen: true,
  });

  if (reopen) {
    return {
      shouldNotify: true,
      nextLastSeenStatus: opts.currentStatus,
      reason: opts.watchJustEnabled ? 'enabled_while_open' : 'reopened',
    };
  }

  return {
    shouldNotify: false,
    nextLastSeenStatus: opts.currentStatus,
    reason: isOpenWindowStatus(opts.currentStatus) ? 'still_open' : 'still_waiting',
  };
}
