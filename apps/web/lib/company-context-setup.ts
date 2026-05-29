/**
 * Dados do assistente de contexto (Fase 2) — alimenta priorização e futuros feature flags.
 * Não constitui aconselhamento legal ou fiscal; o utilizador confirma com o seu contador.
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
  sectorId?: string;
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
export type ModuleHintCode = 'ATLAS' | 'SIEP' | 'FUNDHUB' | 'NEXUS' | 'PRISM' | 'CARTA';

const GOAL_TO_MODULES: Record<string, ModuleHintCode[]> = {
  operations: ['ATLAS', 'SIEP'],
  fundraising: ['FUNDHUB', 'NEXUS', 'PRISM'],
  export: ['ATLAS', 'FUNDHUB'],
  impact_reporting: ['PRISM', 'SIEP'],
  governance: ['CARTA', 'NEXUS'],
};

/**
 * Deduplicado, baseado em objectivos; não esconde módulos na UI (isso fica em feature flags futuros).
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
  ATLAS: { pt: 'ATLAS (finanças, stock, POs)', es: 'ATLAS (finanzas, stock, OCs)', en: 'ATLAS (finance, stock, POs)' },
  SIEP: { pt: 'SIEP (projetos e execução)', es: 'SIEP (proyectos)', en: 'SIEP (projects & delivery)' },
  FUNDHUB: { pt: 'FUNDHUB (funding e propostas)', es: 'FUNDHUB (funding y propuestas)', en: 'FUNDHUB (funding & proposals)' },
  NEXUS: { pt: 'NEXUS (rede, roadmap)', es: 'NEXUS (red, hoja de ruta)', en: 'NEXUS (network, roadmap)' },
  PRISM: { pt: 'PRISM (M&E, evidência para funders)', es: 'PRISM (M&E, evidencia)', en: 'PRISM (M&E, donor evidence)' },
  CARTA: { pt: 'CARTA (aprovações ligeiras)', es: 'CARTA (aprobaciones)', en: 'CARTA (light approvals)' },
};

export function emptyContextSetup(): CompanyContextSetup {
  return { v: 1, primaryGoals: [] };
}

export function isContextSetupMeaningful(ctx: CompanyContextSetup | null | undefined): boolean {
  if (!ctx || ctx.v !== 1) return false;
  return Boolean(
    ctx.sectorId ||
      ctx.entityKind ||
      ctx.countryPrimary ||
      ctx.tradesInternationally != null ||
      (ctx.primaryGoals && ctx.primaryGoals.length > 0) ||
      (ctx.notesForAdvisor && ctx.notesForAdvisor.trim().length > 0)
  );
}
