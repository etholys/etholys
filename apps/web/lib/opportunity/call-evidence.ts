import { isAggregatorFundingUrl, sanitizeFundingLinks } from '@/lib/opportunity/official-url';
import type { CallDocument, CallEvidence, ScanCandidate } from '@/lib/opportunity/scan-types';

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

/** Listing index (`/calls-for-proposal`) — not the call slug. */
export function isLikelyListingUrl(url: string | null | undefined): boolean {
  if (!url || !isSafePublicHttpUrl(url)) return false;
  try {
    const u = new URL(url);
    const parts = u.pathname.replace(/\/+$/, '').split('/').filter(Boolean);
    const last = parts[parts.length - 1] || '';
    return /^(calls-for-proposal|calls|convocatorias?|editais|opportunities|grants|funding|chamadas?)$/i.test(
      last,
    );
  } catch {
    return false;
  }
}

export function isLikelyCallPageUrl(url: string | null | undefined): boolean {
  if (!url || !isSafePublicHttpUrl(url) || isAggregatorFundingUrl(url)) return false;
  if (isLikelyHomepageUrl(url) || isLikelyListingUrl(url)) return false;
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

const DOC_TEXT =
  /bases|anexo|annex|formulario|formul[aá]rio|guia|guide|guidelines|applicants|terms of reference|edital|convocator|application\s+pack|descarg|download|concept\s*note|nota\s+conceptual|self-?certif|template|activity-?based\s+budget|grant\s+detailed|documento oficial|eligibility for ifad/i;

const DOC_HREF =
  /\.(pdf|docx?|xlsx?|zip)(?:$|[?#])|\/documents\/|\/download|\/file\/|annex|anexo|guidelines|concept-?note|viewguidelines|attachment/i;

/** Extrai PDFs/Word/Excel e anexos (Annex, Concept Note, Guidelines) mesmo sem .pdf no href. */
export function extractDocumentLinks(html: string, pageUrl: string): CallDocument[] {
  const found: CallDocument[] = [];
  const re = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const abs = resolveUrl(m[1] ?? '', pageUrl);
    if (!abs || !isSafePublicHttpUrl(abs) || isAggregatorFundingUrl(abs)) continue;
    const text = (m[2] ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    const isFile = /\.(pdf|docx?|xlsx?|zip)(?:$|[?#])/i.test(abs);
    if (!isFile && !DOC_TEXT.test(text) && !DOC_HREF.test(abs) && !DOC_HREF.test(text)) continue;
    found.push({ title: text || abs.split('/').pop() || 'Documento', url: abs });
  }

  const fileRe = /https?:\/\/[^\s"'<>]+\.(?:pdf|docx?|xlsx?|zip)(?:\?[^\s"'<>]*)?/gi;
  let f: RegExpExecArray | null;
  while ((f = fileRe.exec(html))) {
    const abs = f[0];
    if (!isSafePublicHttpUrl(abs) || isAggregatorFundingUrl(abs)) continue;
    found.push({ title: decodeURIComponent(abs.split('/').pop() || 'Documento'), url: abs });
  }

  const libraryRe = /https?:\/\/[^\s"'<>]+\/documents\/[^\s"'<>]+/gi;
  let lib: RegExpExecArray | null;
  while ((lib = libraryRe.exec(html))) {
    const abs = lib[0].replace(/[),.;]+$/, '');
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

export function isHardOfficialHttpFailure(status: number | undefined): boolean {
  return status === 401 || status === 403 || status === 404;
}

export function parseCallEvidence(raw: unknown): CallEvidence | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const o = raw as Record<string, unknown>;
  if (o.status !== 'verified' && o.status !== 'unconfirmed' && o.status !== 'failed') return undefined;
  return {
    status: o.status,
    verifiedAt: typeof o.verifiedAt === 'string' ? o.verifiedAt : undefined,
    callUrl: typeof o.callUrl === 'string' ? o.callUrl : undefined,
    documentCount: typeof o.documentCount === 'number' ? o.documentCount : 0,
    httpOk: typeof o.httpOk === 'boolean' ? o.httpOk : undefined,
    httpStatus: typeof o.httpStatus === 'number' ? o.httpStatus : undefined,
    verifiedVia: o.verifiedVia === 'http' || o.verifiedVia === 'web_search' ? o.verifiedVia : undefined,
  };
}

export function buildCallEvidence(
  c: Pick<ScanCandidate, 'callUrl' | 'linkOficial' | 'sourceUrl' | 'documents' | 'evidence'>,
  opts?: {
    httpOk?: boolean;
    verifiedAt?: string;
    httpStatus?: number;
    verifiedVia?: 'http' | 'web_search';
  },
): CallEvidence {
  const call = pickOfficialCallUrl(c);
  const documentCount = c.documents?.length ?? 0;
  const httpOk = opts?.httpOk ?? c.evidence?.httpOk;
  const httpStatus = opts?.httpStatus ?? c.evidence?.httpStatus;
  const verifiedVia = opts?.verifiedVia ?? c.evidence?.verifiedVia;
  const official = hasOfficialCallEvidence(c);
  if (httpOk === false && isHardOfficialHttpFailure(httpStatus) && (call || official)) {
    return {
      status: 'failed',
      callUrl: call,
      documentCount,
      httpOk: false,
      httpStatus,
      verifiedAt: opts?.verifiedAt ?? c.evidence?.verifiedAt,
    };
  }
  if (httpOk === true && official) {
    return {
      status: 'verified',
      callUrl: call,
      documentCount,
      httpOk: true,
      httpStatus: httpStatus ?? 200,
      verifiedVia,
      verifiedAt: opts?.verifiedAt ?? c.evidence?.verifiedAt ?? new Date().toISOString(),
    };
  }
  return {
    status: 'unconfirmed',
    callUrl: call,
    documentCount,
    httpOk,
    httpStatus,
    verifiedVia,
    verifiedAt: c.evidence?.verifiedAt,
  };
}

export function canOpenProposalBlind(c: Pick<ScanCandidate, 'evidence' | 'callUrl' | 'documents' | 'linkOficial' | 'sourceUrl'>): boolean {
  return evidenceForDisplay(c).status === 'verified';
}

/** Homepage / listing must never show as verified. */
export function evidenceForDisplay(
  c: Pick<ScanCandidate, 'callUrl' | 'linkOficial' | 'sourceUrl' | 'documents' | 'evidence'>,
): CallEvidence {
  const ev = c.evidence ?? buildCallEvidence(c);
  if (ev.status !== 'verified') return ev;
  const call = ev.callUrl || pickOfficialCallUrl(c);
  if (call && isLikelyCallPageUrl(call)) return ev;
  const docs = ev.documentCount > 0 || (c.documents?.length ?? 0) > 0;
  if (docs && call && !isLikelyHomepageUrl(call) && !isLikelyListingUrl(call)) return ev;
  return { ...ev, status: 'unconfirmed' };
}

export function evidenceLine(
  ev: CallEvidence,
  locale: string,
): { label: string; tone: 'ok' | 'warn' | 'bad' } {
  const pt = locale === 'pt';
  const es = locale === 'es';
  const docs =
    ev.documentCount > 0
      ? pt
        ? `${ev.documentCount} documento${ev.documentCount === 1 ? '' : 's'}`
        : es
          ? `${ev.documentCount} documento${ev.documentCount === 1 ? '' : 's'}`
          : `${ev.documentCount} document${ev.documentCount === 1 ? '' : 's'}`
      : pt
        ? 'sem anexos'
        : es
          ? 'sin anexos'
          : 'no attachments';
  if (ev.status === 'verified') {
    const when = ev.verifiedAt
      ? new Date(ev.verifiedAt).toLocaleDateString(pt ? 'pt-PT' : es ? 'es-ES' : 'en-US', {
          day: 'numeric',
          month: 'short',
        })
      : '';
    const head = when
      ? pt
        ? `Verificado ${when}`
        : es
          ? `Verificado ${when}`
          : `Verified ${when}`
      : pt
        ? 'Verificado'
        : es
          ? 'Verificado'
          : 'Verified';
    return {
      label: `${head} · ${pt || es ? 'página oficial' : 'official page'} · ${docs}`,
      tone: 'ok',
    };
  }
  if (ev.status === 'failed') {
    const code = ev.httpStatus;
    if (code === 401) {
      return {
        label: pt
          ? 'Página oficial exige autenticação (401)'
          : es
            ? 'La página oficial exige autenticación (401)'
            : 'Official page requires authentication (401)',
        tone: 'bad',
      };
    }
    if (code === 403) {
      return {
        label: pt
          ? 'Página oficial bloqueou o acesso (403)'
          : es
            ? 'La página oficial bloqueó el acceso (403)'
            : 'Official page blocked access (403)',
        tone: 'bad',
      };
    }
    if (code === 404) {
      return {
        label: pt
          ? 'Página oficial não existe (404)'
          : es
            ? 'La página oficial no existe (404)'
            : 'Official page not found (404)',
        tone: 'bad',
      };
    }
    if (code && code > 0) {
      return {
        label: pt
          ? `Página oficial HTTP ${code}`
          : es
            ? `Página oficial HTTP ${code}`
            : `Official page HTTP ${code}`,
        tone: 'bad',
      };
    }
    return {
      label: pt
        ? 'Página oficial sem resposta HTTP (timeout/rede)'
        : es
          ? 'Página oficial sin respuesta HTTP (timeout/red)'
          : 'Official page no HTTP response (timeout/network)',
      tone: 'bad',
    };
  }
  if (ev.httpStatus && ev.httpStatus > 0) {
    return {
      label: pt
        ? `Página oficial HTTP ${ev.httpStatus}`
        : es
          ? `Página oficial HTTP ${ev.httpStatus}`
          : `Official page HTTP ${ev.httpStatus}`,
      tone: 'warn',
    };
  }
  if (ev.httpOk === false || ev.httpStatus === 0) {
    return {
      label: pt
        ? 'Página oficial sem resposta HTTP (timeout/rede)'
        : es
          ? 'Página oficial sin respuesta HTTP (timeout/red)'
          : 'Official page no HTTP response (timeout/network)',
      tone: 'warn',
    };
  }
  return {
    label: pt
      ? 'Não confirmado — sem página oficial da convocatória'
      : es
        ? 'No confirmado — sin página oficial de la convocatoria'
        : 'Unconfirmed — no official call page',
    tone: 'warn',
  };
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
