/**
 * R2 — base permanente de portais oficiais + fontes monitorizadas.
 * Pure helpers (sem DB) para montar o conjunto de refresh da descoberta.
 */

import { OFFICIAL_PORTALS, type OfficialPortal } from '@/lib/opportunity/official-portals';
import type { FundingSourceRef } from '@/lib/opportunity/scan-types';

export type PortalRefreshSource = FundingSourceRef & {
  id?: string;
  kind: 'official' | 'monitored' | 'catalog';
  region?: OfficialPortal['region'];
};

const LATAM_COUNTRY_KEYS = [
  'uy',
  'uruguay',
  'br',
  'brasil',
  'brazil',
  'ar',
  'argentina',
  'cl',
  'chile',
  'py',
  'paraguay',
  'bo',
  'bolivia',
  'pe',
  'peru',
  'co',
  'colombia',
  'mx',
  'mexico',
  'ec',
  'ecuador',
  've',
  'venezuela',
  'latam',
  'latin america',
  'america latina',
];

export function sourceHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./i, '').toLowerCase();
  } catch {
    return url.trim().toLowerCase();
  }
}

/** Deduplica por host; preferência: monitored > catalog > official (mesma ordem de inserção). */
export function dedupePortalSourcesByHost(sources: PortalRefreshSource[]): PortalRefreshSource[] {
  const byHost = new Map<string, PortalRefreshSource>();
  const priority = { monitored: 3, catalog: 2, official: 1 } as const;
  for (const s of sources) {
    const host = sourceHost(s.url);
    if (!host) continue;
    const prev = byHost.get(host);
    if (!prev || priority[s.kind] >= priority[prev.kind]) {
      byHost.set(host, s);
    }
  }
  return [...byHost.values()];
}

/**
 * Filtra portais oficiais úteis ao perfil geográfico.
 * Sem países → todos. LatAm → latam+global (+br se Brasil). Sempre inclui global.
 */
export function selectOfficialPortalsForCountries(countries: string[] = []): OfficialPortal[] {
  if (!countries.length) return [...OFFICIAL_PORTALS];
  const blob = countries
    .join(' ')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  const wantsLatam = LATAM_COUNTRY_KEYS.some((k) => blob.includes(k));
  const wantsBr = /\b(br|brasil|brazil)\b/.test(blob);
  const wantsEu = /\b(eu|europa|europe|spain|espanha|espana|portugal|france|germany)\b/.test(blob);
  const wantsUs = /\b(us|usa|united states|estados unidos|eeuu)\b/.test(blob);

  return OFFICIAL_PORTALS.filter((p) => {
    if (p.region === 'global') return true;
    if (p.region === 'latam' && wantsLatam) return true;
    if (p.region === 'br' && (wantsBr || wantsLatam)) return true;
    if (p.region === 'eu' && wantsEu) return true;
    if (p.region === 'us' && wantsUs) return true;
    return false;
  });
}

export function officialPortalsAsRefreshSources(countries?: string[]): PortalRefreshSource[] {
  return selectOfficialPortalsForCountries(countries).map((p) => ({
    id: p.id,
    name: p.name,
    url: p.url,
    kind: 'official' as const,
    region: p.region,
  }));
}

export function buildPortalRefreshBase(opts: {
  countries?: string[];
  monitored?: FundingSourceRef[];
  catalogHints?: FundingSourceRef[];
  /** Máx. URLs a devolver (fetch leve). Default 12. */
  limit?: number;
}): PortalRefreshSource[] {
  const official = officialPortalsAsRefreshSources(opts.countries);
  const monitored = (opts.monitored ?? []).map((m) => ({
    ...m,
    kind: 'monitored' as const,
  }));
  const catalog = (opts.catalogHints ?? []).map((c) => ({
    ...c,
    kind: 'catalog' as const,
  }));
  // Preferência: monitored primeiro (override host), depois catalog, depois official.
  const merged = dedupePortalSourcesByHost([...monitored, ...catalog, ...official]);
  const limit = opts.limit ?? 12;
  return merged.slice(0, limit);
}
