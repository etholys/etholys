/** Portais oficiais de convocatórias — nunca agregadores. */

export type OfficialPortal = {
  id: string;
  name: string;
  url: string;
  region: 'latam' | 'global' | 'eu' | 'us' | 'br';
};

export const OFFICIAL_PORTALS: OfficialPortal[] = [
  { id: 'iadb', name: 'BID / IDB', url: 'https://www.iadb.org/en/how-we-can-work-together/calls-proposals', region: 'latam' },
  { id: 'idblab', name: 'IDB Lab', url: 'https://bidlab.org/en', region: 'latam' },
  { id: 'caf', name: 'CAF', url: 'https://www.caf.com/', region: 'latam' },
  { id: 'fontagro', name: 'FONTAGRO', url: 'https://www.fontagro.org/', region: 'latam' },
  { id: 'ifad', name: 'FIDA / IFAD', url: 'https://www.ifad.org/en/w/calls-for-proposal', region: 'global' },
  { id: 'fao', name: 'FAO', url: 'https://www.fao.org/partnerships/calls/en', region: 'global' },
  { id: 'gcf', name: 'Green Climate Fund', url: 'https://www.greenclimate.fund/funding/rfp-rfq', region: 'global' },
  { id: 'adaptation', name: 'Adaptation Fund', url: 'https://www.adaptation-fund.org/apply-for-funding/', region: 'global' },
  { id: 'gef', name: 'GEF', url: 'https://www.thegef.org/work-with-us', region: 'global' },
  { id: 'worldbank', name: 'World Bank', url: 'https://www.worldbank.org/en/programs-and-projects', region: 'global' },
  { id: 'horizon', name: 'Horizon Europe', url: 'https://ec.europa.eu/info/funding-tenders/opportunities/portal/screen/opportunities/calls-for-proposals', region: 'eu' },
  { id: 'grantsgov', name: 'Grants.gov (US)', url: 'https://www.grants.gov/search-grants', region: 'us' },
  { id: 'finep', name: 'Finep (BR)', url: 'https://www.finep.gov.br/', region: 'br' },
  { id: 'cnpq', name: 'CNPq (BR)', url: 'https://www.gov.br/cnpq/pt-br', region: 'br' },
];

export function originScanLabel(
  scanFocus: string | null | undefined,
  locale: string,
): string {
  const pt = locale === 'pt';
  const es = locale === 'es';
  if (scanFocus === 'reference') return pt ? 'Mapear programas' : es ? 'Mapear programas' : 'Map programs';
  if (scanFocus === 'known') return pt ? 'Já conhecido' : es ? 'Ya conocido' : 'Already known';
  if (scanFocus === 'open_now') return pt ? 'Abertos agora' : es ? 'Abiertos ahora' : 'Open now';
  return pt ? 'Busca' : es ? 'Búsqueda' : 'Search';
}

export function formatOriginLine(
  origin: { scanFocus?: string; savedAt?: string } | null | undefined,
  locale: string,
): string {
  if (!origin) return '';
  const kind = originScanLabel(origin.scanFocus, locale);
  if (!origin.savedAt) return kind;
  const d = new Date(origin.savedAt);
  if (Number.isNaN(d.getTime())) return kind;
  const loc = locale === 'pt' ? 'pt-BR' : locale === 'es' ? 'es-ES' : 'en-US';
  return `${kind} · ${d.toLocaleDateString(loc, { day: 'numeric', month: 'short' })}`;
}
