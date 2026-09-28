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

export function detectDiscoveryRegions(
  countries: string[],
  themes: string[] = [],
): DiscoveryRegion[] {
  const blob = fold(countries.join(' '));
  const themeBlob = fold(themes.join(' '));
  const out = new Set<DiscoveryRegion>();
  const latamCountry =
    /america latina|latin america|latam|latinoameric|brasil|brazil|argentina|chile|colombia|mexico|peru|uruguay|paraguay|bolivia|ecuador|costa rica|panama|guatemala|honduras|salvador|nicaragua|dominic|venezuela|cuba|haiti/.test(
      blob,
    );
  if (/brasil|brazil/.test(blob)) out.add('br');
  if (/estados unidos|united states|\beua\b|\busa\b/.test(blob)) out.add('us');
  if (latamCountry) out.add('latam');
  if (/europa|europe|europeia|europea|\bue\b|\beu\b/.test(blob)) out.add('eu');
  const ruralTheme =
    /rural|agricul|aliment|food|clima|verde|circular|pecu|forest|campes|smallholder|bioeconom/.test(
      themeBlob,
    );
  if (ruralTheme && !out.has('eu') && !out.has('us')) out.add('latam');
  if (out.size === 0) out.add('global');
  out.add('global');
  return [...out];
}

const PORTAL_BUILDERS: Record<DiscoveryRegion, (themes: string) => string[]> = {
  br: (t) => [
    `site:finep.gov.br (chamada OR edital) (${t})`,
    `site:gov.br (chamada pública OR edital) (${t}) 2026`,
    `site:bndes.gov.br (chamada OR edital) (${t})`,
    `site:cnpq.br (chamada OR edital) (${t})`,
    `site:fapesp.br (chamada OR edital)`,
    `site:mapa.gov.br (chamada OR edital) (${t})`,
  ],
  us: (t) => [
    `site:grants.gov (${t}) (forecast OR posted) grant`,
    `site:usda.gov (NIFA OR RFA) (${t})`,
    `site:epa.gov (grant OR RFA) (${t}) open`,
  ],
  latam: (t) => [
    `site:iadb.org "call for proposals" (${t})`,
    `site:bidlab.org (call OR convocatoria) (${t})`,
    `site:caf.com (convocatoria OR "call for") (${t})`,
    `site:fontagro.org convocatoria`,
    `site:fonplata.org convocatoria`,
    `site:iaf.gov (grant OR rfp) (${t})`,
    `site:gob.mx (convocatoria OR "call for proposals") (${t})`,
    `site:anid.cl (concurso OR convocatoria)`,
    `site:corfo.cl convocatoria`,
    `site:argentina.gob.ar (convocatoria OR llamado) (${t})`,
    `site:minciencias.gov.co convocatoria`,
    `site:anii.org.uy convocatoria`,
    `site:aecid.es convocatoria (${t})`,
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
    `site:fao.org "call for proposals" (${t})`,
    `site:undp.org "call for proposals" (${t})`,
    `(${t}) official "call for proposals" open grant 2026`,
  ],
};

const FOUNDATION_QUERIES = (t: string) => [
  `site:fordfoundation.org (grant OR proposal) open (${t})`,
  `site:wkkf.org (grant OR rfp) (${t})`,
  `site:rockefellerfoundation.org (grant OR rfp)`,
  `site:avina.net convocatoria`,
  `site:opensocietyfoundations.org grants (${t})`,
];

export type DiscoveryQueryPack = {
  id: string;
  label: string;
  queries: string[];
};

function uniqueQueries(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const q of items) {
    const key = q.toLowerCase();
    if (!q.trim() || seen.has(key)) continue;
    seen.add(key);
    out.push(q);
  }
  return out;
}

/** Pacotes regionais — cada um vira uma pesquisa web própria. */
export function buildDiscoveryQueryPacks(briefing: OpportunityBriefing): DiscoveryQueryPack[] {
  const themes = themeQueryBlob(briefing.themes);
  const regions = detectDiscoveryRegions(briefing.countries, briefing.themes);
  const grantHint = briefing.kinds.includes('grant') || briefing.kinds.length === 0;
  const packs: DiscoveryQueryPack[] = [];

  const nationalQueries: string[] = [];
  if (briefing.searchFeedback?.trim()) {
    nationalQueries.push(briefing.searchFeedback.trim().slice(0, 280));
  }
  if (briefing.scanName?.trim()) {
    nationalQueries.push(`${briefing.scanName.trim()} official call for proposals`);
  }
  for (const region of ['br', 'us', 'eu'] as const) {
    if (!regions.includes(region)) continue;
    nationalQueries.push(...PORTAL_BUILDERS[region](themes).slice(0, 3));
  }
  if (nationalQueries.length) {
    packs.push({
      id: 'national',
      label: 'National and EU/US official portals',
      queries: uniqueQueries(nationalQueries).slice(0, 12),
    });
  }

  if (regions.includes('latam')) {
    packs.push({
      id: 'latam',
      label: 'Latin America regional and national official calls',
      queries: uniqueQueries(PORTAL_BUILDERS.latam(themes)).slice(0, 10),
    });
  }

  const globalQ = [
    ...PORTAL_BUILDERS.global(themes),
    ...(grantHint ? FOUNDATION_QUERIES(themes) : []),
    grantHint
      ? `open grant convocatoria (${themes}) official site:.gov OR site:.gob OR site:europa.eu`
      : '',
  ].filter(Boolean);
  packs.push({
    id: 'global',
    label: 'Multilateral climate funds and international foundations',
    queries: uniqueQueries(globalQ).slice(0, 10),
  });

  if (briefingRequestsIfad(briefing)) {
    packs.push({
      id: 'ifad',
      label: 'IFAD official calls (requested)',
      queries: uniqueQueries([
        `site:ifad.org "call for proposals" (${themes})`,
        `site:ifad.org/en/w/calls-for-proposal (${themes})`,
        `site:ifad.org/es/w/calls-for-proposal (${themes})`,
      ]),
    });
  }

  return packs.filter((p) => p.queries.length > 0);
}

/** Queries oficiais que o scout DEVE correr — portais, não agregadores. */
export function buildDiscoverySearchQueries(briefing: OpportunityBriefing): string[] {
  return uniqueQueries(buildDiscoveryQueryPacks(briefing).flatMap((p) => p.queries)).slice(0, 36);
}

export function isIfadSourceUrl(url: string | null | undefined): boolean {
  return /ifad\.org/i.test(url ?? '');
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
  max = 2,
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
  const maxPer = briefingRequestsIfad(briefing) ? 4 : 2;
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
