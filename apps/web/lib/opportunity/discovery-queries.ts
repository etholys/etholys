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

  const command = briefing.searchFeedback?.trim();
  if (command) push(command.slice(0, 280));
  if (briefing.scanName?.trim()) {
    push(`${briefing.scanName.trim()} official call for proposals`);
  }
  push(`(${themes}) official "call for proposals" open grant`);

  if (briefingRequestsIfad(briefing)) {
    push(`site:ifad.org "call for proposals" (${themes})`);
    push(`site:ifad.org/en/w/calls-for-proposal (${themes})`);
    push(`site:ifad.org/es/w/calls-for-proposal (${themes})`);
  }

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

export function isIfadCandidate(c: {
  name?: string;
  institution?: string;
  callUrl?: string;
  linkOficial?: string;
  sourceUrl?: string;
}): boolean {
  const hay = fold(
    [c.name, c.institution, c.callUrl, c.linkOficial, c.sourceUrl].filter(Boolean).join(' '),
  );
  return /\bifad\b|\bfida\b|ifad\.org/.test(hay);
}

/**
 * Listas de portais (seed Horizonte, etc.) que citam ifad.org NÃO pedem IFAD.
 * Só conta se o briefing/comando for sobre IFAD em si.
 */
export function briefingRequestsIfad(briefing: OpportunityBriefing): boolean {
  const primary = fold(
    [...(briefing.themes ?? []), briefing.notes, briefing.scanName].filter(Boolean).join(' '),
  );
  if (/\bifad\b|\bfida\b/.test(primary)) return true;
  const command = fold(briefing.searchFeedback || '');
  if (!command) return false;
  const hits = command.match(/\bifad\b|\bfida\b|ifad\.org/g)?.length ?? 0;
  if (hits === 0) return false;
  const laundryList = /europa\.eu|grants\.gov|finep|iadb|horizon|usda|gub\.uy|fontagro|caf\.com/.test(
    command,
  );
  return !laundryList;
}

export function dropUnrequestedIfad<
  T extends {
    name?: string;
    institution?: string;
    callUrl?: string;
    linkOficial?: string;
    sourceUrl?: string;
  },
>(candidates: T[], briefing: OpportunityBriefing): T[] {
  if (briefingRequestsIfad(briefing)) return candidates;
  return candidates.filter((c) => !isIfadCandidate(c));
}

export function capPerInstitution<T extends { institution?: string; matchScore?: number }>(
  candidates: T[],
  max = 1,
): T[] {
  const ranked = [...candidates].sort((a, b) => (b.matchScore ?? 0) - (a.matchScore ?? 0));
  const used: string[] = [];
  const out: T[] = [];
  for (const c of ranked) {
    const key = institutionKey(c.institution || '');
    const cluster = used.find((u) => sameInstitution(u, key));
    const count = cluster
      ? out.filter((x) => sameInstitution(institutionKey(x.institution || ''), key)).length
      : 0;
    if (count >= max) continue;
    out.push(c);
    if (!cluster && key) used.push(key);
  }
  return out;
}

export function applyBriefingDiversity<
  T extends {
    name?: string;
    institution?: string;
    callUrl?: string;
    linkOficial?: string;
    sourceUrl?: string;
    matchScore?: number;
  },
>(candidates: T[], briefing: OpportunityBriefing): T[] {
  const maxPer = briefingRequestsIfad(briefing) ? 4 : 1;
  return capPerInstitution(dropUnrequestedIfad(candidates, briefing), maxPer);
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
