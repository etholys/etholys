import 'server-only';

import { sanitizeCandidateDates } from '@/lib/opportunity/availability';
import {
  buildCallEvidence,
  extractDocumentLinks,
  hasOfficialCallEvidence,
  isHardOfficialHttpFailure,
  isLikelyCallPageUrl,
  normalizeCallDocuments,
  pickInstitutionUrl,
  pickOfficialCallUrl,
} from '@/lib/opportunity/call-evidence';
import { fetchOfficialResource, htmlToExcerpt } from '@/lib/opportunity/official-fetch';
import { recoverOfficialPageViaWebSearch } from '@/lib/opportunity/official-page-recover';
import type { ScanCandidate, ScanFocus } from '@/lib/opportunity/scan-types';

const MAX_EXCERPT = 8_000;
const THIN_EXCERPT = 500;

export async function enrichCandidateEvidence(c: ScanCandidate): Promise<ScanCandidate> {
  const seedDocs = normalizeCallDocuments(c.documents);
  const target = pickOfficialCallUrl(c);
  if (!target) {
    return sanitizeCandidateDates({
      ...c,
      documents: seedDocs,
      evidence: buildCallEvidence({ ...c, documents: seedDocs }),
    });
  }

  let page = await fetchOfficialResource(target);
  if (!page.ok) {
    page = await fetchOfficialResource(target, { attempts: 2 });
  }

  if (page.ok) {
    const extracted = page.html ? extractDocumentLinks(page.html, page.finalUrl) : [];
    if (/\.pdf(?:$|[?#])/i.test(page.finalUrl)) {
      extracted.unshift({
        title: c.name.slice(0, 80),
        url: page.finalUrl,
        kind: 'pdf',
      });
    }
    let documents = normalizeCallDocuments([...seedDocs, ...extracted]);
    let excerpt = page.html ? htmlToExcerpt(page.html, MAX_EXCERPT) : c.sourceExcerpt || '';
    const spaShell = /<div id="(?:root|app|__next)"/i.test(page.html || '');
    if (!excerpt || excerpt.length < THIN_EXCERPT || spaShell) {
      const recovered = await recoverOfficialPageViaWebSearch(page.finalUrl || target, {
        name: c.name,
        seed: excerpt,
      });
      if (recovered.reachable && recovered.excerpt) {
        excerpt = excerpt
          ? `${excerpt}\n\n${recovered.excerpt}`.slice(0, MAX_EXCERPT)
          : recovered.excerpt.slice(0, MAX_EXCERPT);
        documents = normalizeCallDocuments([...documents, ...recovered.documents]);
      }
    }
    const callUrl =
      isLikelyCallPageUrl(page.finalUrl) || documents.length > 0 ? page.finalUrl : c.callUrl ?? target;
    const institutionUrl = pickInstitutionUrl({ ...c, callUrl, institutionUrl: c.institutionUrl });
    const next = sanitizeCandidateDates({
      ...c,
      callUrl,
      institutionUrl,
      linkOficial: callUrl || c.linkOficial,
      documents,
      sourceExcerpt: excerpt || c.sourceExcerpt,
    });
    return {
      ...next,
      evidence: buildCallEvidence(next, {
        httpOk: true,
        verifiedAt: new Date().toISOString(),
        httpStatus: page.status || 200,
        verifiedVia: 'http',
      }),
    };
  }

  const recovered = await recoverOfficialPageViaWebSearch(target, { name: c.name, seed: c.sourceExcerpt });
  if (recovered.reachable && recovered.excerpt.length >= 80) {
    const callUrl = recovered.callUrl && isLikelyCallPageUrl(recovered.callUrl) ? recovered.callUrl : target;
    const documents = normalizeCallDocuments([...seedDocs, ...recovered.documents]);
    const next = sanitizeCandidateDates({
      ...c,
      callUrl,
      institutionUrl: pickInstitutionUrl({ ...c, callUrl, institutionUrl: c.institutionUrl }),
      linkOficial: callUrl || c.linkOficial,
      documents,
      sourceExcerpt: recovered.excerpt.slice(0, MAX_EXCERPT),
    });
    return {
      ...next,
      evidence: buildCallEvidence(next, {
        httpOk: true,
        verifiedAt: new Date().toISOString(),
        httpStatus: recovered.httpStatus && recovered.httpStatus >= 200 && recovered.httpStatus < 400
          ? recovered.httpStatus
          : 200,
        verifiedVia: 'web_search',
      }),
    };
  }

  const hard = isHardOfficialHttpFailure(page.status);
  const failed = sanitizeCandidateDates({
    ...c,
    documents: seedDocs,
    callUrl: c.callUrl ?? target,
  });
  return {
    ...failed,
    evidence: buildCallEvidence(failed, {
      httpOk: hard ? false : undefined,
      httpStatus: page.status || recovered.httpStatus,
    }),
  };
}

export async function enrichAndFilterCandidates(
  candidates: ScanCandidate[],
  scanFocus: ScanFocus,
): Promise<ScanCandidate[]> {
  const enriched: ScanCandidate[] = [];
  const queue = candidates.slice(0, 18);
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
