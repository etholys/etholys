import 'server-only';

import { buildCallEvidence, extractDocumentLinks, normalizeCallDocuments } from '@/lib/opportunity/call-evidence';
import { extractOfficialBases } from '@/lib/opportunity/extract-bases';
import { llmCompleteWithWebSearch } from '@/lib/llm-client';
import {
  fetchOfficialResource,
  htmlToExcerpt,
  siteNameFromHtml,
  titleFromHtml,
} from '@/lib/opportunity/official-fetch';
import type { CallDocument, CallEvidence } from '@/lib/opportunity/scan-types';
import { fundhubLanguageName, normalizeFundhubLocale, type FundhubLocale } from '@/lib/agents/fundhub-proposal-prompt';

export type IngestedEdital = {
  name: string;
  institution: string;
  callUrl: string;
  institutionUrl?: string;
  documents: CallDocument[];
  sourceExcerpt: string;
  basesText: string;
  evidence: CallEvidence;
  fetched: boolean;
};

function hostOrigin(url: string): string | undefined {
  try {
    return new URL(url).origin + '/';
  } catch {
    return undefined;
  }
}

async function supplementWithWebSearch(url: string, seed: string, locale: FundhubLocale): Promise<string> {
  const lang = fundhubLanguageName(locale);
  try {
    const { text } = await llmCompleteWithWebSearch(
      `You analyse official grant calls. Open the official page and linked PDFs. Do not invent. Quote what the page says. Write the summary in ${lang} (Hub UI locale: ${locale}).`,
      `Read this official call and return a factual summary in ${lang}:\n${url}\n\nAlready extracted (may be incomplete):\n${seed.slice(0, 2500)}\n\nInclude: fund name, funder, who can apply, countries, amount, deadline, annexes with URL if visible, and key requirements. If the page is public, do NOT say it needs a login.`,
      { maxOutputTokens: 3500, temperature: 0.1, timeoutMs: 90_000 },
    );
    return text.trim();
  } catch {
    return '';
  }
}

export async function ingestOfficialEdital(url: string, opts?: { locale?: unknown }): Promise<IngestedEdital> {
  const locale = normalizeFundhubLocale(opts?.locale);
  const page = await fetchOfficialResource(url);
  const callUrl = page.finalUrl || url;
  const documents = page.html ? extractDocumentLinks(page.html, callUrl) : [];
  if (page.ok && (page.type.includes('pdf') || /\.pdf(?:$|[?#])/i.test(callUrl)) && page.bytes) {
    documents.unshift({
      title: titleFromHtml(page.html) || 'Edital (PDF)',
      url: callUrl,
      kind: 'pdf',
    });
  }
  const uniqueDocs = normalizeCallDocuments(documents);
  const excerpt = page.html ? htmlToExcerpt(page.html) : '';
  const basesText = uniqueDocs.length ? await extractOfficialBases(uniqueDocs) : '';

  const spaShell =
    excerpt.length < 500 && /<div id="(?:root|app|__next)"/i.test(page.html || '');
  const thin = !page.ok || excerpt.length < 800 || spaShell || (!basesText && uniqueDocs.length === 0);
  let sourceExcerpt = excerpt;
  if (thin) {
    const extra = await supplementWithWebSearch(url, excerpt || basesText, locale);
    if (extra) {
      sourceExcerpt = excerpt ? `${excerpt}\n\n${extra}`.slice(0, 12_000) : extra.slice(0, 12_000);
    }
  }

  const name = titleFromHtml(page.html) || (sourceExcerpt.split('\n')[0] || 'Convocatória').slice(0, 160);
  const institution = siteNameFromHtml(page.html, callUrl);
  const evidence = buildCallEvidence(
    { callUrl, documents: uniqueDocs, sourceExcerpt },
    { httpOk: page.ok, verifiedAt: page.ok ? new Date().toISOString() : undefined },
  );

  return {
    name: name || 'Convocatória',
    institution: institution || 'Financiador',
    callUrl,
    institutionUrl: hostOrigin(callUrl),
    documents: uniqueDocs,
    sourceExcerpt,
    basesText,
    evidence,
    fetched: page.ok || sourceExcerpt.length > 200,
  };
}
