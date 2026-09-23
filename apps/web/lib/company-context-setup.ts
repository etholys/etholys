/**
 * Company context collected at /hub/setup — used for Advisor priorities.
 */
export const COMPANY_SECTORS = [
  { id: 'agriculture', label: { es: 'Agricultura y agroindustria', pt: 'Agricultura e agroindústria', en: 'Agriculture & agro' } },
  { id: 'manufacturing', label: { es: 'Industria y manufactura', pt: 'Indústria e manufatura', en: 'Manufacturing' } },
  { id: 'services', label: { es: 'Servicios', pt: 'Serviços', en: 'Services' } },
  { id: 'retail', label: { es: 'Comercio y retail', pt: 'Comércio e retail', en: 'Retail & trade' } },
  { id: 'ngo', label: { es: 'ONG / tercer sector', pt: 'ONG / terceiro setor', en: 'NGO / non-profit' } },
  { id: 'public', label: { es: 'Entidad pública o mixta', pt: 'Entidade pública ou mista', en: 'Public or hybrid entity' } },
  { id: 'cooperative', label: { es: 'Cooperativa o asociación', pt: 'Cooperativa ou associação', en: 'Cooperative or association' } },
  { id: 'other', label: { es: 'Otro', pt: 'Outro', en: 'Other' } },
] as const;

export type CompanyContextSetup = {
  v: 1;
  /** Temática principal (primeiro de sectorIds — compat) */
  sectorId?: string;
  /** Uma empresa pode operar em várias temáticas (ex. horta + aves) */
  sectorIds?: string[];
  entityKind?: 'company' | 'cooperative' | 'ngo' | 'association' | 'public' | 'other';
  countryPrimary?: string;
  /** Moeda operacional (pode alinhar com Company.currency) */
  currencyOp?: string;
  tradesInternationally?: boolean;
  imports?: boolean;
  exports?: boolean;
  primaryGoals?: string[]; // e.g. 'operations', 'fundraising', 'export', 'impact_reporting', 'governance'
  notesForAdvisor?: string;
  /** ISO-8601: utilizador confirmou o aviso de não substituir aconselhamento profissional */
  legalDisclaimerAcceptedAt?: string;
};

/** Códigos de módulo para sugestões pós-wizard (UI / Advisor). */
export type ModuleHintCode = 'ATLAS' | 'SIEP' | 'FUNDHUB' | 'NEXUS' | 'PRISM' | 'FORGE';

const GOAL_TO_MODULES: Record<string, ModuleHintCode[]> = {
  operations: ['ATLAS', 'SIEP'],
  fundraising: ['FUNDHUB', 'NEXUS', 'PRISM'],
  export: ['ATLAS', 'FUNDHUB'],
  impact_reporting: ['PRISM', 'SIEP'],
  governance: ['NEXUS', 'ATLAS'],
};

/**
 * Unique module codes derived from selected goals.
 */
export function deriveModuleHints(ctx: CompanyContextSetup | null | undefined): ModuleHintCode[] {
  if (!ctx?.primaryGoals?.length) return [];
  const set = new Set<ModuleHintCode>();
  for (const g of ctx.primaryGoals) {
    const m = GOAL_TO_MODULES[g];
    if (m) for (const x of m) set.add(x);
  }
  return [...set];
}

export const MODULE_HINT_LABEL: Record<
  ModuleHintCode,
  { pt: string; es: string; en: string }
> = {
  ATLAS: { pt: 'ATLAS (ERP 360°, finanças, stock)', es: 'ATLAS (ERP 360°, finanzas, stock)', en: 'ATLAS (ERP 360°, finance, stock)' },
  SIEP: { pt: 'SIEP (execução e inovação de projetos)', es: 'SIEP (ejecución e innovación de proyectos)', en: 'SIEP (project execution & innovation)' },
  FUNDHUB: { pt: 'FundHub (captação e propostas)', es: 'FundHub (captación y propuestas)', en: 'FundHub (funding & proposals)' },
  NEXUS: { pt: 'NEXUS (diagnóstico MIPYME, rota)', es: 'NEXUS (diagnóstico MIPYME, ruta)', en: 'NEXUS (MIPYME diagnosis, roadmap)' },
  PRISM: { pt: 'PRISM (dados, ESG e impacto)', es: 'PRISM (datos, ESG e impacto)', en: 'PRISM (data, ESG & impact)' },
  FORGE: { pt: 'FORGE (cursos e formação)', es: 'FORGE (cursos y formación)', en: 'FORGE (courses & learning)' },
};

export function emptyContextSetup(): CompanyContextSetup {
  return { v: 1, primaryGoals: [] };
}

export function isContextSetupMeaningful(ctx: CompanyContextSetup | null | undefined): boolean {
  if (!ctx || ctx.v !== 1) return false;
  return Boolean(
    ctx.sectorId ||
      (ctx.sectorIds && ctx.sectorIds.length > 0) ||
      ctx.entityKind ||
      ctx.countryPrimary ||
      ctx.tradesInternationally != null ||
      (ctx.primaryGoals && ctx.primaryGoals.length > 0) ||
      (ctx.notesForAdvisor && ctx.notesForAdvisor.trim().length > 0)
  );
}
