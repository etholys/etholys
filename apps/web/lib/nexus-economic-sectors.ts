/**
 * Setores económicos para AT / consultoria NEXUS — catálogo partilhável (client-safe).
 * Mais granular que COMPANY_SECTORS (setup legado); ids estáveis para filtros e playbooks.
 */

import type { AtCaseKind } from './nexus-at-shared';

export type EconomicSectorGroupId =
  | 'agro'
  | 'industry'
  | 'commerce'
  | 'services'
  | 'institutional'
  | 'other';

export type EconomicSector = {
  id: string;
  groupId: EconomicSectorGroupId;
  label: { es: string; pt: string; en: string };
  /** Linhas típicas de AT / consultoria neste sector */
  focusAreas: { es: string; pt: string; en: string }[];
  suggestedCaseKinds: AtCaseKind[];
};

export const NEXUS_ECONOMIC_SECTOR_GROUPS: {
  id: EconomicSectorGroupId;
  label: { es: string; pt: string; en: string };
}[] = [
  { id: 'agro', label: { es: 'Agro y alimentación', pt: 'Agro e alimentação', en: 'Agro & food' } },
  { id: 'industry', label: { es: 'Industria', pt: 'Indústria', en: 'Industry' } },
  { id: 'commerce', label: { es: 'Comercio y hostelería', pt: 'Comércio e restauração', en: 'Commerce & hospitality' } },
  { id: 'services', label: { es: 'Servicios', pt: 'Serviços', en: 'Services' } },
  { id: 'institutional', label: { es: 'Institucional', pt: 'Institucional', en: 'Institutional' } },
  { id: 'other', label: { es: 'Otro', pt: 'Outro', en: 'Other' } },
];

export const NEXUS_ECONOMIC_SECTORS: EconomicSector[] = [
  {
    id: 'agriculture',
    groupId: 'agro',
    label: { es: 'Agricultura (cultivos)', pt: 'Agricultura (culturas)', en: 'Agriculture (crops)' },
    focusAreas: [
      { es: 'Plan de siembra/cosecha y costes por hectárea', pt: 'Plano de sementeira/colheita e custos por hectare', en: 'Crop plan and cost per hectare' },
      { es: 'Acceso a insumos y trazabilidad', pt: 'Acesso a insumos e rastreabilidade', en: 'Inputs access and traceability' },
      { es: 'Comercialización y precios de mercado', pt: 'Comercialização e preços de mercado', en: 'Market access and pricing' },
    ],
    suggestedCaseKinds: ['visit', 'diagnosis', 'followup'],
  },
  {
    id: 'livestock',
    groupId: 'agro',
    label: { es: 'Pecuaria / ganadería', pt: 'Pecuária / gado', en: 'Livestock' },
    focusAreas: [
      { es: 'Sanidad, alimentación y productividad del rebaño', pt: 'Sanidade, alimentação e produtividade do rebanho', en: 'Herd health, feed and productivity' },
      { es: 'Registros zoosanitarios y cumplimiento', pt: 'Registos zoossanitários e conformidade', en: 'Health records and compliance' },
      { es: 'Cadena de frío y venta de carne/leche', pt: 'Cadeia de frio e venda de carne/leite', en: 'Cold chain and product sales' },
    ],
    suggestedCaseKinds: ['visit', 'diagnosis', 'call'],
  },
  {
    id: 'agroindustry',
    groupId: 'agro',
    label: { es: 'Agroindustria / transformación', pt: 'Agroindústria / transformação', en: 'Agro-processing' },
    focusAreas: [
      { es: 'Procesos, mermas y capacidad instalada', pt: 'Processos, perdas e capacidade instalada', en: 'Processes, waste and capacity' },
      { es: 'Normas de inocuidad y etiquetado', pt: 'Normas de inocuidade e rotulagem', en: 'Food safety and labeling' },
      { es: 'Contratos B2B y logística de distribución', pt: 'Contratos B2B e logística de distribuição', en: 'B2B contracts and distribution' },
    ],
    suggestedCaseKinds: ['visit', 'diagnosis', 'followup'],
  },
  {
    id: 'chemical_industry',
    groupId: 'industry',
    label: { es: 'Industria química', pt: 'Indústria química', en: 'Chemical industry' },
    focusAreas: [
      { es: 'Seguridad, EPIs y fichas de datos', pt: 'Segurança, EPIs e fichas de dados', en: 'Safety, PPE and SDS' },
      { es: 'Control de calidad y lotes', pt: 'Controlo de qualidade e lotes', en: 'QC and batch control' },
      { es: 'Permisos ambientales y residuos', pt: 'Licenças ambientais e resíduos', en: 'Environmental permits and waste' },
    ],
    suggestedCaseKinds: ['visit', 'diagnosis', 'other'],
  },
  {
    id: 'manufacturing',
    groupId: 'industry',
    label: { es: 'Manufactura general', pt: 'Manufatura geral', en: 'General manufacturing' },
    focusAreas: [
      { es: 'Layout, tiempos y cuellos de botella', pt: 'Layout, tempos e gargalos', en: 'Layout, throughput and bottlenecks' },
      { es: 'Costes unitarios y proveedores', pt: 'Custos unitários e fornecedores', en: 'Unit costs and suppliers' },
      { es: 'Mantenimiento y paradas no planificadas', pt: 'Manutenção e paragens não planeadas', en: 'Maintenance and downtime' },
    ],
    suggestedCaseKinds: ['visit', 'diagnosis', 'followup'],
  },
  {
    id: 'construction',
    groupId: 'industry',
    label: { es: 'Construcción', pt: 'Construção', en: 'Construction' },
    focusAreas: [
      { es: 'Presupuesto por obra y control de avance', pt: 'Orçamento por obra e controlo de avanço', en: 'Job costing and progress control' },
      { es: 'Subcontratas y seguridad en obra', pt: 'Subempreiteiros e segurança em obra', en: 'Subcontractors and site safety' },
      { es: 'Facturación y cobros por hito', pt: 'Faturação e cobranças por marco', en: 'Milestone billing and collections' },
    ],
    suggestedCaseKinds: ['visit', 'call', 'followup'],
  },
  {
    id: 'food_hospitality',
    groupId: 'commerce',
    label: { es: 'Bares, cafeterías y restaurantes', pt: 'Bares, cafés e restaurantes', en: 'Bars, cafés & restaurants' },
    focusAreas: [
      { es: 'Food cost, carta y rotación de platos', pt: 'Food cost, carta e rotação de pratos', en: 'Food cost, menu and dish rotation' },
      { es: 'Horarios, turnos y productividad del local', pt: 'Horários, turnos e produtividade do espaço', en: 'Shifts, staffing and floor productivity' },
      { es: 'Higiene, licencias y experiencia del cliente', pt: 'Higiene, licenças e experiência do cliente', en: 'Hygiene, licenses and customer experience' },
    ],
    suggestedCaseKinds: ['visit', 'diagnosis', 'followup'],
  },
  {
    id: 'retail_supermarket',
    groupId: 'commerce',
    label: { es: 'Supermercados y autoservicio', pt: 'Supermercados e self-service', en: 'Supermarkets & self-service' },
    focusAreas: [
      { es: 'Surteo, mermas y rotación de stock', pt: 'Sortido, perdas e rotação de stock', en: 'Assortment, shrink and stock turns' },
      { es: 'Precios, promociones y margen por categoría', pt: 'Preços, promoções e margem por categoria', en: 'Pricing, promos and category margin' },
      { es: 'Proveedores y condiciones de pago', pt: 'Fornecedores e condições de pagamento', en: 'Suppliers and payment terms' },
    ],
    suggestedCaseKinds: ['visit', 'diagnosis', 'followup'],
  },
  {
    id: 'retail_shop',
    groupId: 'commerce',
    label: { es: 'Comercio minorista / tiendas', pt: 'Comércio a retalho / lojas', en: 'Retail shops' },
    focusAreas: [
      { es: 'Flujo de caja y punto de equilibrio', pt: 'Fluxo de caixa e ponto de equilíbrio', en: 'Cash flow and break-even' },
      { es: 'Visual merchandising y conversión', pt: 'Merchandising e conversão', en: 'Merchandising and conversion' },
      { es: 'Canal online vs. físico', pt: 'Canal online vs. físico', en: 'Online vs. physical channel' },
    ],
    suggestedCaseKinds: ['visit', 'call', 'followup'],
  },
  {
    id: 'transport_logistics',
    groupId: 'services',
    label: { es: 'Transporte y logística', pt: 'Transporte e logística', en: 'Transport & logistics' },
    focusAreas: [
      { es: 'Coste por km/ruta y ocupación', pt: 'Custo por km/rota e ocupação', en: 'Cost per km/route and utilization' },
      { es: 'Mantenimiento de flota y seguros', pt: 'Manutenção de frota e seguros', en: 'Fleet maintenance and insurance' },
      { es: 'Contratos y SLA con clientes', pt: 'Contratos e SLA com clientes', en: 'Contracts and client SLAs' },
    ],
    suggestedCaseKinds: ['visit', 'call', 'followup'],
  },
  {
    id: 'professional_services',
    groupId: 'services',
    label: { es: 'Servicios profesionales (B2B)', pt: 'Serviços profissionais (B2B)', en: 'Professional services (B2B)' },
    focusAreas: [
      { es: 'Propuesta de valor y pricing de servicios', pt: 'Proposta de valor e pricing de serviços', en: 'Value proposition and service pricing' },
      { es: 'Pipeline comercial y conversión', pt: 'Pipeline comercial e conversão', en: 'Sales pipeline and conversion' },
      { es: 'Capacidad de entrega y subcontratación', pt: 'Capacidade de entrega e subcontratação', en: 'Delivery capacity and outsourcing' },
    ],
    suggestedCaseKinds: ['call', 'diagnosis', 'followup'],
  },
  {
    id: 'technology',
    groupId: 'services',
    label: { es: 'Tecnología / software', pt: 'Tecnologia / software', en: 'Technology / software' },
    focusAreas: [
      { es: 'Modelo de ingresos (SaaS, proyectos, mixto)', pt: 'Modelo de receita (SaaS, projetos, misto)', en: 'Revenue model (SaaS, projects, hybrid)' },
      { es: 'Roadmap de producto y retención', pt: 'Roadmap de produto e retenção', en: 'Product roadmap and retention' },
      { es: 'Contratos, propiedad intelectual y datos', pt: 'Contratos, PI e dados', en: 'Contracts, IP and data' },
    ],
    suggestedCaseKinds: ['call', 'diagnosis', 'followup'],
  },
  {
    id: 'tourism',
    groupId: 'services',
    label: { es: 'Turismo y alojamiento', pt: 'Turismo e alojamento', en: 'Tourism & lodging' },
    focusAreas: [
      { es: 'Ocupación, tarifas y estacionalidad', pt: 'Ocupação, tarifas e sazonalidade', en: 'Occupancy, rates and seasonality' },
      { es: 'Canales de reserva y reputación online', pt: 'Canales de reserva e reputação online', en: 'Booking channels and online reputation' },
      { es: 'Costes fijos vs. variables del establecimiento', pt: 'Custos fixos vs. variáveis do estabelecimento', en: 'Fixed vs. variable lodging costs' },
    ],
    suggestedCaseKinds: ['visit', 'diagnosis', 'call'],
  },
  {
    id: 'health_social',
    groupId: 'services',
    label: { es: 'Salud y servicios sociales', pt: 'Saúde e serviços sociais', en: 'Health & social services' },
    focusAreas: [
      { es: 'Capacidad asistencial y listas de espera', pt: 'Capacidade assistencial e listas de espera', en: 'Care capacity and waitlists' },
      { es: 'Cumplimiento y registros clínicos/administrativos', pt: 'Conformidade e registos clínicos/administrativos', en: 'Compliance and clinical/admin records' },
      { es: 'Financiación pública/privada y costes', pt: 'Financiamento público/privado e custos', en: 'Public/private funding and costs' },
    ],
    suggestedCaseKinds: ['visit', 'diagnosis', 'call'],
  },
  {
    id: 'cooperative',
    groupId: 'institutional',
    label: { es: 'Cooperativa / asociación productiva', pt: 'Cooperativa / associação produtiva', en: 'Cooperative / producer association' },
    focusAreas: [
      { es: 'Gobernanza y participación de socios', pt: 'Governança e participação de sócios', en: 'Governance and member participation' },
      { es: 'Servicios comunes a socios (compra, venta, crédito)', pt: 'Serviços comuns aos sócios (compra, venda, crédito)', en: 'Shared services to members' },
      { es: 'Indicadores colectivos y reparto de resultados', pt: 'Indicadores coletivos e repartição de resultados', en: 'Collective KPIs and surplus distribution' },
    ],
    suggestedCaseKinds: ['visit', 'diagnosis', 'followup'],
  },
  {
    id: 'other',
    groupId: 'other',
    label: { es: 'Otro sector', pt: 'Outro setor', en: 'Other sector' },
    focusAreas: [
      { es: 'Diagnóstico inicial de modelo de negocio', pt: 'Diagnóstico inicial de modelo de negócio', en: 'Initial business model diagnosis' },
      { es: 'Finanzas básicas y flujo de caja', pt: 'Finanças básicas e fluxo de caixa', en: 'Basic finance and cash flow' },
      { es: 'Priorización de intervenciones AT', pt: 'Priorização de intervenções AT', en: 'Prioritize AT interventions' },
    ],
    suggestedCaseKinds: ['diagnosis', 'visit', 'followup'],
  },
];

const byId = new Map(NEXUS_ECONOMIC_SECTORS.map((s) => [s.id, s]));

/** Mapeia ids legados de COMPANY_SECTORS → catálogo AT */
const LEGACY_SECTOR_MAP: Record<string, string> = {
  agriculture: 'agriculture',
  manufacturing: 'manufacturing',
  services: 'professional_services',
  retail: 'retail_shop',
  ngo: 'other',
  public: 'other',
  cooperative: 'cooperative',
  other: 'other',
};

export function isEconomicSectorId(id: string): boolean {
  return byId.has(id);
}

export function normalizeEconomicSectorId(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  const id = raw.trim();
  if (byId.has(id)) return id;
  return LEGACY_SECTOR_MAP[id] || null;
}

export function getEconomicSector(id: string | null | undefined): EconomicSector | null {
  const norm = normalizeEconomicSectorId(id);
  return norm ? byId.get(norm) || null : null;
}

export function sectorLabel(
  id: string | null | undefined,
  locale: 'es' | 'pt' | 'en' = 'es'
): string | null {
  const s = getEconomicSector(id);
  return s ? s.label[locale] : null;
}

export function parseCompanySectorId(contextSetupJson: unknown): string | null {
  if (!contextSetupJson || typeof contextSetupJson !== 'object') return null;
  const sectorId = (contextSetupJson as { sectorId?: unknown }).sectorId;
  return typeof sectorId === 'string' ? normalizeEconomicSectorId(sectorId) : null;
}

export type SectorCatalogRow = {
  id: string;
  groupId: EconomicSectorGroupId;
  label: { es: string; pt: string; en: string };
  focusAreas: { es: string; pt: string; en: string }[];
  suggestedCaseKinds: AtCaseKind[];
};

export function listSectorCatalog(): SectorCatalogRow[] {
  return NEXUS_ECONOMIC_SECTORS.map(({ id, groupId, label, focusAreas, suggestedCaseKinds }) => ({
    id,
    groupId,
    label,
    focusAreas,
    suggestedCaseKinds,
  }));
}

export function listSectorGroups() {
  return NEXUS_ECONOMIC_SECTOR_GROUPS;
}

export function parseEngagementSectorIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return [
    ...new Set(
      raw
        .map((x) => (typeof x === 'string' ? normalizeEconomicSectorId(x) : null))
        .filter(Boolean) as string[]
    ),
  ];
}
