import 'server-only';

import {
  buildCallEvidence,
  extractDocumentLinks,
  hasOfficialCallEvidence,
  isLikelyCallPageUrl,
  normalizeCallDocuments,
  pickInstitutionUrl,
  pickOfficialCallUrl,
} from '@/lib/opportunity/call-evidence';
import { fetchOfficialResource, htmlToExcerpt } from '@/lib/opportunity/official-fetch';
import type { ScanCandidate, ScanFocus } from '@/lib/opportunity/scan-types';

const MAX_EXCERPT = 8_000;

export async function enrichCandidateEvidence(c: ScanCandidate): Promise<ScanCandidate> {
  const seedDocs = normalizeCallDocuments(c.documents);
  const target = pickOfficialCallUrl(c);
  if (!target) {
    return { ...c, documents: seedDocs, evidence: buildCallEvidence({ ...c, documents: seedDocs }) };
  }

  const page = await fetchOfficialResource(target);
  if (!page.ok) {
    const failed = { ...c, documents: seedDocs, callUrl: c.callUrl ?? target };
    return {
      ...failed,
      evidence: buildCallEvidence(failed, { httpOk: false }),
    };
  }

  const extracted = page.html ? extractDocumentLinks(page.html, page.finalUrl) : [];
  if (/\.pdf(?:$|[?#])/i.test(page.finalUrl)) {
    extracted.unshift({
      title: c.name.slice(0, 80),
      url: page.finalUrl,
      kind: 'pdf',
    });
  }
  const documents = normalizeCallDocuments([...seedDocs, ...extracted]);
  const excerpt = page.html ? htmlToExcerpt(page.html, MAX_EXCERPT) : c.sourceExcerpt;
  const callUrl = isLikelyCallPageUrl(page.finalUrl) || documents.length > 0 ? page.finalUrl : c.callUrl ?? target;
  const institutionUrl = pickInstitutionUrl({ ...c, callUrl, institutionUrl: c.institutionUrl });

  const next = {
    ...c,
    callUrl,
    institutionUrl,
    linkOficial: callUrl || c.linkOficial,
    documents,
    sourceExcerpt: excerpt,
  };
  return {
    ...next,
    evidence: buildCallEvidence(next, { httpOk: true, verifiedAt: new Date().toISOString() }),
  };
}

export async function enrichAndFilterCandidates(
  candidates: ScanCandidate[],
  scanFocus: ScanFocus,
): Promise<ScanCandidate[]> {
  const enriched: ScanCandidate[] = [];
  const queue = candidates.slice(0, 12);
  const concurrency = 4;
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
        enriched[idx] = item;
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, queue.length) }, () => worker()));

  const kept = enriched.filter(Boolean);
  if (scanFocus === 'open_now') {
    return kept.filter((c) => hasOfficialCallEvidence(c));
  }
  return kept;
}
