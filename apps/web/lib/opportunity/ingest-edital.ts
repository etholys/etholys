import 'server-only';

import {
  buildCallEvidence,
  extractDocumentLinks,
  isLikelyCallPageUrl,
  isLikelyHomepageUrl,
  isLikelyListingUrl,
  normalizeCallDocuments,
} from '@/lib/opportunity/call-evidence';
import { extractOfficialBases } from '@/lib/opportunity/extract-bases';
import { llmCompleteWithWebSearch } from '@/lib/llm-client';
import {
  fetchOfficialResource,
  htmlToExcerpt,
  siteNameFromHtml,
  titleFromHtml,
} from '@/lib/opportunity/official-fetch';
import {
  alternateLocaleCallUrls,
  htmlMentionsAnnexes,
  isBotWallHtml,
  isThinOfficialHtml,
} from '@/lib/opportunity/official-html';
import { recoverOfficialPageViaWebSearch } from '@/lib/opportunity/official-page-recover';
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
      {
        model: 'claude-opus-4-6',
        maxOutputTokens: 3500,
        temperature: 0.1,
        timeoutMs: 90_000,
        webSearchMaxUses: 4,
      },
    );
    return text.trim();
  } catch {
    return '';
  }
}

export async function ingestOfficialEdital(
  url: string,
  opts?: { locale?: unknown; nameHint?: string; institutionHint?: string; seed?: string },
): Promise<IngestedEdital> {
  const locale = normalizeFundhubLocale(opts?.locale);
  let page = await fetchOfficialResource(url);
  let callUrl = page.finalUrl || url;

  if (!page.ok || isBotWallHtml(page.html)) {
    for (const alt of alternateLocaleCallUrls(callUrl)) {
      const retry = await fetchOfficialResource(alt);
      if (retry.ok && !isBotWallHtml(retry.html)) {
        page = retry;
        callUrl = retry.finalUrl || alt;
        break;
      }
    }
  }

  const htmlOk = page.ok && !isBotWallHtml(page.html);
  let documents = htmlOk && page.html ? extractDocumentLinks(page.html, callUrl) : [];
  const excerpt = htmlOk && page.html ? htmlToExcerpt(page.html) : '';
  const spaThin = isThinOfficialHtml(page.html, excerpt);
  const listingOrHome = isLikelyHomepageUrl(callUrl) || isLikelyListingUrl(callUrl);
  const annexGap = htmlMentionsAnnexes(page.html || excerpt) && documents.length === 0;
  const thin = !htmlOk || spaThin || listingOrHome || annexGap || excerpt.length < 800;

  if (thin) {
    const recovered = await recoverOfficialPageViaWebSearch(callUrl, {
      name: opts?.nameHint,
      institution: opts?.institutionHint,
      seed: excerpt || opts?.seed,
    });
    if (recovered.callUrl && isLikelyCallPageUrl(recovered.callUrl) && recovered.callUrl !== callUrl) {
      const second = await fetchOfficialResource(recovered.callUrl);
      if (second.ok && !isBotWallHtml(second.html)) {
        page = second;
        callUrl = second.finalUrl || recovered.callUrl;
        if (page.html) {
          documents = extractDocumentLinks(page.html, callUrl);
        }
      } else {
        callUrl = recovered.callUrl;
      }
    } else if (recovered.callUrl && isLikelyCallPageUrl(recovered.callUrl)) {
      callUrl = recovered.callUrl;
    }
    documents = normalizeCallDocuments([...documents, ...recovered.documents]);

    const htmlOkAfter = page.ok && !isBotWallHtml(page.html);
    const excerptAfter = htmlOkAfter && page.html ? htmlToExcerpt(page.html) : excerpt;
    let sourceExcerpt = excerptAfter;
    if (recovered.excerpt) {
      sourceExcerpt = excerptAfter
        ? `${excerptAfter}\n\n${recovered.excerpt}`.slice(0, 12_000)
        : recovered.excerpt.slice(0, 12_000);
    }
    if (sourceExcerpt.length < 400) {
      const extra = await supplementWithWebSearch(callUrl, sourceExcerpt, locale);
      if (extra) {
        sourceExcerpt = sourceExcerpt ? `${sourceExcerpt}\n\n${extra}`.slice(0, 12_000) : extra.slice(0, 12_000);
      }
    }

    return finishIngest({
      page,
      callUrl,
      documents,
      sourceExcerpt,
      recoveredOk: recovered.reachable,
      recoveredStatus: recovered.httpStatus,
    });
  }

  return finishIngest({
    page,
    callUrl,
    documents,
    sourceExcerpt: excerpt,
    recoveredOk: false,
  });
}

async function finishIngest(opts: {
  page: { ok: boolean; status: number; html: string; bytes: Buffer | null; type: string };
  callUrl: string;
  documents: CallDocument[];
  sourceExcerpt: string;
  recoveredOk: boolean;
  recoveredStatus?: number;
}): Promise<IngestedEdital> {
  const { page, callUrl, sourceExcerpt, recoveredOk, recoveredStatus } = opts;
  let documents = [...opts.documents];
  if (page.ok && (page.type.includes('pdf') || /\.pdf(?:$|[?#])/i.test(callUrl)) && page.bytes) {
    documents.unshift({
      title: titleFromHtml(page.html) || 'Edital (PDF)',
      url: callUrl,
      kind: 'pdf',
    });
  }
  const uniqueDocs = normalizeCallDocuments(documents);
  const basesText = uniqueDocs.length ? await extractOfficialBases(uniqueDocs) : '';
  const htmlOk = page.ok && !isBotWallHtml(page.html);
  const officialCall = isLikelyCallPageUrl(callUrl);
  const verified = (htmlOk && officialCall) || (recoveredOk && officialCall && sourceExcerpt.length >= 80);
  const botBlocked = isBotWallHtml(page.html) && !htmlOk && !recoveredOk;
  const evidence = buildCallEvidence(
    { callUrl, documents: uniqueDocs, sourceExcerpt },
    {
      httpOk: verified,
      verifiedAt: verified ? new Date().toISOString() : undefined,
      httpStatus: htmlOk
        ? page.status || 200
        : recoveredOk
          ? recoveredStatus || 200
          : botBlocked
            ? 403
            : page.status,
      verifiedVia: htmlOk && officialCall ? 'http' : recoveredOk && officialCall ? 'web_search' : undefined,
    },
  );

  const name = titleFromHtml(htmlOk ? page.html : '') || (sourceExcerpt.split('\n')[0] || 'Convocatória').slice(0, 160);
  const institution = siteNameFromHtml(htmlOk ? page.html : '', callUrl);

  return {
    name: name || 'Convocatória',
    institution: institution || 'Financiador',
    callUrl,
    institutionUrl: hostOrigin(callUrl),
    documents: uniqueDocs,
    sourceExcerpt,
    basesText,
    evidence,
    fetched: htmlOk || sourceExcerpt.length > 200,
  };
}
