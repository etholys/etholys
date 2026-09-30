import 'server-only';

import { sanitizeCandidateDates } from '@/lib/opportunity/availability';
import {
  buildCallEvidence,
  hasOfficialCallEvidence,
  isLikelyCallPageUrl,
  normalizeCallDocuments,
  pickInstitutionUrl,
  pickOfficialCallUrl,
} from '@/lib/opportunity/call-evidence';
import { maxEnrichCandidates } from '@/lib/opportunity/discovery-caps';
import { isAggregatorFundingUrl } from '@/lib/opportunity/official-url';
import { ingestOfficialEdital } from '@/lib/opportunity/ingest-edital';
import { normalizeInstrumentType } from '@/lib/opportunity/instrument-type';
import type { ScanCandidate, ScanFocus } from '@/lib/opportunity/scan-types';

/** Same path as proposal ingest — run before the card is shown. */
export async function enrichCandidateEvidence(c: ScanCandidate): Promise<ScanCandidate> {
  const seedDocs = normalizeCallDocuments(c.documents);
  const target = pickOfficialCallUrl(c) || c.institutionUrl || c.linkOficial;
  if (!target) {
    return sanitizeCandidateDates({
      ...c,
      type: normalizeInstrumentType(c.type),
      documents: seedDocs,
      evidence: buildCallEvidence({ ...c, documents: seedDocs }),
    });
  }

  const ingested = await ingestOfficialEdital(target, {
    nameHint: c.name,
    institutionHint: c.institution,
    seed: c.sourceExcerpt,
  });

  const documents = normalizeCallDocuments([...seedDocs, ...ingested.documents]);
  const callUrl =
    ingested.callUrl && isLikelyCallPageUrl(ingested.callUrl)
      ? ingested.callUrl
      : pickOfficialCallUrl({ ...c, callUrl: ingested.callUrl }) || ingested.callUrl || target;

  const next = sanitizeCandidateDates({
    ...c,
    type: normalizeInstrumentType(c.type),
    callUrl,
    institutionUrl: pickInstitutionUrl({
      ...c,
      callUrl,
      institutionUrl: ingested.institutionUrl || c.institutionUrl,
    }),
    linkOficial: callUrl || c.linkOficial,
    documents,
    sourceExcerpt: ingested.sourceExcerpt || c.sourceExcerpt,
    basesText: ingested.basesText || c.basesText,
  });

  const evidence =
    ingested.evidence.status === 'verified' || ingested.evidence.status === 'failed'
      ? { ...ingested.evidence, documentCount: documents.length, callUrl }
      : buildCallEvidence(next, {
          httpOk: ingested.evidence.httpOk,
          httpStatus: ingested.evidence.httpStatus,
          verifiedAt: ingested.evidence.verifiedAt,
          verifiedVia: ingested.evidence.verifiedVia,
        });

  return { ...next, evidence };
}

export async function enrichAndFilterCandidates(
  candidates: ScanCandidate[],
  scanFocus: ScanFocus,
): Promise<ScanCandidate[]> {
  const enriched: ScanCandidate[] = [];
  const queue = candidates.slice(0, maxEnrichCandidates());
  const concurrency = 3;
  let i = 0;
  async function worker() {
    while (i < queue.length) {
      const idx = i;
      i += 1;
      const item = queue[idx];
      if (!item) continue;
      try {
        enriched[idx] = await enrichCandidateEvidence(item);
      } catch {
        enriched[idx] = {
          ...item,
          type: normalizeInstrumentType(item.type),
          evidence: buildCallEvidence(item),
        };
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, queue.length) }, () => worker()));

  const kept = enriched.filter(Boolean);
  if (scanFocus === 'open_now') {
    return kept.filter((c) => {
      if (hasOfficialCallEvidence(c)) return true;
      const url = pickOfficialCallUrl(c) || c.callUrl || c.linkOficial;
      return Boolean(url && !isAggregatorFundingUrl(url));
    });
  }
  return kept;
}
