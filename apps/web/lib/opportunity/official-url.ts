import 'server-only';

/**
 * Domínios de agregadores / concorrentes — NUNCA usar como linkOficial.
 * A oportunidade pode ser descoberta via pesquisa, mas o link mostrado ao utilizador
 * tem de ser do financiador ou portal oficial da convocatória.
 */
const AGGREGATOR_HOST_PATTERNS = [
  'grantbite',
  'proposalsforngos',
  'fundsforngos',
  'grantwatch.com',
  'instrumentl.com',
  'grantstation.com',
  'opengrants.io',
  'grantforward.com',
  'pivot.proquest.com',
  'candidogov.com',
  'grantscout',
  'fundingsolutions',
  'grantfinder',
  'opportunitydesk.org',
  'devnetjobs.org',
  'reliefweb.int/jobs', // jobs, not calls
  'devex.com/jobs',
  'idealist.org',
  'globalgiving.org',
  'submittable.com/opportunities', // marketplace genérico
  'wikipedia.org',
  'linkedin.com',
  'facebook.com',
  'twitter.com',
  'x.com',
  'medium.com',
  'youtube.com',
];

/** Sufixos típicos de domínios institucionais oficiais (heurística positiva). */
const OFFICIAL_TLD_OR_HOST_HINTS = [
  '.gov',
  '.gob.',
  '.gov.',
  'europa.eu',
  'worldbank.org',
  'adb.org',
  'afdb.org',
  'iadb.org',
  'undp.org',
  'unicef.org',
  'who.int',
  'fao.org',
  'ifad.org',
  'usaid.gov',
  'dfid.gov.uk',
  'gov.uk',
  'giz.de',
  'afd.fr',
  'kfw.de',
  'bmz.de',
  'swisscontact.org',
  'cordis.europa.eu',
  'funding-tenders.europa.eu',
  'ec.europa.eu',
  'horizon-europe.ec.europa.eu',
];

export function extractHostname(url: string): string | null {
  try {
    const u = new URL(url.trim());
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    return u.hostname.toLowerCase();
  } catch {
    return null;
  }
}

export function isAggregatorFundingUrl(url: string | null | undefined): boolean {
  if (!url?.trim()) return false;
  const lower = url.trim().toLowerCase();
  const host = extractHostname(lower);
  if (!host) return true;

  for (const pattern of AGGREGATOR_HOST_PATTERNS) {
    if (host.includes(pattern) || lower.includes(pattern)) return true;
  }
  if (host.includes('proposalsforngos')) return true;

  return false;
}

export function isLikelyOfficialFundingUrl(url: string | null | undefined): boolean {
  if (!url?.trim()) return false;
  if (isAggregatorFundingUrl(url)) return false;

  const host = extractHostname(url);
  if (!host) return false;

  // Explicit official hints
  if (OFFICIAL_TLD_OR_HOST_HINTS.some((h) => host.includes(h.replace(/^\./, '')) || url.includes(h))) {
    return true;
  }
  if (host.endsWith('.gov') || host.includes('.gov.') || host.endsWith('.int')) return true;
  if (host.endsWith('.edu') || host.endsWith('.ac.uk')) return true;

  // National EU research portals
  if (/\.(de|fr|es|pt|it|nl|be|at|pl|se|dk|fi|ie|cz|ro|hu|gr|sk|bg|hr|si|lt|lv|ee|cy|mt|lu)$/.test(host)) {
    // Country TLD alone is weak signal — require gov/research path hints
    if (/gov|minister|research|science|funding|förderung|subvenc|financ/.test(host + url.toLowerCase())) {
      return true;
    }
  }

  // Foundation / multilateral on .org with funding path
  if (host.endsWith('.org') && /grant|fund|financ|call|proposal|apply|funding|donor/.test(url.toLowerCase())) {
    return true;
  }

  // Default: not aggregator but unverified — treat as official enough if NOT aggregator
  // (strict mode below handles open_now)
  return true;
}

export type SanitizedLinks = {
  linkOficial?: string;
  sourceUrl?: string;
  /** Domínio rejeitado (agregador). */
  rejectedUrl?: string;
  linkVerified: boolean;
};

export function sanitizeFundingLinks(
  linkOficial?: string | null,
  sourceUrl?: string | null,
): SanitizedLinks {
  const rawOfficial = linkOficial?.trim() || undefined;
  const rawSource = sourceUrl?.trim() || undefined;

  let rejectedUrl: string | undefined;

  const pickOfficial = (url?: string): string | undefined => {
    if (!url) return undefined;
    if (isAggregatorFundingUrl(url)) {
      rejectedUrl = rejectedUrl ?? url;
      return undefined;
    }
    return url.slice(0, 500);
  };

  let official = pickOfficial(rawOfficial);
  const source = pickOfficial(rawSource);

  // Se linkOficial era agregador mas sourceUrl é oficial, promover source
  if (!official && source && isLikelyOfficialFundingUrl(source)) {
    official = source;
  }

  const linkVerified = Boolean(official && isLikelyOfficialFundingUrl(official));

  return {
    linkOficial: official,
    sourceUrl: source && source !== official ? source : undefined,
    rejectedUrl,
    linkVerified,
  };
}

/** Candidatos «abertos agora» exigem link oficial verificável — sem agregadores. */
export function candidateHasAcceptableOfficialLink(
  linkOficial?: string | null,
  sourceUrl?: string | null,
  strict = false,
): boolean {
  const { linkOficial: official, linkVerified } = sanitizeFundingLinks(linkOficial, sourceUrl);
  if (!official) return false;
  if (strict) return linkVerified;
  return !isAggregatorFundingUrl(official);
}

export const OFFICIAL_LINK_PROMPT_RULES = `
LINK RULES (MANDATORY — violations invalidate the candidate):
- linkOficial MUST be the funder's website or the official call portal (e.g. ec.europa.eu, funding-tenders.europa.eu, worldbank.org, usaid.gov).
- NEVER use third-party grant aggregators, directories, or competitors as linkOficial or sourceUrl.
- FORBIDDEN domains include: grantbite.com, fundsforngos, grantwatch, instrumentl, grantstation, opengrants, proposalsforngos, and similar listing sites.
- If you only find the opportunity on an aggregator, search again for the SAME call on the funder's official site. If no official URL exists, OMIT that candidate entirely.
- sourceUrl must also be official (same rules). Do not cite aggregator pages as sources.
`.trim();
