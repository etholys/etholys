import 'server-only';

import { isSafePublicHttpUrl } from '@/lib/opportunity/call-evidence';
import { officialFetchHeaders } from '@/lib/opportunity/official-fetch-headers';
import { isBotWallHtml } from '@/lib/opportunity/official-html';
import { isAggregatorFundingUrl } from '@/lib/opportunity/official-url';

export { htmlToExcerpt, siteNameFromHtml, titleFromHtml } from '@/lib/opportunity/official-html';
export { OFFICIAL_FETCH_UA, officialFetchHeaders } from '@/lib/opportunity/official-fetch-headers';

const DEFAULT_MS = 25_000;
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

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchOfficialResource(
  url: string,
  opts?: { timeoutMs?: number; asFile?: boolean; attempts?: number },
): Promise<OfficialFetchResult> {
  const empty: OfficialFetchResult = { ok: false, status: 0, finalUrl: url, type: '', html: '', bytes: null };
  if (!isSafePublicHttpUrl(url) || isAggregatorFundingUrl(url)) return empty;

  const timeoutMs = opts?.timeoutMs ?? DEFAULT_MS;
  const attempts = Math.min(4, Math.max(1, opts?.attempts ?? 3));
  let last = empty;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (attempt > 0) await sleep(450 * attempt);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        redirect: 'follow',
        headers: officialFetchHeaders(url),
      });
      const finalUrl = res.url || url;
      const type = res.headers.get('content-type') || '';
      last = { ...empty, status: res.status, finalUrl, type };
      if (!res.ok) {
        last.ok = false;
        if ([401, 403, 404].includes(res.status) && attempt >= 1) break;
        continue;
      }
      if (opts?.asFile || type.includes('pdf') || /\.(pdf|docx?|xlsx?|zip)(?:$|[?#])/i.test(finalUrl)) {
        const buf = Buffer.from(await res.arrayBuffer());
        if (buf.length === 0 || buf.length > MAX_FILE) return { ...last, ok: false };
        return { ...last, ok: true, bytes: buf, html: '' };
      }
      const html = (await res.text()).slice(0, MAX_HTML);
      if (html.length < 40 && !type.includes('html')) return { ...last, ok: false, html };
      if (isBotWallHtml(html)) {
        last = { ...last, ok: false, html };
        continue;
      }
      return { ...last, ok: true, html };
    } catch {
      last = { ...empty, finalUrl: url };
    } finally {
      clearTimeout(timer);
    }
  }
  return last;
}
