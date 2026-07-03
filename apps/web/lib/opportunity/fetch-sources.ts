import 'server-only';

import type { FundingSourceRef } from '@/lib/opportunity/scan-types';

export type SourceSnippet = {
  name: string;
  url: string;
  text: string;
  ok: boolean;
  statusCode?: number;
};

const MAX_SOURCES = 8;
const FETCH_TIMEOUT_MS = 10_000;
const MAX_TEXT_PER_SOURCE = 12_000;

function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isSafeUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

async function fetchOne(source: FundingSourceRef): Promise<SourceSnippet> {
  if (!isSafeUrl(source.url)) {
    return { name: source.name, url: source.url, text: '', ok: false };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(source.url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Etholys-Opportunity-Scanner/1.0 (+https://etholys.app)',
        Accept: 'text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.8',
      },
      redirect: 'follow',
    });

    const contentType = res.headers.get('content-type') ?? '';
    const raw = await res.text();
    const text =
      contentType.includes('html') || raw.includes('<html')
        ? htmlToText(raw).slice(0, MAX_TEXT_PER_SOURCE)
        : raw.slice(0, MAX_TEXT_PER_SOURCE);

    return {
      name: source.name,
      url: source.url,
      text,
      ok: res.ok && text.length > 80,
      statusCode: res.status,
    };
  } catch {
    return { name: source.name, url: source.url, text: '', ok: false };
  } finally {
    clearTimeout(timer);
  }
}

/** Busca texto das URLs monitorizadas (crawl leve) para enriquecer a varredura. */
export async function fetchSourceSnippets(
  sources: FundingSourceRef[],
): Promise<{ snippets: SourceSnippet[]; fetched: number; errors: number }> {
  const batch = sources.slice(0, MAX_SOURCES);
  const snippets = await Promise.all(batch.map(fetchOne));
  const fetched = snippets.filter((s) => s.ok).length;
  const errors = snippets.length - fetched;
  return { snippets, fetched, errors };
}

export function snippetsToPromptBlock(snippets: SourceSnippet[]): string {
  const parts: string[] = [];
  for (const s of snippets) {
    if (s.ok && s.text) {
      parts.push(
        `### ${s.name}\nURL: ${s.url}\nConteúdo extraído (trecho):\n${s.text.slice(0, 4000)}`,
      );
    } else {
      parts.push(`### ${s.name}\nURL: ${s.url}\n(fetch falhou — usar conhecimento geral desta instituição)`);
    }
  }
  return parts.join('\n\n');
}
