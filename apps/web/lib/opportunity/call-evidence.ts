import { isAggregatorFundingUrl, sanitizeFundingLinks } from '@/lib/opportunity/official-url';
import type { CallDocument, ScanCandidate } from '@/lib/opportunity/scan-types';

const CALL_PATH_HINT =
  /convocator|edital|edicto|call-for|callfor|calls\/|funding|apply|aplicac|postul|oportunid|chamada|grant|licitac|tender|rfp|notice|fondo|fund|programme|programa\/|bekend|ausschreib|subvenc/i;

const HOMEPAGE_PATH = /^\/(?:(?:es|en|pt|fr|de|it|uk|uy|br|ar|cl|mx|pe|co)(?:-[a-z]{2})?)?\/?$/i;

export function isSafePublicHttpUrl(url: string | null | undefined): boolean {
  if (!url?.trim()) return false;
  try {
    const u = new URL(url.trim());
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
    const host = u.hostname.toLowerCase();
    if (host === 'localhost' || host.endsWith('.localhost')) return false;
    if (host === '127.0.0.1' || host === '0.0.0.0' || host === '::1') return false;
    if (/^10\./.test(host) || /^192\.168\./.test(host) || /^172\.(1[6-9]|2\d|3[0-1])\./.test(host)) {
      return false;
    }
    if (host.startsWith('169.254.') || host.endsWith('.local') || host.endsWith('.internal')) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export function isLikelyHomepageUrl(url: string | null | undefined): boolean {
  if (!url || !isSafePublicHttpUrl(url)) return false;
  try {
    const u = new URL(url);
    const path = u.pathname.replace(/\/+$/, '') || '/';
    if (u.search && CALL_PATH_HINT.test(u.search)) return false;
    return path === '/' || HOMEPAGE_PATH.test(path + '/') || /^\/index\.(html?|php)$/i.test(path);
  } catch {
    return false;
  }
}

export function isLikelyCallPageUrl(url: string | null | undefined): boolean {
  if (!url || !isSafePublicHttpUrl(url) || isAggregatorFundingUrl(url)) return false;
  if (isLikelyHomepageUrl(url)) return false;
  try {
    const u = new URL(url);
    const hay = `${u.pathname} ${u.search} ${u.hash}`;
    if (CALL_PATH_HINT.test(hay)) return true;
    if (/\.(pdf|docx?|xlsx?)$/i.test(u.pathname)) return true;
    if (/\/20\d{2}\b/.test(u.pathname) && u.pathname.split('/').filter(Boolean).length >= 2) return true;
    return u.pathname.split('/').filter(Boolean).length >= 2;
  } catch {
    return false;
  }
}

export function pickOfficialCallUrl(c: Pick<ScanCandidate, 'callUrl' | 'linkOficial' | 'sourceUrl'>): string | undefined {
  const raw = [c.callUrl, c.linkOficial, c.sourceUrl].filter(Boolean) as string[];
  const cleaned = raw
    .map((u) => sanitizeFundingLinks(u).linkOficial)
    .filter((u): u is string => Boolean(u && isSafePublicHttpUrl(u)));
  const callPage = cleaned.find((u) => isLikelyCallPageUrl(u));
  if (callPage) return callPage;
  return cleaned.find((u) => !isLikelyHomepageUrl(u)) ?? cleaned[0];
}

export function pickInstitutionUrl(
  c: Pick<ScanCandidate, 'institutionUrl' | 'linkOficial' | 'callUrl' | 'sourceUrl'>,
): string | undefined {
  const raw = [c.institutionUrl, c.linkOficial].filter(Boolean) as string[];
  for (const url of raw) {
    if (!isSafePublicHttpUrl(url) || isAggregatorFundingUrl(url)) continue;
    if (isLikelyHomepageUrl(url) || !isLikelyCallPageUrl(url)) return url;
  }
  const call = pickOfficialCallUrl(c);
  if (!call) return undefined;
  try {
    return new URL(call).origin + '/';
  } catch {
    return undefined;
  }
}

export function documentKindFromUrl(url: string, title = ''): CallDocument['kind'] {
  const hay = `${url} ${title}`.toLowerCase();
  if (hay.includes('.pdf') || hay.includes('pdf')) return 'pdf';
  if (/\.docx?(\b|$)/.test(hay) || hay.includes('word')) return 'doc';
  if (/\.xlsx?(\b|$)/.test(hay) || hay.includes('excel') || hay.includes('xls')) return 'sheet';
  if (hay.includes('.zip') || hay.includes('.rar')) return 'zip';
  return 'other';
}

function decodeHref(raw: string): string {
  return raw.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();
}

function resolveUrl(href: string, base: string): string | null {
  try {
    return new URL(decodeHref(href), base).toString();
  } catch {
    return null;
  }
}

/** Extrai PDFs/Word/Excel e anexos óbvios do HTML da convocatória. */
export function extractDocumentLinks(html: string, pageUrl: string): CallDocument[] {
  const found: CallDocument[] = [];
  const re = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const abs = resolveUrl(m[1] ?? '', pageUrl);
    if (!abs || !isSafePublicHttpUrl(abs) || isAggregatorFundingUrl(abs)) continue;
    const text = (m[2] ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    const isFile = /\.(pdf|docx?|xlsx?|zip)(?:$|[?#])/i.test(abs);
    const looksDoc =
      isFile ||
      /bases|anexo|formulario|guia|guide|terms|edital|convocator|application\s+pack|descarg/i.test(text);
    if (!looksDoc) continue;
    if (!isFile && !/\.(pdf|docx?|xlsx?|zip)(?:$|[?#])/i.test(text)) {
      if (!/download|documento|attachment|file|pdf/i.test(abs)) continue;
    }
    found.push({ title: text || abs.split('/').pop() || 'Documento', url: abs });
  }

  const fileRe = /https?:\/\/[^\s"'<>]+\.(?:pdf|docx?|xlsx?|zip)(?:\?[^\s"'<>]*)?/gi;
  let f: RegExpExecArray | null;
  while ((f = fileRe.exec(html))) {
    const abs = f[0];
    if (!isSafePublicHttpUrl(abs) || isAggregatorFundingUrl(abs)) continue;
    found.push({ title: decodeURIComponent(abs.split('/').pop() || 'Documento'), url: abs });
  }

  return normalizeCallDocuments(found);
}

export function normalizeCallDocuments(raw: unknown): CallDocument[] {
  if (!Array.isArray(raw)) return [];
  const out: CallDocument[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    const url = typeof o.url === 'string' ? o.url.trim() : '';
    if (!isSafePublicHttpUrl(url) || isAggregatorFundingUrl(url)) continue;
    const key = url.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const title =
      (typeof o.title === 'string' && o.title.trim()
        ? o.title.trim()
        : decodeURIComponent(url.split('/').pop() || 'Documento')
      ).slice(0, 160);
    out.push({
      title,
      url: url.slice(0, 700),
      kind: documentKindFromUrl(url, title),
    });
    if (out.length >= 12) break;
  }
  return out;
}

export function hasOfficialCallEvidence(
  c: Pick<ScanCandidate, 'callUrl' | 'linkOficial' | 'sourceUrl' | 'documents'>,
): boolean {
  const call = pickOfficialCallUrl(c);
  if (call && isLikelyCallPageUrl(call)) return true;
  if ((c.documents?.length ?? 0) > 0) return true;
  return false;
}

/** Sem página de convocatória e nome genérico = quase certamente inventado. */
export function looksInventedWithoutEvidence(
  c: Pick<ScanCandidate, 'name' | 'callUrl' | 'linkOficial' | 'sourceUrl' | 'documents'>,
): boolean {
  if (hasOfficialCallEvidence(c)) return false;
  const call = pickOfficialCallUrl(c);
  if (!call) return true;
  return isLikelyHomepageUrl(call);
}
