import { looksInventedWithoutEvidence } from '@/lib/opportunity/call-evidence';
import { isLikelyDuplicateFund, normalizeFundIdentity } from '@/lib/opportunity/scan-filters';
import type { ScanCandidate, ScanFocus, ScanResultsPayload } from '@/lib/opportunity/scan-types';

export type InboxCandidate = ScanCandidate & { runId: string };

export type DeadlineUrgency = 'overdue' | 'today' | 'soon' | 'week' | 'none';

export type InboxListFilter = {
  query?: string;
  dueSoon?: boolean;
  type?: string;
};

const DAY_MS = 24 * 60 * 60 * 1000;

export function fundInboxKey(c: { name: string; institution?: string; linkOficial?: string }): string {
  const link = typeof c.linkOficial === 'string' ? c.linkOficial.trim().toLowerCase() : '';
  if (link) return `url:${link}`;
  return `name:${normalizeFundIdentity(c.name)}|${normalizeFundIdentity(c.institution ?? '')}`;
}

export function candidateCloseMs(
  c: Pick<ScanCandidate, 'closesAt' | 'deadline'>,
): number | null {
  const raw = c.closesAt ?? c.deadline;
  if (!raw) return null;
  const dayOnly = raw.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dayOnly) {
    const y = Number(dayOnly[1]);
    const m = Number(dayOnly[2]);
    const d = Number(dayOnly[3]);
    const local = new Date(y, m - 1, d, 23, 59, 59, 999);
    return Number.isNaN(local.getTime()) ? null : local.getTime();
  }
  const ms = Date.parse(raw);
  return Number.isNaN(ms) ? null : ms;
}

export function daysUntilClose(
  c: Pick<ScanCandidate, 'closesAt' | 'deadline'>,
  now = Date.now(),
): number | null {
  const ms = candidateCloseMs(c);
  if (ms == null) return null;
  const close = new Date(ms);
  const today = new Date(now);
  const closeDay = Date.UTC(close.getFullYear(), close.getMonth(), close.getDate());
  const todayDay = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((closeDay - todayDay) / DAY_MS);
}

export function deadlineUrgency(days: number | null): DeadlineUrgency {
  if (days == null) return 'none';
  if (days < 0) return 'overdue';
  if (days <= 1) return 'today';
  if (days <= 7) return 'soon';
  if (days <= 14) return 'week';
  return 'none';
}

export function sortCandidatesByDeadline<T extends Pick<ScanCandidate, 'closesAt' | 'deadline'>>(
  items: T[],
  now = Date.now(),
): T[] {
  return [...items].sort((a, b) => {
    const aMs = candidateCloseMs(a);
    const bMs = candidateCloseMs(b);
    if (aMs == null && bMs == null) return 0;
    if (aMs == null) return 1;
    if (bMs == null) return -1;
    const aPast = aMs < now;
    const bPast = bMs < now;
    if (aPast !== bPast) return aPast ? 1 : -1;
    return aMs - bMs;
  });
}

export function filterInboxCandidates<T extends ScanCandidate>(
  items: T[],
  filter: InboxListFilter,
  now = Date.now(),
): T[] {
  const q = filter.query?.trim().toLowerCase() ?? '';
  const type = filter.type?.trim();
  return items.filter((c) => {
    if (type && c.type !== type) return false;
    if (filter.dueSoon) {
      const days = daysUntilClose(c, now);
      if (days == null || days < 0 || days > 14) return false;
    }
    if (!q) return true;
    const hay = [c.name, c.institution, c.type, c.category, c.countries, c.eligibleCountries]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return hay.includes(q);
  });
}

export function uniqueCandidateTypes(items: ScanCandidate[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const c of items) {
    const type = c.type?.trim();
    if (!type || seen.has(type)) continue;
    seen.add(type);
    out.push(type);
  }
  return out;
}

function stamp(c: ScanCandidate, runId: string): InboxCandidate {
  return { ...c, runId };
}

/**
 * Junta varreduras (mais recente primeiro). Um fundo só some se
 * guardar, arquivar ou rejeitar — não quando corre uma busca nova.
 */
export function buildScanInbox(
  runs: Array<{ runId: string; payload: ScanResultsPayload }>,
): { pending: InboxCandidate[]; later: InboxCandidate[] } {
  const closedKeys = new Set<string>();
  for (const { payload } of runs) {
    const closedIds = new Set([...payload.savedTempIds, ...payload.discardedTempIds]);
    for (const c of payload.candidates) {
      if (closedIds.has(c.tempId)) closedKeys.add(fundInboxKey(c));
    }
  }

  const pending: InboxCandidate[] = [];
  const later: InboxCandidate[] = [];
  const pendingKeys = new Set<string>();
  const laterKeys = new Set<string>();

  for (const { runId, payload } of runs) {
    const saved = new Set(payload.savedTempIds);
    const discarded = new Set(payload.discardedTempIds);
    const laterIds = new Set(payload.laterTempIds);

    for (const raw of payload.candidates) {
      const c = {
        ...raw,
        scanFocus: raw.scanFocus ?? payload.scanFocus,
      };
      if (saved.has(c.tempId) || discarded.has(c.tempId)) continue;
      const key = fundInboxKey(c);
      if (closedKeys.has(key)) continue;

      const item = stamp(c, runId);
      if (laterIds.has(c.tempId)) {
        if (laterKeys.has(key) || pendingKeys.has(key)) continue;
        if (isLikelyDuplicateFund(c, later) || isLikelyDuplicateFund(c, pending)) continue;
        if ((c.scanFocus ?? payload.scanFocus) === 'open_now' && looksInventedWithoutEvidence(c)) {
          continue;
        }
        later.push(item);
        laterKeys.add(key);
        continue;
      }

      if (pendingKeys.has(key) || laterKeys.has(key)) continue;
      if (isLikelyDuplicateFund(c, pending) || isLikelyDuplicateFund(c, later)) continue;
      if ((c.scanFocus ?? payload.scanFocus) === 'open_now' && looksInventedWithoutEvidence(c)) {
        continue;
      }
      pending.push(item);
      pendingKeys.add(key);
    }
  }

  return {
    pending: sortCandidatesByDeadline(pending),
    later: sortCandidatesByDeadline(later),
  };
}

export function splitInboxByFocus(
  pending: InboxCandidate[],
  focus?: ScanFocus,
): InboxCandidate[] {
  if (!focus) return pending;
  return pending.filter((c) => (c.scanFocus ?? 'open_now') === focus);
}
