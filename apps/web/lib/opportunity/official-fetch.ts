import 'server-only';

import { isSafePublicHttpUrl } from '@/lib/opportunity/call-evidence';
import { isAggregatorFundingUrl } from '@/lib/opportunity/official-url';

export { htmlToExcerpt, siteNameFromHtml, titleFromHtml } from '@/lib/opportunity/official-html';

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';

const DEFAULT_MS = 20_000;
const MAX_HTML = 500_000;
const MAX_FILE = 10 * 1024 * 1024;

export type OfficialFetchResult = {
  ok: boolean;
  status: number;
  finalUrl: string;
  type: string;
  html: string;
  bytes: Buffer | null;
};

const COMMON_HEADERS = {
  'User-Agent': BROWSER_UA,
  Accept: 'text/html,application/xhtml+xml,application/pdf;q=0.9,application/octet-stream;q=0.8,*/*;q=0.7',
  'Accept-Language': 'en,pt,es;q=0.8',
  'Cache-Control': 'no-cache',
};

export async function fetchOfficialResource(
  url: string,
  opts?: { timeoutMs?: number; asFile?: boolean },
): Promise<OfficialFetchResult> {
  const empty: OfficialFetchResult = { ok: false, status: 0, finalUrl: url, type: '', html: '', bytes: null };
  if (!isSafePublicHttpUrl(url) || isAggregatorFundingUrl(url)) return empty;

  const timeoutMs = opts?.timeoutMs ?? DEFAULT_MS;
  let last = empty;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        redirect: 'follow',
        headers: COMMON_HEADERS,
      });
      const finalUrl = res.url || url;
      const type = res.headers.get('content-type') || '';
      last = { ...empty, status: res.status, finalUrl, type };
      if (!res.ok) {
        last.ok = false;
        continue;
      }
      if (opts?.asFile || type.includes('pdf') || /\.(pdf|docx?|xlsx?|zip)(?:$|[?#])/i.test(finalUrl)) {
        const buf = Buffer.from(await res.arrayBuffer());
        if (buf.length === 0 || buf.length > MAX_FILE) return { ...last, ok: false };
        return { ...last, ok: true, bytes: buf, html: '' };
      }
      const html = (await res.text()).slice(0, MAX_HTML);
      if (html.length < 40 && !type.includes('html')) return { ...last, ok: false, html };
      return { ...last, ok: true, html };
    } catch {
      last = { ...empty, finalUrl: url };
    } finally {
      clearTimeout(timer);
    }
  }
  return last;
}

