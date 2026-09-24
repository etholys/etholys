import 'server-only';

import {
  buildCallEvidence,
  extractDocumentLinks,
  hasOfficialCallEvidence,
  isLikelyCallPageUrl,
  isSafePublicHttpUrl,
  normalizeCallDocuments,
  pickInstitutionUrl,
  pickOfficialCallUrl,
} from '@/lib/opportunity/call-evidence';
import { isAggregatorFundingUrl } from '@/lib/opportunity/official-url';
import type { ScanCandidate, ScanFocus } from '@/lib/opportunity/scan-types';

const FETCH_MS = 9_000;
const MAX_HTML = 400_000;
const MAX_EXCERPT = 8_000;

function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function fetchOfficialPage(url: string): Promise<{ ok: boolean; html: string; finalUrl: string }> {
  if (!isSafePublicHttpUrl(url) || isAggregatorFundingUrl(url)) {
    return { ok: false, html: '', finalUrl: url };
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': 'Etholys-FundHub/1.0 (+https://etholys.com)',
        Accept: 'text/html,application/xhtml+xml,application/pdf;q=0.9,*/*;q=0.8',
      },
    });
    const finalUrl = res.url || url;
    if (!res.ok) return { ok: false, html: '', finalUrl };
    const type = res.headers.get('content-type') ?? '';
    if (type.includes('pdf') || /\.pdf(?:$|[?#])/i.test(finalUrl)) {
      return { ok: true, html: '', finalUrl };
    }
    const html = (await res.text()).slice(0, MAX_HTML);
    return { ok: html.length > 40 || type.includes('html'), html, finalUrl };
  } catch {
    return { ok: false, html: '', finalUrl: url };
  } finally {
    clearTimeout(timer);
  }
}

export async function enrichCandidateEvidence(c: ScanCandidate): Promise<ScanCandidate> {
  const seedDocs = normalizeCallDocuments(c.documents);
  const target = pickOfficialCallUrl(c);
  if (!target) {
    return { ...c, documents: seedDocs, evidence: buildCallEvidence({ ...c, documents: seedDocs }) };
  }

  const page = await fetchOfficialPage(target);
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
  const excerpt = page.html ? htmlToText(page.html).slice(0, MAX_EXCERPT) : c.sourceExcerpt;
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
