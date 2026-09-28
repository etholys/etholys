import 'server-only';

import { llmCompleteWithWebSearch } from '@/lib/llm-client';
import { isLikelyCallPageUrl, normalizeCallDocuments } from '@/lib/opportunity/call-evidence';
import { FUNDHUB_DISCOVERY_MODEL } from '@/lib/opportunity/fundhub-llm';
import type { CallDocument } from '@/lib/opportunity/scan-types';

export type OfficialPageRecovery = {
  reachable: boolean;
  excerpt: string;
  callUrl?: string;
  documents: CallDocument[];
  httpStatus?: number;
};

function stripJsonFences(text: string): string {
  const t = text.trim();
  const m = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(t);
  return m ? m[1].trim() : t;
}

function looksUnreachable(text: string): boolean {
  return /page not found|\b404\b|does not exist|could not (open|access|reach)|unavailable|no such page/i.test(
    text,
  );
}

function pickCallUrl(raw: unknown, fallback?: string): string | undefined {
  const candidates = [raw, fallback]
    .filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
    .map((v) => v.trim());
  return candidates.find((u) => isLikelyCallPageUrl(u)) ?? candidates[0];
}

/** Opus + web_search: resolve the REAL call slug and annex URLs. */
export async function recoverOfficialPageViaWebSearch(
  url: string,
  hint?: { name?: string; institution?: string; seed?: string },
): Promise<OfficialPageRecovery> {
  const empty: OfficialPageRecovery = { reachable: false, excerpt: '', documents: [] };
  try {
    const { text } = await llmCompleteWithWebSearch(
      `You verify official funding-call pages. Open the live page with web search. Quote only what you see. Never invent deadlines, amounts, or annexes.
Public IFAD / multilateral call pages are NOT login walls. If Cloudflare or a bot check appears in a raw fetch, still use web search to read the real article.
Return JSON only.`,
      [
        url ? `Seed URL (may be homepage, listing, or the call slug): ${url}` : '',
        hint?.name ? `Call / programme name: ${hint.name}` : '',
        hint?.institution ? `Funder: ${hint.institution}` : '',
        hint?.seed ? `Already extracted (may be a bot-wall or empty):\n${hint.seed.slice(0, 1500)}` : '',
        `Find the official CONVOCATORIA / call-for-proposals PAGE — not the agency homepage and not the /calls-for-proposal index.`,
        `The seed URL may be a news article, LinkedIn post, or grant aggregator. Follow through to the FUNDER'S OWN call page and put that in callUrl.`,
        `IFAD slugs look like https://www.ifad.org/{en|es|fr}/w/calls-for-proposal/{full-slug}. Never truncate the slug.`,
        `List EVERY annex / guideline / concept note / template / budget / self-certification / Download link with its URL even if the href has no .pdf (Liferay /documents/ paths are valid).`,
        `Return JSON: { "reachable": boolean, "httpStatus": number|null, "title": string, "excerpt": string (400-2500 chars quoted from the live page, include the annex list), "callUrl": string (canonical official call URL), "documents": [{"title": string, "url": string}] }`,
        `httpStatus: 200 if the public page opened via search; 401/403/404 only if the live page really returned that; null if unknown.`,
      ]
        .filter(Boolean)
        .join('\n'),
      {
        model: FUNDHUB_DISCOVERY_MODEL,
        maxOutputTokens: 5000,
        temperature: 0.05,
        timeoutMs: 90_000,
        webSearchMaxUses: 6,
      },
    );
    const raw = stripJsonFences(text);
    try {
      const parsed = JSON.parse(raw) as {
        reachable?: boolean;
        httpStatus?: number | null;
        excerpt?: string;
        title?: string;
        callUrl?: string;
        documents?: unknown;
      };
      const excerpt = (parsed.excerpt || parsed.title || '').trim();
      const callUrl = pickCallUrl(parsed.callUrl, url);
      const documents = normalizeCallDocuments(parsed.documents);
      const reachable =
        (parsed.reachable === true && excerpt.length >= 80) ||
        (Boolean(callUrl && isLikelyCallPageUrl(callUrl)) && (excerpt.length >= 80 || documents.length > 0));
      return {
        reachable,
        excerpt: excerpt.slice(0, 8000),
        callUrl,
        documents,
        httpStatus: typeof parsed.httpStatus === 'number' ? parsed.httpStatus : undefined,
      };
    } catch {
      const excerpt = raw.trim();
      if (excerpt.length >= 200 && !looksUnreachable(excerpt)) {
        return { reachable: true, excerpt: excerpt.slice(0, 8000), documents: [], callUrl: pickCallUrl(url) };
      }
      return empty;
    }
  } catch {
    return empty;
  }
}
