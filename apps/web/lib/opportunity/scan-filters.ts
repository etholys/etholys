import type { AvailabilityStatus, ScanCandidate } from '@/lib/opportunity/scan-types';

export function normalizeFundIdentity(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Mesmo edital com instituição ligeiramente diferente ou sufixo "(demo)". */
export function isLikelyDuplicateFund(
  candidate: { name: string; institution?: string },
  existing: Array<{ name: string; institution?: string }>,
): boolean {
  const candName = normalizeFundIdentity(candidate.name);
  if (!candName) return false;
  for (const f of existing) {
    const exName = normalizeFundIdentity(f.name);
    if (!exName) continue;
    if (candName === exName) return true;
    const shorter = candName.length <= exName.length ? candName : exName;
    const longer = candName.length <= exName.length ? exName : candName;
    if (shorter.length >= 16 && longer.includes(shorter)) return true;
  }
  return false;
}

/** Remove editais que já estão no catálogo (nome normalizado). */
export function dropDuplicateFunds<T extends { name: string; institution?: string }>(
  candidates: T[],
  existing: Array<{ name: string; institution?: string }>,
): T[] {
  return candidates.filter((c) => !isLikelyDuplicateFund(c, existing));
}

/** open_now: sem estado → assumir aberto; seasonal/closed/reference ficam de fora. */
export function coerceOpenAvailability(
  status: AvailabilityStatus | undefined,
): AvailabilityStatus {
  if (status === 'open_now' || status === 'rolling') return status;
  if (!status) return 'open_now';
  return status;
}

export function isOpenNowCandidate(c: Pick<ScanCandidate, 'availabilityStatus'>): boolean {
  const status = coerceOpenAvailability(c.availabilityStatus);
  return status === 'open_now' || status === 'rolling';
}
