import type { OpportunityBriefing } from '@/lib/opportunity/scan-types';

export type DiscoveryRegion = 'br' | 'us' | 'latam' | 'eu' | 'global';

function fold(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/** Temas compactos para queries site: — sem inventar sectores. */
export function themeQueryBlob(themes: string[]): string {
  const parts = themes.map((t) => t.trim()).filter(Boolean).slice(0, 6);
  return parts.join(' OR ') || 'rural OR green OR circular OR digital';
}

export function detectDiscoveryRegions(countries: string[]): DiscoveryRegion[] {
  const blob = fold(countries.join(' '));
  const out = new Set<DiscoveryRegion>();
  if (/brasil|brazil/.test(blob)) out.add('br');
  if (/estados unidos|united states|\beua\b|\busa\b|eua\b/.test(blob)) out.add('us');
  if (/america latina|latin america|latam|latinoameric/.test(blob)) out.add('latam');
  if (/europa|europe|europeia|europea|\bue\b|\beu\b/.test(blob)) out.add('eu');
  if (out.size === 0) out.add('global');
  out.add('global');
  return [...out];
}

const PORTAL_BUILDERS: Record<DiscoveryRegion, (themes: string) => string[]> = {
  br: (t) => [
    `site:finep.gov.br (chamada OR edital) (${t})`,
    `site:gov.br (chamada pública OR edital) (${t}) 2026`,
    `site:bndes.gov.br (chamada OR edital) (${t})`,
  ],
  us: (t) => [
    `site:grants.gov (${t}) (forecast OR posted) grant`,
    `site:usda.gov (NIFA OR RFA) (${t})`,
    `site:epa.gov (grant OR RFA) (${t}) open`,
  ],
  latam: (t) => [
    `site:iadb.org "call for proposals" (${t})`,
    `site:caf.com (convocatoria OR "call for") (${t})`,
    `site:fontagro.org convocatoria`,
  ],
  eu: (t) => [
    `site:funding-tenders.europa.eu (${t}) call`,
    `site:ec.europa.eu LIFE "call for proposals"`,
    `Horizon Europe open call (${t}) funding-tenders.europa.eu`,
  ],
  global: (t) => [
    `site:greenclimate.fund (RFP OR RFA OR "call for") (${t})`,
    `site:thegef.org "call for proposals"`,
    `site:adaptation-fund.org (grant OR proposal) open`,
    `(${t}) official "call for proposals" open grant 2026`,
  ],
};

/** Queries oficiais que o scout DEVE correr — portais, não agregadores. */
export function buildDiscoverySearchQueries(briefing: OpportunityBriefing): string[] {
  const themes = themeQueryBlob(briefing.themes);
  const regions = detectDiscoveryRegions(briefing.countries);
  const grantHint = briefing.kinds.includes('grant') || briefing.kinds.length === 0;
  const out: string[] = [];
  const seen = new Set<string>();

  const push = (q: string) => {
    const key = q.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(q);
  };

  for (const region of regions) {
    for (const q of PORTAL_BUILDERS[region](themes)) push(q);
  }

  if (grantHint) {
    push(`open grant convocatoria (${themes}) official site:.gov OR site:.gob OR site:europa.eu`);
  }

  return out.slice(0, 14);
}

export function institutionKey(name: string): string {
  return fold(name)
    .replace(/\((?:onu|un|ue|eu)\)/g, ' ')
    .replace(/\b(onu|united nations)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function sameInstitution(a: string, b: string): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  const shorter = a.length <= b.length ? a : b;
  const longer = a.length <= b.length ? b : a;
  return shorter.length >= 4 && longer.includes(shorter);
}

/** Demasiado da mesma agência (ex.: 3 IFAD rolling) = pesquisa pobre. */
export function isHomogeneousInstitutionSet(
  candidates: Array<{ institution?: string }>,
  threshold = 0.55,
): boolean {
  if (candidates.length < 3) return candidates.length < 6;
  const keys = candidates.map((c) => institutionKey(c.institution || '')).filter(Boolean);
  if (keys.length === 0) return true;
  const clusters: string[][] = [];
  for (const k of keys) {
    const hit = clusters.find((group) => group.some((g) => sameInstitution(g, k)));
    if (hit) hit.push(k);
    else clusters.push([k]);
  }
  const max = Math.max(...clusters.map((g) => g.length));
  return max / keys.length >= threshold || clusters.length < 3;
}
