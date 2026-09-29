/** Persistência do âmbito de cliente RADAR (prestadora). */

export const RADAR_CLIENT_ALL = 'all' as const;

export type RadarClientScopeId = typeof RADAR_CLIENT_ALL | string;

const storageKey = (companyId: string) => `radar.clientScope.${companyId}`;

export function readRadarClientScope(companyId: string): RadarClientScopeId | null {
  if (typeof window === 'undefined' || !companyId) return null;
  try {
    const raw = localStorage.getItem(storageKey(companyId));
    if (!raw) return null;
    return raw === RADAR_CLIENT_ALL || raw.length > 0 ? raw : null;
  } catch {
    return null;
  }
}

export function writeRadarClientScope(companyId: string, scope: RadarClientScopeId) {
  if (typeof window === 'undefined' || !companyId) return;
  try {
    localStorage.setItem(storageKey(companyId), scope);
  } catch {
    /* ignore */
  }
}

export function parseRadarClientFromSearch(search: URLSearchParams): RadarClientScopeId | null {
  const raw = String(search.get('client') || '').trim();
  if (!raw) return null;
  if (raw === RADAR_CLIENT_ALL || raw === 'todos') return RADAR_CLIENT_ALL;
  return raw;
}

export function withRadarClientParam(
  href: string,
  companyId: string,
  clientScope: RadarClientScopeId | null,
  extra?: Record<string, string | null | undefined>,
) {
  const url = new URL(href, 'http://local');
  if (companyId) url.searchParams.set('company', companyId);
  if (clientScope) url.searchParams.set('client', clientScope);
  if (extra) {
    for (const [k, v] of Object.entries(extra)) {
      if (v == null || v === '') url.searchParams.delete(k);
      else url.searchParams.set(k, v);
    }
  }
  return `${url.pathname}${url.search}`;
}
