import 'server-only';

import { randomUUID } from 'crypto';
import { prisma } from '@/lib/prisma';
import type { ScanCandidate, ScanFocus, ScanResultsPayload } from '@/lib/opportunity/scan-types';
import { normalizeAvailabilityStatus } from '@/lib/opportunity/availability';
import { coerceOpenAvailability } from '@/lib/opportunity/scan-filters';
import { sanitizeFundingLinks } from '@/lib/opportunity/official-url';
import {
  buildScanInbox,
  splitInboxByFocus,
  type InboxCandidate,
} from '@/lib/opportunity/scan-inbox';
import {
  looksInventedWithoutEvidence,
  normalizeCallDocuments,
  pickInstitutionUrl,
  pickOfficialCallUrl,
} from '@/lib/opportunity/call-evidence';

export const SCAN_MEMORY_CATEGORY = 'opportunity_scan';

function runKey(runId: string) {
  return `run_${runId}`;
}

function emptyPayload(runId: string): ScanResultsPayload {
  return {
    runId,
    candidates: [],
    savedTempIds: [],
    discardedTempIds: [],
    laterTempIds: [],
  };
}

export function parseScanResults(raw: string | null | undefined, runId: string): ScanResultsPayload {
  if (!raw) return emptyPayload(runId);
  try {
    const d = JSON.parse(raw) as Partial<ScanResultsPayload>;
  return {
    runId,
    candidates: Array.isArray(d.candidates) ? d.candidates : [],
    savedTempIds: Array.isArray(d.savedTempIds) ? d.savedTempIds : [],
    discardedTempIds: Array.isArray(d.discardedTempIds) ? d.discardedTempIds : [],
    laterTempIds: Array.isArray(d.laterTempIds) ? d.laterTempIds : [],
    discoveryMode: d.discoveryMode === 'web' || d.discoveryMode === 'knowledge' ? d.discoveryMode : undefined,
    searchQueries: Array.isArray(d.searchQueries) ? d.searchQueries : undefined,
    scanFocus: d.scanFocus === 'open_now' || d.scanFocus === 'reference' ? d.scanFocus : undefined,
    scanProfileId: typeof d.scanProfileId === 'string' ? d.scanProfileId : undefined,
    scanProfileName: typeof d.scanProfileName === 'string' ? d.scanProfileName : undefined,
  };
  } catch {
    return emptyPayload(runId);
  }
}

export async function readScanResults(companyId: string, runId: string): Promise<ScanResultsPayload> {
  const row = await prisma.aiCompanyMemory.findFirst({
    where: { companyId, category: SCAN_MEMORY_CATEGORY, key: runKey(runId) },
  });
  return parseScanResults(row?.value, runId);
}

export async function writeScanResults(
  companyId: string,
  payload: ScanResultsPayload,
  source: string,
): Promise<void> {
  const value = JSON.stringify(payload);
  const key = runKey(payload.runId);
  const existing = await prisma.aiCompanyMemory.findFirst({
    where: { companyId, category: SCAN_MEMORY_CATEGORY, key },
  });
  if (existing) {
    await prisma.aiCompanyMemory.update({ where: { id: existing.id }, data: { value, source } });
  } else {
    await prisma.aiCompanyMemory.create({
      data: { companyId, category: SCAN_MEMORY_CATEGORY, key, value, source },
    });
  }
}

export function normalizeCandidates(raw: unknown[], scanFocus?: ScanFocus): ScanCandidate[] {
  const out: ScanCandidate[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    const name = typeof o.name === 'string' ? o.name.trim() : '';
    const institution = typeof o.institution === 'string' ? o.institution.trim() : '';
    if (!name || !institution) continue;

    let availabilityStatus = normalizeAvailabilityStatus(o.availabilityStatus);
    if (scanFocus === 'open_now') {
      availabilityStatus = coerceOpenAvailability(availabilityStatus);
    }
    const eligibleCountries =
      typeof o.eligibleCountries === 'string'
        ? o.eligibleCountries.slice(0, 300)
        : typeof o.countries === 'string'
          ? o.countries.slice(0, 300)
          : undefined;
    const closesAt =
      typeof o.closesAt === 'string'
        ? o.closesAt
        : typeof o.deadline === 'string'
          ? o.deadline
          : null;
    const opensAt = typeof o.opensAt === 'string' ? o.opensAt : null;

    const rawLink = typeof o.linkOficial === 'string' ? o.linkOficial : undefined;
    const rawCall = typeof o.callUrl === 'string' ? o.callUrl : undefined;
    const rawInstitution = typeof o.institutionUrl === 'string' ? o.institutionUrl : undefined;
    const rawSource = typeof o.sourceUrl === 'string' ? o.sourceUrl : undefined;
    const links = sanitizeFundingLinks(rawCall || rawLink, rawSource);
    const callUrl = pickOfficialCallUrl({
      callUrl: sanitizeFundingLinks(rawCall).linkOficial,
      linkOficial: links.linkOficial,
      sourceUrl: links.sourceUrl,
    });
    const institutionUrl = pickInstitutionUrl({
      institutionUrl: sanitizeFundingLinks(rawInstitution).linkOficial,
      linkOficial: links.linkOficial,
      callUrl,
    });
    const documents = normalizeCallDocuments(o.documents);

    let availabilityNote =
      typeof o.availabilityNote === 'string' ? o.availabilityNote.slice(0, 400) : undefined;
    if (links.rejectedUrl) {
      let host = links.rejectedUrl;
      try {
        host = new URL(links.rejectedUrl).hostname;
      } catch {
        /* keep raw */
      }
      const rejectNote = `Link agregador rejeitado (${host}).`;
      availabilityNote = availabilityNote ? `${rejectNote} ${availabilityNote}` : rejectNote;
    }

    const clip = (v: unknown, max: number): string | undefined =>
      typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : undefined;

    if (scanFocus === 'open_now' && looksInventedWithoutEvidence({ callUrl, linkOficial: links.linkOficial, sourceUrl: links.sourceUrl, documents, name })) {
      continue;
    }

    out.push({
      tempId: typeof o.tempId === 'string' ? o.tempId : randomUUID(),
      name: name.slice(0, 300),
      institution: institution.slice(0, 200),
      type: typeof o.type === 'string' ? o.type.slice(0, 80) : 'Grant',
      category: typeof o.category === 'string' ? o.category.slice(0, 120) : undefined,
      description: clip(o.description, 4500),
      whoCanApply: clip(o.whoCanApply, 1200),
      eligibility: clip(o.eligibility, 1500),
      requirements: clip(o.requirements, 1500),
      howToApply: clip(o.howToApply, 1200),
      risksCaveats: clip(o.risksCaveats, 1200),
      linkOficial: callUrl || links.linkOficial,
      callUrl,
      institutionUrl,
      documents,
      sourceExcerpt: clip(o.sourceExcerpt, 8000),
      amount: typeof o.amount === 'number' ? o.amount : undefined,
      currency: typeof o.currency === 'string' ? o.currency.slice(0, 8) : 'USD',
      deadline: closesAt,
      countries: eligibleCountries,
      sectors: typeof o.sectors === 'string' ? o.sectors.slice(0, 300) : undefined,
      matchScore: typeof o.matchScore === 'number' ? Math.min(100, Math.max(0, o.matchScore)) : undefined,
      matchJustification:
        typeof o.matchJustification === 'string' ? o.matchJustification.slice(0, 500) : undefined,
      sourceUrl: links.sourceUrl,
      availabilityStatus,
      opensAt,
      closesAt,
      applicationWindow:
        typeof o.applicationWindow === 'string' ? o.applicationWindow.slice(0, 200) : undefined,
      eligibleCountries,
      availabilityNote,
      scanFocus,
      classification:
        o.classification === 'direct' ||
        o.classification === 'client_bridge' ||
        o.classification === 'joint'
          ? o.classification
          : undefined,
      classificationNote:
        typeof o.classificationNote === 'string' ? o.classificationNote.slice(0, 300) : undefined,
    });
  }
  return out.slice(0, 20);
}

export async function patchScanCandidate(
  companyId: string,
  runId: string,
  tempId: string,
  patch: Partial<ScanCandidate>,
): Promise<ScanCandidate | null> {
  const payload = await readScanResults(companyId, runId);
  const idx = payload.candidates.findIndex((c) => c.tempId === tempId);
  if (idx < 0) return null;
  const next = { ...payload.candidates[idx], ...patch, tempId, runId } as ScanCandidate;
  payload.candidates[idx] = next;
  await writeScanResults(companyId, payload, `enrich:${runId}`);
  return next;
}

export function pendingCandidates(payload: ScanResultsPayload, focus?: ScanFocus): ScanCandidate[] {
  const handled = new Set([...payload.savedTempIds, ...payload.discardedTempIds, ...payload.laterTempIds]);
  return payload.candidates.filter((c) => {
    if (handled.has(c.tempId)) return false;
    if (!focus) return true;
    const itemFocus = c.scanFocus ?? payload.scanFocus ?? 'open_now';
    return itemFocus === focus;
  });
}

const INBOX_RUN_LIMIT = 40;

export async function readCompanyScanInbox(companyId: string): Promise<{
  pending: InboxCandidate[];
  pendingOpen: InboxCandidate[];
  pendingReference: InboxCandidate[];
  later: InboxCandidate[];
}> {
  const runs = await prisma.fundhubDiscoveryRun.findMany({
    where: { companyId, status: { in: ['completed', 'running'] } },
    orderBy: { startedAt: 'desc' },
    take: INBOX_RUN_LIMIT,
    select: { id: true },
  });
  if (runs.length === 0) {
    return { pending: [], pendingOpen: [], pendingReference: [], later: [] };
  }

  const rows = await prisma.aiCompanyMemory.findMany({
    where: {
      companyId,
      category: SCAN_MEMORY_CATEGORY,
      key: { in: runs.map((r) => runKey(r.id)) },
    },
  });
  const byKey = new Map(rows.map((r) => [r.key, r.value]));
  const inbox = buildScanInbox(
    runs.map((r) => ({
      runId: r.id,
      payload: parseScanResults(byKey.get(runKey(r.id)), r.id),
    })),
  );

  return {
    pending: inbox.pending,
    pendingOpen: splitInboxByFocus(inbox.pending, 'open_now'),
    pendingReference: splitInboxByFocus(inbox.pending, 'reference'),
    later: inbox.later,
  };
}
