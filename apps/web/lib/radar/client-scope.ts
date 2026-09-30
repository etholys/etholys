/** Âmbito RADAR: operação própria | todos | cliente concreto. */

export const RADAR_SCOPE_ALL = 'all' as const;
export const RADAR_SCOPE_OWN = 'own' as const;

export type RadarScopeId = typeof RADAR_SCOPE_ALL | typeof RADAR_SCOPE_OWN | string;

const storageKey = (companyId: string) => `radar.scope.${companyId}`;

export function readRadarScope(companyId: string): RadarScopeId | null {
  if (typeof window === 'undefined' || !companyId) return null;
  try {
    const raw = localStorage.getItem(storageKey(companyId));
    if (!raw) {
      // migrate legacy key
      const legacy = localStorage.getItem(`radar.clientScope.${companyId}`);
      if (legacy === 'all' || legacy === 'todos') return RADAR_SCOPE_ALL;
      if (legacy) return legacy;
      return null;
    }
    if (raw === 'todos') return RADAR_SCOPE_ALL;
    return raw;
  } catch {
    return null;
  }
}

export function writeRadarScope(companyId: string, scope: RadarScopeId) {
  if (typeof window === 'undefined' || !companyId) return;
  try {
    localStorage.setItem(storageKey(companyId), scope);
  } catch {
    /* ignore */
  }
}

export function parseRadarScopeFromSearch(search: URLSearchParams): RadarScopeId | null {
  const raw = String(search.get('client') || search.get('scope') || '').trim();
  if (!raw) return null;
  if (raw === RADAR_SCOPE_ALL || raw === 'todos') return RADAR_SCOPE_ALL;
  if (raw === RADAR_SCOPE_OWN || raw === 'mine' || raw === 'minha') return RADAR_SCOPE_OWN;
  return raw;
}

/** @deprecated use RADAR_SCOPE_ALL */
export const RADAR_CLIENT_ALL = RADAR_SCOPE_ALL;
/** @deprecated use RadarScopeId */
export type RadarClientScopeId = RadarScopeId;
/** @deprecated */
export const readRadarClientScope = readRadarScope;
/** @deprecated */
export const writeRadarClientScope = writeRadarScope;
/** @deprecated */
export const parseRadarClientFromSearch = parseRadarScopeFromSearch;
