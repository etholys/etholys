import { daysUntilClose } from '@/lib/opportunity/scan-inbox';
import type {
  CandidateFit,
  FitItem,
  FitItemStatus,
  FitVerdict,
  OpportunityBriefing,
  OpportunityKind,
  ScanCandidate,
} from '@/lib/opportunity/scan-types';

const REGION_TOKENS = [
  'latam',
  'latin america',
  'america latina',
  'latinoamerica',
  'mercosur',
  'mercosul',
  'iberoamerica',
  'south america',
  'america do sul',
  'caribbean',
  'caribe',
];

const GLOBAL_TOKENS = [
  'worldwide',
  'global',
  'internacional',
  'international',
  'all countries',
  'qualquer pais',
  'cualquier pais',
  'todas las regiones',
];

const COUNTRY_ALIASES: Record<string, string[]> = {
  uy: ['uruguay', 'uruguai', 'uruguaya', 'oriental del uruguay'],
  br: ['brasil', 'brazil', 'brasileira'],
  ar: ['argentina', 'argentino'],
  cl: ['chile', 'chilena'],
  py: ['paraguay', 'paraguai'],
  bo: ['bolivia', 'boliviana'],
  pe: ['peru', 'peruana'],
  co: ['colombia', 'colombiana'],
  mx: ['mexico', 'mexicana'],
  us: ['usa', 'united states', 'eeuu', 'estados unidos'],
  es: ['espanha', 'espana', 'spain'],
  pt: ['portugal', 'portuguesa'],
};

const PUBLIC_ONLY =
  /solo (entidades |organismos )?public|exclusivamente public|somente (entidades )?public|only (public|government)|ministerios?|organismos publicos|nao (admite|elegiveis?) empres|no (admite|elegibles?) empres|not[- ]for[- ]profit only|solo ong|somente ong/i;

const PRIVATE_OK =
  /empresas? privadas?|private compan|for[- ]profit|sociedades? comerciais|pymes?|sme\b|sector privado/i;

const PRIVATE_ONLY =
  /solo empresas|somente empresas|only (private )?compan|exclusivamente (empresas|privad)/i;

const NGO_OK =
  /ong\b|ngo\b|nonprofit|nao governamental|organizacoes? da sociedade|sociedad civil|fundac/i;

function fold(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function haystack(c: ScanCandidate): string {
  return fold(
    [c.whoCanApply, c.eligibility, c.requirements, c.description, c.type, c.category].filter(Boolean).join(' · '),
  );
}

function countryBlob(c: ScanCandidate): string {
  return fold([c.eligibleCountries, c.countries].filter(Boolean).join(' '));
}

function countryKeys(raw: string): string[] {
  const f = fold(raw);
  if (!f) return [];
  const keys = new Set<string>([f]);
  for (const [iso, aliases] of Object.entries(COUNTRY_ALIASES)) {
    if (f === iso || aliases.some((a) => f === a || f.includes(a))) keys.add(iso);
  }
  return [...keys];
}

function countriesOverlap(profile: string[], candidateText: string): 'go' | 'caution' | 'no_go' | 'unknown' {
  if (!profile.length) return 'unknown';
  const blob = fold(candidateText);
  if (!blob) return 'unknown';
  if (GLOBAL_TOKENS.some((t) => blob.includes(t))) return 'go';
  if (REGION_TOKENS.some((t) => blob.includes(t))) {
    const wanted = profile.flatMap(countryKeys);
    const latam = wanted.some((k) => ['uy', 'br', 'ar', 'cl', 'py', 'bo', 'pe', 'co', 'mx'].includes(k));
    return latam ? 'go' : 'caution';
  }
  const wanted = profile.flatMap(countryKeys);
  if (wanted.some((k) => blob.includes(k))) return 'go';
  return 'no_go';
}

export type OrgBucket = 'private' | 'ngo' | 'public' | 'university' | 'coop' | 'unknown';

export function orgBucket(raw: string | undefined): OrgBucket {
  const t = fold(raw ?? '');
  if (!t) return 'unknown';
  if (/universidad|university|academia|faculdade/.test(t)) return 'university';
  if (/cooperativ/.test(t)) return 'coop';
  if (/gobierno|government|minister|municip|publica|publico/.test(t)) return 'public';
  if (/ong|ngo|nonprofit|associac|fundac|sociedade civil/.test(t)) return 'ngo';
  if (/empresa|company|private|srl|ltda|sa\b|llc|for profit/.test(t)) return 'private';
  return 'unknown';
}

function mapKind(type: string | undefined): OpportunityKind | undefined {
  const t = fold(type ?? '');
  if (!t) return undefined;
  if (/credit|credito|prestamo|loan|reembols/.test(t)) return 'credit';
  if (/alianc|alliance|partnership|convenio|coaliz/.test(t)) return 'alliance';
  if (/expert|consultor/.test(t)) return 'local_expert';
  if (/grant|subvenc|donacion|fundo|fondo|edital|convocator/.test(t)) return 'grant';
  return 'grant';
}

function worst(items: FitItem[]): FitVerdict {
  if (items.some((i) => i.status === 'no_go')) return 'no_go';
  if (items.some((i) => i.status === 'caution' || i.status === 'unknown')) return 'caution';
  return 'go';
}

export function parseCandidateFit(raw: unknown): CandidateFit | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const o = raw as Record<string, unknown>;
  if (o.verdict !== 'go' && o.verdict !== 'caution' && o.verdict !== 'no_go') return undefined;
  if (!Array.isArray(o.items)) return undefined;
  const items: FitItem[] = o.items
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
    .map((item) => ({
      id: String(item.id ?? ''),
      label: String(item.label ?? ''),
      status: (['go', 'caution', 'no_go', 'unknown'].includes(String(item.status))
        ? item.status
        : 'unknown') as FitItemStatus,
      note: typeof item.note === 'string' ? item.note : undefined,
    }))
    .filter((item) => item.id && item.label);
  if (!items.length) return undefined;
  return {
    verdict: o.verdict,
    items,
    evaluatedAt: typeof o.evaluatedAt === 'string' ? o.evaluatedAt : new Date().toISOString(),
  };
}

export function evaluateFit(
  candidate: ScanCandidate,
  briefing: OpportunityBriefing,
  opts?: { now?: number; locale?: string },
): CandidateFit {
  const locale = opts?.locale ?? 'pt';
  const pt = locale === 'pt';
  const es = locale === 'es';
  const t = (a: string, b: string, c: string) => (pt ? a : es ? b : c);
  const text = haystack(candidate);
  const items: FitItem[] = [];

  const countryStatus = countriesOverlap(briefing.countries, countryBlob(candidate));
  items.push({
    id: 'country',
    label: t('País', 'País', 'Country'),
    status: countryStatus,
    note:
      countryStatus === 'go'
        ? t('O país do perfil está na convocatória.', 'El país del perfil está en la convocatoria.', 'Profile country is in the call.')
        : countryStatus === 'no_go'
          ? t('O país do perfil não aparece como elegível.', 'El país del perfil no aparece como elegible.', 'Profile country is not listed as eligible.')
          : t('País do perfil ou da convocatória em falta.', 'Falta el país del perfil o de la convocatoria.', 'Country on the profile or call is missing.'),
  });

  const ours = orgBucket(briefing.entityType || briefing.notes);
  let orgStatus: FitItemStatus = 'unknown';
  let orgNote = t('Tipo de organização ainda não está no perfil.', 'El tipo de organización aún no está en el perfil.', 'Organization type is not on the profile yet.');
  if (ours !== 'unknown') {
    if (ours === 'private' && PUBLIC_ONLY.test(text) && !PRIVATE_OK.test(text)) {
      orgStatus = 'no_go';
      orgNote = t('A convocatória parece só para entidades públicas.', 'La convocatoria parece solo para entidades públicas.', 'The call looks public-sector only.');
    } else if (ours === 'public' && PRIVATE_ONLY.test(text) && !NGO_OK.test(text)) {
      orgStatus = 'no_go';
      orgNote = t('A convocatória parece só para empresas privadas.', 'La convocatoria parece solo para empresas privadas.', 'The call looks private-company only.');
    } else if (ours === 'ngo' && PRIVATE_ONLY.test(text) && !NGO_OK.test(text)) {
      orgStatus = 'caution';
      orgNote = t('Texto aponta a empresas — confirmar se ONG entra.', 'El texto apunta a empresas — confirmar si entra una ONG.', 'Text points to companies — confirm if an NGO fits.');
    } else {
      orgStatus = 'go';
      orgNote = t('Nada no texto exclui o tipo da organização.', 'Nada en el texto excluye el tipo de organización.', 'Nothing in the text excludes this organization type.');
    }
  }
  items.push({
    id: 'org_type',
    label: t('Tipo de organização', 'Tipo de organización', 'Organization type'),
    status: orgStatus,
    note: orgNote,
  });

  let privateStatus: FitItemStatus = 'unknown';
  let privateNote = t('Preferência de privado não está no briefing.', 'La preferencia de privado no está en el briefing.', 'Private-company preference is not in the briefing.');
  if (briefing.privateEligible === true) {
    if (PUBLIC_ONLY.test(text) && !PRIVATE_OK.test(text)) {
      privateStatus = 'no_go';
      privateNote = t('Procura-se privado, mas o edital parece só público.', 'Se busca privado, pero el edicto parece solo público.', 'You want private-eligible calls, but this one looks public-only.');
    } else if (PRIVATE_OK.test(text) || PRIVATE_ONLY.test(text)) {
      privateStatus = 'go';
      privateNote = t('Empresas privadas aparecem como elegíveis.', 'Las empresas privadas aparecen como elegibles.', 'Private companies appear eligible.');
    } else {
      privateStatus = 'caution';
      privateNote = t('Não está explícito se o privado pode candidatar.', 'No está explícito si el privado puede postular.', 'It is not explicit whether private applicants can apply.');
    }
  } else if (briefing.privateEligible === false) {
    privateStatus = PRIVATE_ONLY.test(text) ? 'caution' : 'go';
    privateNote =
      privateStatus === 'caution'
        ? t('Edital parece só para empresas privadas.', 'El edicto parece solo para empresas privadas.', 'The call looks private-company only.')
        : t('Não exige empresa privada.', 'No exige empresa privada.', 'Does not require a private company.');
  }
  items.push({
    id: 'private',
    label: t('Privado elegível', 'Privado elegible', 'Private eligible'),
    status: privateStatus,
    note: privateNote,
  });

  let ceiling: FitItemStatus = 'unknown';
  let ceilingNote = t('Sem teto no perfil ou sem montante na convocatória.', 'Sin techo en el perfil o sin monto en la convocatoria.', 'No ceiling on the profile or no amount on the call.');
  if (briefing.amountMax != null && candidate.amount != null) {
    if (candidate.amount > briefing.amountMax * 1.2) {
      ceiling = 'no_go';
      ceilingNote = t('O ticket está claramente acima do teto do perfil.', 'El ticket está claramente por encima del techo del perfil.', 'The ticket is clearly above the profile ceiling.');
    } else if (candidate.amount > briefing.amountMax) {
      ceiling = 'caution';
      ceilingNote = t('O montante ultrapassa um pouco o teto — confirmar janelas menores.', 'El monto supera un poco el techo.', 'The amount is slightly above the ceiling.');
    } else {
      ceiling = 'go';
      ceilingNote = t('Montante dentro do teto do perfil.', 'Monto dentro del techo del perfil.', 'Amount is within the profile ceiling.');
    }
  } else if (briefing.amountMin != null && candidate.amount != null && candidate.amount < briefing.amountMin) {
    ceiling = 'caution';
    ceilingNote = t('Montante abaixo do mínimo preferido.', 'Monto por debajo del mínimo preferido.', 'Amount is below the preferred minimum.');
  }
  items.push({
    id: 'ceiling',
    label: t('Teto', 'Techo', 'Ceiling'),
    status: ceiling,
    note: ceilingNote,
  });

  const kind = mapKind(candidate.type);
  const wantedKinds = briefing.kinds?.length ? briefing.kinds : undefined;
  let kindStatus: FitItemStatus = 'unknown';
  let kindNote = t('Tipo da oportunidade pouco claro.', 'Tipo de la oportunidad poco claro.', 'Opportunity type is unclear.');
  if (kind && wantedKinds) {
    kindStatus = wantedKinds.includes(kind) ? 'go' : 'no_go';
    kindNote =
      kindStatus === 'go'
        ? t('O tipo bate com o briefing (grant / crédito / aliança).', 'El tipo coincide con el briefing.', 'Type matches the briefing (grant / credit / alliance).')
        : t('O tipo não está no que pediu no briefing.', 'El tipo no está en lo pedido en el briefing.', 'Type is not what the briefing asked for.');
  }
  if (briefing.reimbursable === false && kind === 'credit') {
    kindStatus = kindStatus === 'go' ? 'caution' : kindStatus;
    kindNote = t('Preferiu não reembolsável, mas isto parece crédito.', 'Prefirió no reembolsable, pero esto parece crédito.', 'You preferred non-reimbursable, but this looks like credit.');
  }
  items.push({
    id: 'kind',
    label: t('Grant vs crédito', 'Grant vs crédito', 'Grant vs credit'),
    status: kindStatus,
    note: kindNote,
  });

  const days = daysUntilClose(candidate, opts?.now);
  let deadline: FitItemStatus = 'unknown';
  let deadlineNote = t('Prazo da convocatória não está datado.', 'El plazo de la convocatoria no está fechado.', 'The call deadline is not dated.');
  if (candidate.availabilityStatus === 'closed' || (days != null && days < 0)) {
    deadline = 'no_go';
    deadlineNote = t('A janela já fechou.', 'La ventana ya cerró.', 'The window is already closed.');
  } else if (days != null && days <= 7) {
    deadline = 'caution';
    deadlineNote = t('Prazo ainda aberto, mas fecha em poucos dias.', 'Plazo aún abierto, pero cierra en pocos días.', 'Still open, but it closes in a few days.');
  } else if (days != null || candidate.availabilityStatus === 'open_now' || candidate.availabilityStatus === 'rolling') {
    deadline = 'go';
    deadlineNote = t('Prazo ainda aberto.', 'Plazo aún abierto.', 'Deadline is still open.');
  }
  items.push({
    id: 'deadline',
    label: t('Prazo aberto', 'Plazo abierto', 'Deadline open'),
    status: deadline,
    note: deadlineNote,
  });

  return {
    verdict: worst(items),
    items,
    evaluatedAt: new Date(opts?.now ?? Date.now()).toISOString(),
  };
}
