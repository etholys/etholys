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
  /ong\b|ngo\b|nonprofit|nao governamental|organizacoes? da sociedade|sociedad civil|fundac|osc\b|cso\b/i;

const OSC_OR_NGO_ONLY =
  /solo (osc|ong|ong'?s|csos?)|somente (osc|ong)|only (ngos?|non[- ]profits?|csos?)|exclusivamente (ong|osc|sociedad civil)/i;

const REQUIRES_LOCAL_REGISTRATION =
  /registro (juridico|legal) (en|no|no pais|en el pais)|registered (in|within) (the )?country|establecida? (en|no)|sede (en|no)|constitui[dt]a (en|no)|personeria juridica (en|local)/i;

const REQUIRES_AUDIT =
  /auditoria (externa|independente|de los ultimos)|audited financial|estados financieros auditados|ultimos (3|5) anos audit/i;

const REQUIRES_MIN_YEARS =
  /minimo de (\d+)\s*anos|al menos (\d+)\s*anos|at least (\d+)\s*years|minimum (\d+)\s*years/i;

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
  opts?: {
    now?: number;
    locale?: string;
    partners?: Array<{ id?: string; name: string; country?: string | null; role?: string | null }>;
  },
): CandidateFit {
  const locale = opts?.locale ?? 'es';
  const pt = locale === 'pt';
  const es = locale === 'es';
  const t = (a: string, b: string, c: string) => (pt ? a : es ? b : c);
  const text = haystack(candidate);
  const items: FitItem[] = [];
  const callCountries = countryBlob(candidate);

  const countryStatus = countriesOverlap(briefing.countries, callCountries);
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

  const mappedKind =
    briefing.orgKind === 'osc' || briefing.orgKind === 'ngo' || briefing.orgKind === 'foundation'
      ? 'ngo'
      : briefing.orgKind === 'private'
        ? 'private'
        : briefing.orgKind === 'public'
          ? 'public'
          : briefing.orgKind === 'coop'
            ? 'coop'
            : orgBucket(briefing.entityType || briefing.notes);
  const ours = mappedKind === 'coop' ? 'ngo' : mappedKind;

  let orgStatus: FitItemStatus = 'unknown';
  let orgNote = t('Tipo de organização ainda não está no perfil.', 'El tipo de organización aún no está en el perfil.', 'Organization type is not on the profile yet.');
  if (ours !== 'unknown') {
    if (OSC_OR_NGO_ONLY.test(text) && ours === 'private') {
      orgStatus = 'no_go';
      orgNote = t('Edital parece só para OSC/ONG — a org é privada.', 'El edicto parece solo para OSC/ONG — la org es privada.', 'Call looks OSC/NGO-only — org is private.');
    } else if (ours === 'private' && PUBLIC_ONLY.test(text) && !PRIVATE_OK.test(text)) {
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
  items.push({ id: 'org_type', label: t('Tipo de organização', 'Tipo de organización', 'Organization type'), status: orgStatus, note: orgNote });

  let legalStatus: FitItemStatus = 'unknown';
  let legalNote = t('Registo jurídico por país ainda não está no perfil.', 'Registro jurídico por país aún no está en el perfil.', 'Legal registration by country is not on the profile yet.');
  if (REQUIRES_LOCAL_REGISTRATION.test(text) || countryStatus === 'go') {
    const legal = briefing.legalCountries ?? [];
    if (!legal.length) {
      legalStatus = REQUIRES_LOCAL_REGISTRATION.test(text) ? 'caution' : 'unknown';
      legalNote = t('Complete os países de registo jurídico no perfil.', 'Complete los países de registro jurídico en el perfil.', 'Complete legal-registration countries on the profile.');
    } else if (callCountries && countriesOverlap(legal, callCountries) === 'no_go') {
      legalStatus = 'caution';
      legalNote = t('Pode faltar registo jurídico no país da convocatória — considere um sócio local.', 'Puede faltar registro jurídico en el país de la convocatoria — considere un socio local.', 'You may lack legal registration in the call country — consider a local partner.');
    } else if (countriesOverlap(legal, callCountries) === 'go') {
      legalStatus = 'go';
      legalNote = t('Há registo jurídico alinhado com a geografia da call.', 'Hay registro jurídico alineado con la geografía de la call.', 'Legal registration aligns with the call geography.');
    }
  }
  items.push({ id: 'legal_registration', label: t('Registo jurídico', 'Registro jurídico', 'Legal registration'), status: legalStatus, note: legalNote });

  let auditStatus: FitItemStatus = 'unknown';
  let auditNote = t('Auditoria ainda não está no perfil.', 'Auditoría aún no está en el perfil.', 'Audit status is not on the profile yet.');
  if (REQUIRES_AUDIT.test(text)) {
    if (briefing.hasAuditLast5Years === true) {
      auditStatus = 'go';
      auditNote = t('Perfil indica auditoria nos últimos 5 anos.', 'El perfil indica auditoría en los últimos 5 años.', 'Profile indicates an audit in the last 5 years.');
    } else if (briefing.hasAuditLast5Years === false) {
      auditStatus = 'no_go';
      auditNote = t('A call pede auditoria e o perfil diz que não há.', 'La call pide auditoría y el perfil dice que no hay.', 'The call asks for an audit and the profile says there is none.');
    } else {
      auditStatus = 'caution';
      auditNote = t('A call menciona auditoria — complete o perfil.', 'La call menciona auditoría — complete el perfil.', 'The call mentions an audit — complete the profile.');
    }
  } else if (briefing.hasAuditLast5Years === true) {
    auditStatus = 'go';
    auditNote = t('Auditoria registada no perfil.', 'Auditoría registrada en el perfil.', 'Audit recorded on the profile.');
  }
  items.push({ id: 'audit', label: t('Auditoria', 'Auditoría', 'Audit'), status: auditStatus, note: auditNote });

  let maturityStatus: FitItemStatus = 'unknown';
  let maturityNote = t('Anos de operação / maturidade ainda não estão no perfil.', 'Años de operación / madurez aún no están en el perfil.', 'Years operating / maturity are not on the profile yet.');
  const yearsMatch = text.match(REQUIRES_MIN_YEARS);
  const requiredYears = yearsMatch ? Number(yearsMatch[1] || yearsMatch[2] || yearsMatch[3] || yearsMatch[4]) : null;
  if (requiredYears != null && Number.isFinite(requiredYears)) {
    if (briefing.yearsOperating == null) {
      maturityStatus = 'caution';
      maturityNote = t(`A call pede ~${requiredYears} anos — complete o perfil.`, `La call pide ~${requiredYears} años — complete el perfil.`, `The call asks for ~${requiredYears} years — complete the profile.`);
    } else if (briefing.yearsOperating < requiredYears) {
      maturityStatus = 'no_go';
      maturityNote = t(`Perfil tem ${briefing.yearsOperating} anos; a call pede ~${requiredYears}.`, `El perfil tiene ${briefing.yearsOperating} años; la call pide ~${requiredYears}.`, `Profile has ${briefing.yearsOperating} years; the call asks for ~${requiredYears}.`);
    } else {
      maturityStatus = 'go';
      maturityNote = t('Anos de operação suficientes vs. texto da call.', 'Años de operación suficientes vs. texto de la call.', 'Years operating look sufficient vs. the call text.');
    }
  } else if (briefing.yearsOperating != null || briefing.maturityLevel) {
    maturityStatus = 'go';
    maturityNote = t(`Maturidade: ${briefing.maturityLevel ?? '—'}; anos: ${briefing.yearsOperating ?? '—'}`, `Madurez: ${briefing.maturityLevel ?? '—'}; años: ${briefing.yearsOperating ?? '—'}`, `Maturity: ${briefing.maturityLevel ?? '—'}; years: ${briefing.yearsOperating ?? '—'}`);
  }
  items.push({ id: 'maturity', label: t('Maturidade', 'Madurez', 'Maturity'), status: maturityStatus, note: maturityNote });

  let revenueStatus: FitItemStatus = 'unknown';
  let revenueNote = t('Faturamento por ano ainda não está no perfil.', 'Facturación por año aún no está en el perfil.', 'Yearly revenue is not on the profile yet.');
  if (briefing.revenueByYear?.length) {
    revenueStatus = 'go';
    revenueNote = t(`${briefing.revenueByYear.length} ano(s) de faturamento no perfil.`, `${briefing.revenueByYear.length} año(s) de facturación en el perfil.`, `${briefing.revenueByYear.length} year(s) of revenue on the profile.`);
  } else if (/facturacion|revenue|ingresos|faturamento|turnover/i.test(text)) {
    revenueStatus = 'caution';
    revenueNote = t('A call fala de receita/faturamento — complete o perfil.', 'La call habla de ingresos/facturación — complete el perfil.', 'The call mentions revenue — complete the profile.');
  }
  items.push({ id: 'revenue', label: t('Faturamento', 'Facturación', 'Revenue'), status: revenueStatus, note: revenueNote });

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
    privateNote = privateStatus === 'caution'
      ? t('Edital parece só para empresas privadas.', 'El edicto parece solo para empresas privadas.', 'The call looks private-company only.')
      : t('Não exige empresa privada.', 'No exige empresa privada.', 'Does not require a private company.');
  }
  items.push({ id: 'private', label: t('Privado elegível', 'Privado elegible', 'Private eligible'), status: privateStatus, note: privateNote });

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
  items.push({ id: 'ceiling', label: t('Teto', 'Techo', 'Ceiling'), status: ceiling, note: ceilingNote });

  const kind = mapKind(candidate.type);
  const wantedKinds = briefing.kinds?.length ? briefing.kinds : undefined;
  let kindStatus: FitItemStatus = 'unknown';
  let kindNote = t('Tipo da oportunidade pouco claro.', 'Tipo de la oportunidad poco claro.', 'Opportunity type is unclear.');
  if (kind && wantedKinds) {
    kindStatus = wantedKinds.includes(kind) ? 'go' : 'no_go';
    kindNote = kindStatus === 'go'
      ? t('O tipo bate com o briefing (grant / crédito / aliança).', 'El tipo coincide con el briefing.', 'Type matches the briefing (grant / credit / alliance).')
      : t('O tipo não está no que pediu no briefing.', 'El tipo no está en lo pedido en el briefing.', 'Type is not what the briefing asked for.');
  }
  if (briefing.reimbursable === false && kind === 'credit') {
    kindStatus = kindStatus === 'go' ? 'caution' : kindStatus;
    kindNote = t('Preferiu não reembolsável, mas isto parece crédito.', 'Prefirió no reembolsable, pero esto parece crédito.', 'You preferred non-reimbursable, but this looks like credit.');
  }
  items.push({ id: 'kind', label: t('Grant vs crédito', 'Grant vs crédito', 'Grant vs credit'), status: kindStatus, note: kindNote });

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
  items.push({ id: 'deadline', label: t('Prazo aberto', 'Plazo abierto', 'Deadline open'), status: deadline, note: deadlineNote });

  const needsPartner = legalStatus === 'caution' || legalStatus === 'no_go' || orgStatus === 'no_go' || countryStatus === 'no_go';
  const suggestedPartners =
    needsPartner && opts?.partners?.length
      ? opts.partners
          .filter((p) => {
            if (!p.country?.trim() || !callCountries) return true;
            return countriesOverlap([p.country], callCountries) !== 'no_go';
          })
          .slice(0, 4)
          .map((p) => ({
            id: p.id,
            name: p.name,
            country: p.country,
            role: p.role,
            reason: t(
              'Pode reforçar elegibilidade local / tipo de org nesta call.',
              'Puede reforzar elegibilidad local / tipo de org en esta call.',
              'May strengthen local eligibility / org type on this call.',
            ),
          }))
      : undefined;

  return {
    verdict: worst(items),
    items,
    evaluatedAt: new Date(opts?.now ?? Date.now()).toISOString(),
    suggestedPartners: suggestedPartners?.length ? suggestedPartners : undefined,
  };
}
