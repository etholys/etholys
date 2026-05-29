/**
 * Jornada Nexus — modelo tipo incubadora + dimensão internacional (negócio sustentável no sentido amplo).
 */

export type VentureStageId = 'DISCOVER' | 'FOCUS' | 'BUILD' | 'MEASURE' | 'SCALE_GLOBAL';

export const VENTURE_STAGE_ORDER: VentureStageId[] = [
  'DISCOVER',
  'FOCUS',
  'BUILD',
  'MEASURE',
  'SCALE_GLOBAL',
];

export type VentureStageDef = {
  id: VentureStageId;
  labelPt: string;
  labelEs: string;
  labelEn: string;
  summaryPt: string;
  summaryEs: string;
  summaryEn: string;
};

export const VENTURE_STAGES: VentureStageDef[] = [
  {
    id: 'DISCOVER',
    labelPt: 'Descoberta',
    labelEs: 'Descubrimiento',
    labelEn: 'Discovery',
    summaryPt: 'Clarificar modelo de negócio, cliente ideal e dores reais. Diagnóstico estruturado.',
    summaryEs: 'Aclarar modelo de negocio, cliente ideal y dolores reales. Diagnóstico estructurado.',
    summaryEn: 'Clarify business model, ICP, and real pains. Structured diagnostic.',
  },
  {
    id: 'FOCUS',
    labelPt: 'Foco estratégico',
    labelEs: 'Foco estratégico',
    labelEn: 'Strategic focus',
    summaryPt: 'Segmento prioritário, proposta de valor testável, métricas mínimas de tração.',
    summaryEs: 'Segmento prioritario, propuesta de valor testable, métricas mínimas de tracción.',
    summaryEn: 'Priority segment, testable value proposition, minimum traction metrics.',
  },
  {
    id: 'BUILD',
    labelPt: 'Construção',
    labelEs: 'Construcción',
    labelEn: 'Build',
    summaryPt: 'Processos, equipa, oferta comercial e presença digital coerente com a escala pretendida.',
    summaryEs: 'Procesos, equipo, oferta comercial y presencia digital alineados a la escala.',
    summaryEn: 'Processes, team, commercial offer and digital presence aligned to intended scale.',
  },
  {
    id: 'MEASURE',
    labelPt: 'Medição & ritmo',
    labelEs: 'Medición y ritmo',
    labelEn: 'Measure & cadence',
    summaryPt: 'KPIs, fluxo de caixa, revisões periódicas e melhoria contínua (sustentabilidade operacional e financeira).',
    summaryEs: 'KPIs, flujo de caja, revisiones periódicas y mejora continua.',
    summaryEn: 'KPIs, cash flow, periodic reviews, continuous improvement.',
  },
  {
    id: 'SCALE_GLOBAL',
    labelPt: 'Escalar / internacional',
    labelEs: 'Escalar / internacional',
    labelEn: 'Scale / international',
    summaryPt: 'Mercados-alvo fora do país, conformidade, parceiros e logística internacional.',
    summaryEs: 'Mercados fuera del país, cumplimiento, socios y logística internacional.',
    summaryEn: 'Cross-border markets, compliance, partners, international logistics.',
  },
];

export type InternationalItem = {
  id: string;
  labelPt: string;
  labelEs: string;
  labelEn: string;
  weight: number;
};

/** Itens de prontidão para negócio internacional (não só “verde”) */
export const INTERNATIONAL_READINESS_ITEMS: InternationalItem[] = [
  {
    id: 'pricing_multi_currency',
    weight: 1,
    labelPt: 'Política de preços e moeda para clientes no exterior',
    labelEs: 'Política de precios y moneda para clientes en el exterior',
    labelEn: 'Pricing & currency policy for foreign customers',
  },
  {
    id: 'contracts_cross_border',
    weight: 1,
    labelPt: 'Contratos / termos adaptados a jurisdições-alvo',
    labelEs: 'Contratos / términos adaptados a jurisdicciones objetivo',
    labelEn: 'Contracts / terms adapted to target jurisdictions',
  },
  {
    id: 'tax_vat_export',
    weight: 1,
    labelPt: 'IVA / impostos e facturação transfronteiriça mapeados com contabilista',
    labelEs: 'IVA / impuestos y facturación transfronteriza con asesor',
    labelEn: 'VAT/tax & cross-border invoicing mapped with advisor',
  },
  {
    id: 'privacy_data_transfer',
    weight: 1,
    labelPt: 'Protecção de dados e transferências (RGPD / equivalentes)',
    labelEs: 'Protección de datos y transferencias (RGPD / equivalentes)',
    labelEn: 'Data protection & transfers (GDPR / equivalents)',
  },
  {
    id: 'logistics_incoterms',
    weight: 1,
    labelPt: 'Logística, prazos de entrega e Incoterms definidos para exportação',
    labelEs: 'Logística, plazos e Incoterms definidos para exportación',
    labelEn: 'Logistics, lead times and Incoterms for export',
  },
  {
    id: 'marketing_english',
    weight: 1,
    labelPt: 'Materiais comerciais em língua franca (ex.: inglês) ou localizados',
    labelEs: 'Materiales comerciales en lengua franca o localizados',
    labelEn: 'Commercial materials in lingua franca or localized',
  },
  {
    id: 'partners_channel',
    weight: 1,
    labelPt: 'Parceiro ou canal no mercado-alvo (distribuidor, marketplace, agente)',
    labelEs: 'Socio o canal en el mercado objetivo',
    labelEn: 'Partner or channel in target market',
  },
  {
    id: 'ip_brand',
    weight: 1,
    labelPt: 'Marca / PI revistos para os mercados prioritários',
    labelEs: 'Marca / PI revisados para mercados prioritarios',
    labelEn: 'Brand / IP reviewed for priority markets',
  },
];

export function defaultInternationalChecklist(): Record<string, boolean> {
  return Object.fromEntries(INTERNATIONAL_READINESS_ITEMS.map((i) => [i.id, false]));
}

export function parseInternationalChecklist(raw: unknown): Record<string, boolean> {
  const base = defaultInternationalChecklist();
  if (!raw || typeof raw !== 'object') return base;
  for (const k of Object.keys(base)) {
    if (k in (raw as object) && typeof (raw as Record<string, unknown>)[k] === 'boolean') {
      base[k] = (raw as Record<string, boolean>)[k];
    }
  }
  return base;
}

export function internationalReadinessScore(checklist: Record<string, boolean>): number {
  let num = 0;
  let den = 0;
  for (const item of INTERNATIONAL_READINESS_ITEMS) {
    den += item.weight;
    if (checklist[item.id]) num += item.weight;
  }
  return den === 0 ? 0 : Math.round((num / den) * 100);
}

export function isValidStage(s: string): s is VentureStageId {
  return (VENTURE_STAGE_ORDER as string[]).includes(s);
}

export function stageLabel(stage: VentureStageId, locale: string): string {
  const def = VENTURE_STAGES.find((x) => x.id === stage);
  if (!def) return stage;
  if (locale === 'es') return def.labelEs;
  if (locale === 'pt') return def.labelPt;
  return def.labelEn;
}

export function stageSummary(stage: VentureStageId, locale: string): string {
  const def = VENTURE_STAGES.find((x) => x.id === stage);
  if (!def) return '';
  if (locale === 'es') return def.summaryEs;
  if (locale === 'pt') return def.summaryPt;
  return def.summaryEn;
}
