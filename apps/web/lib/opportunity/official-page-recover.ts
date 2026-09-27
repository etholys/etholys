import 'server-only';

import { llmCompleteWithWebSearch } from '@/lib/llm-client';
import { normalizeCallDocuments } from '@/lib/opportunity/call-evidence';
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

/** Opus + web_search quando o HTTP do servidor falha ou o HTML é uma casca vazia. */
export async function recoverOfficialPageViaWebSearch(
  url: string,
  hint?: { name?: string; seed?: string },
): Promise<OfficialPageRecovery> {
  const empty: OfficialPageRecovery = { reachable: false, excerpt: '', documents: [] };
  try {
    const { text } = await llmCompleteWithWebSearch(
      `You verify official funding-call pages. Open the exact URL with web search. Quote only what you see. Never invent deadlines, amounts, or annexes. If the page is public, say so. Return JSON only.`,
      [
        `URL: ${url}`,
        hint?.name ? `Name hint: ${hint.name}` : '',
        hint?.seed ? `Already extracted (may be empty):\n${hint.seed.slice(0, 1500)}` : '',
        `Return JSON: { "reachable": boolean, "httpStatus": number|null, "title": string, "excerpt": string (400-2500 chars quoted from the live page), "callUrl": string (canonical official URL), "documents": [{"title": string, "url": string}] }`,
        `httpStatus: 200 if the public page opened; 401/403/404 only if the live page really returned that; null if unknown.`,
      ]
        .filter(Boolean)
        .join('\n'),
      {
        model: 'claude-opus-4-6',
        maxOutputTokens: 4000,
        temperature: 0.05,
        timeoutMs: 90_000,
        webSearchMaxUses: 4,
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
      const reachable = parsed.reachable === true && excerpt.length >= 80;
      return {
        reachable,
        excerpt: excerpt.slice(0, 8000),
        callUrl: typeof parsed.callUrl === 'string' ? parsed.callUrl : undefined,
        documents: normalizeCallDocuments(parsed.documents),
        httpStatus: typeof parsed.httpStatus === 'number' ? parsed.httpStatus : undefined,
      };
    } catch {
      const excerpt = raw.trim();
      if (excerpt.length >= 200 && !looksUnreachable(excerpt)) {
        return { reachable: true, excerpt: excerpt.slice(0, 8000), documents: [] };
      }
      return empty;
    }
  } catch {
    return empty;
  }
}
