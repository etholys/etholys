import type { OpportunityBriefing, OrgKindForFunding, RevenueYear } from '@/lib/opportunity/scan-types';

const ORG_KIND_LABEL: Record<OrgKindForFunding, string> = {
  ngo: 'ONG / organização sem fins lucrativos',
  osc: 'organização da sociedade civil',
  private: 'empresa privada',
  public: 'entidade pública',
  coop: 'cooperativa',
  foundation: 'fundação',
  other: 'outro tipo de organização',
};

const ENTITY_KIND_LABEL: Record<string, string> = {
  company: 'empresa',
  cooperative: 'cooperativa ou associação',
  ngo: 'ONG / terceiro sector',
  association: 'associação',
  public: 'entidade pública ou mista',
  other: 'outro',
};

export type ApplicantProfileSource = {
  name: string;
  shortName?: string | null;
  description?: string | null;
  sector?: string | null;
  country?: string | null;
  entityType?: string | null;
  entityKind?: string | null;
  sectorLabels?: string[];
  notesForAdvisor?: string | null;
  briefing: OpportunityBriefing;
};

function clean(value: string | null | undefined): string {
  return (value ?? '').replace(/\s+/g, ' ').trim();
}

function orgTypeLine(src: ApplicantProfileSource): string {
  const explicit = clean(src.entityType) || clean(src.briefing.entityType);
  if (explicit) return explicit;
  const kind = src.entityKind?.trim().toLowerCase();
  if (kind && ENTITY_KIND_LABEL[kind]) return ENTITY_KIND_LABEL[kind];
  if (src.briefing.orgKind) return ORG_KIND_LABEL[src.briefing.orgKind];
  return '';
}

function revenueLine(rows: RevenueYear[] | undefined): string {
  if (!rows?.length) return '';
  return rows.map((r) => `${r.year}: ${r.amountUsd} USD`).join('; ');
}

/** Texto do registo da empresa para a análise de um fundo. */
export function formatApplicantProfileForAnalysis(src: ApplicantProfileSource): {
  block: string;
  hasProfile: boolean;
} {
  const description = clean(src.description);
  const sector = clean(src.sector);
  const country = clean(src.country);
  const themes = src.briefing.themes.map((t) => t.trim()).filter(Boolean);
  const countries = src.briefing.countries.map((c) => c.trim()).filter(Boolean);
  const sectors = (src.sectorLabels ?? []).map((s) => s.trim()).filter(Boolean);
  const orgType = orgTypeLine(src);
  const notes = clean(src.notesForAdvisor);
  const briefingNotes = clean(src.briefing.notes);
  const extraNotes =
    briefingNotes && briefingNotes !== description ? briefingNotes : '';

  const known = [
    `Nome: ${clean(src.name) || 'organização da conta'}`,
    clean(src.shortName) && clean(src.shortName) !== clean(src.name) ? `Nome curto: ${clean(src.shortName)}` : '',
    orgType ? `Tipo de organização: ${orgType}` : '',
    description ? `Descrição: ${description.slice(0, 1200)}` : '',
    sector ? `Sector / actividade: ${sector}` : '',
    sectors.length ? `Temáticas do registo: ${sectors.join(', ')}` : '',
    country ? `País de constituição: ${country}` : '',
    countries.length ? `Países de actuação: ${countries.join(', ')}` : '',
    themes.length ? `Temas de captação: ${themes.join(', ')}` : '',
    src.briefing.legalCountries?.length
      ? `Registo jurídico em: ${src.briefing.legalCountries.join(', ')}`
      : '',
    src.briefing.yearsOperating != null ? `Anos de operação: ${src.briefing.yearsOperating}` : '',
    src.briefing.maturityLevel ? `Maturidade: ${src.briefing.maturityLevel}` : '',
    src.briefing.hasAuditLast5Years === true
      ? 'Auditoria externa nos últimos 5 anos: sim'
      : src.briefing.hasAuditLast5Years === false
        ? 'Auditoria externa nos últimos 5 anos: não'
        : '',
    revenueLine(src.briefing.revenueByYear) ? `Faturamento: ${revenueLine(src.briefing.revenueByYear)}` : '',
    notes ? `Notas do registo: ${notes.slice(0, 800)}` : '',
    extraNotes ? `Notas de captação: ${extraNotes.slice(0, 800)}` : '',
  ].filter(Boolean);

  const missing = [
    orgType ? '' : 'tipo de organização',
    description ? '' : 'descrição da organização',
    sector || sectors.length ? '' : 'sector / actividade',
    country || countries.length ? '' : 'país',
    themes.length ? '' : 'temas de captação',
    src.briefing.yearsOperating != null ? '' : 'anos de operação',
    src.briefing.hasAuditLast5Years == null ? 'auditoria externa' : '',
    src.briefing.revenueByYear?.length ? '' : 'faturamento',
  ].filter(Boolean);

  const hasProfile = known.length > 1;
  const missingLine = missing.length
    ? `Ainda não está no registo inicial (não inventar; só mencionar se mudar o encaixe): ${missing.join(', ')}.`
    : 'O registo inicial cobre os campos usados no encaixe.';

  const block = [
    ...known,
    missingLine,
    hasProfile
      ? 'Este perfil já está registado. Não perguntes de novo quem é a empresa nem o tipo de organização se isso já estiver acima. Se faltar um campo, indica só essa parte do registo inicial.'
      : 'Há uma conta de empresa, mas o registo inicial está quase vazio. Não digas que a empresa não existe: pede para completar as partes em falta no registo.',
  ].join('\n');

  return { block, hasProfile };
}
