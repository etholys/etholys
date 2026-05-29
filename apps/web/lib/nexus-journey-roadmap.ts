import type { VentureStageId } from '@/lib/nexus-venture';
import { INTERNATIONAL_READINESS_ITEMS, isValidStage } from '@/lib/nexus-venture';

export type JourneyRoadmapTemplate = {
  slotKey: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  titlePt: string;
  titleEs: string;
  titleEn: string;
  descPt: string;
  descEs: string;
  descEn: string;
};

const STAGE_TEMPLATES: Record<VentureStageId, JourneyRoadmapTemplate[]> = {
  DISCOVER: [
    {
      slotKey: 'DISCOVER-d1',
      priority: 'HIGH',
      titlePt: 'Jornada — Mapear modelo de negócio e cliente ideal',
      titleEs: 'Jornada — Mapear modelo de negocio e cliente ideal',
      titleEn: 'Journey — Map business model and ideal customer',
      descPt: 'Derivado da fase Descoberta. Sintetize proposta de valor, canais e dores reais (alinhado ao diagnóstico Nexus).',
      descEs: 'Derivado de la fase Descubrimiento. Sintetice propuesta de valor, canales y dolores reales.',
      descEn: 'Derived from Discovery phase. Summarize value proposition, channels, and real pains.',
    },
    {
      slotKey: 'DISCOVER-d2',
      priority: 'MEDIUM',
      titlePt: 'Jornada — Consolidar diagnóstico e hipóteses a validar',
      titleEs: 'Jornada — Consolidar diagnóstico e hipótesis a validar',
      titleEn: 'Journey — Consolidate diagnostic and hypotheses to validate',
      descPt: 'Cruzar questionário por sectores com próximos testes (métricas simples).',
      descEs: 'Cruce el cuestionario por sectores con próximas pruebas.',
      descEn: 'Cross-check sector questionnaire with next tests and simple metrics.',
    },
  ],
  FOCUS: [
    {
      slotKey: 'FOCUS-f1',
      priority: 'HIGH',
      titlePt: 'Jornada — Segmento prioritário e métrica de tração',
      titleEs: 'Jornada — Segmento prioritario y métrica de tracción',
      titleEn: 'Journey — Priority segment and traction metric',
      descPt: 'Derivado da fase Foco. Escolha um segmento e um número a acompanhar semanalmente.',
      descEs: 'Derivado del foco estratégico. Elija un segmento y un número semanal.',
      descEn: 'Derived from Focus phase. Pick one segment and one weekly number to track.',
    },
    {
      slotKey: 'FOCUS-f2',
      priority: 'MEDIUM',
      titlePt: 'Jornada — Testar proposta de valor (2–3 conversas)',
      titleEs: 'Jornada — Probar propuesta de valor (2–3 conversaciones)',
      titleEn: 'Journey — Test value proposition (2–3 conversations)',
      descPt: 'Entrevistas curtas com clientes ou utilizadores-alvo; registar aprendizagens.',
      descEs: 'Entrevistas cortas con clientes; registrar aprendizajes.',
      descEn: 'Short interviews with target users; log learnings.',
    },
  ],
  BUILD: [
    {
      slotKey: 'BUILD-b1',
      priority: 'HIGH',
      titlePt: 'Jornada — Documentar processos críticos e responsáveis',
      titleEs: 'Jornada — Documentar procesos críticos y responsables',
      titleEn: 'Journey — Document critical processes and owners',
      descPt: 'Derivado da fase Construção. Fluxo mínimo ponta a ponta (vendas, entrega, suporte).',
      descEs: 'Derivado de Construcción. Flujo mínimo de punta a punta.',
      descEn: 'Derived from Build phase. Minimum end-to-end flow (sales, delivery, support).',
    },
    {
      slotKey: 'BUILD-b2',
      priority: 'MEDIUM',
      titlePt: 'Jornada — Alinhar oferta e presença digital ao segmento',
      titleEs: 'Jornada — Alinear oferta y presencia digital al segmento',
      titleEn: 'Journey — Align offer and digital presence to segment',
      descPt: 'Rever site/redes e mensagem comercial vs. segmento prioritário.',
      descEs: 'Revisar web/redes y mensaje vs. segmento prioritario.',
      descEn: 'Review site/social and messaging vs. priority segment.',
    },
  ],
  MEASURE: [
    {
      slotKey: 'MEASURE-m1',
      priority: 'HIGH',
      titlePt: 'Jornada — KPIs e ritmo de revisão',
      titleEs: 'Jornada — KPIs y ritmo de revisión',
      titleEn: 'Journey — KPIs and review cadence',
      descPt: 'Derivado da fase Medição. Calendário de revisão (ex.: quinzenal) e dono de cada KPI.',
      descEs: 'Derivado de Medición. Calendario de revisión y responsables.',
      descEn: 'Derived from Measure phase. Review calendar and KPI owners.',
    },
    {
      slotKey: 'MEASURE-m2',
      priority: 'MEDIUM',
      titlePt: 'Jornada — Revisão de fluxo de caixa e operação',
      titleEs: 'Jornada — Revisión de flujo de caja y operación',
      titleEn: 'Journey — Cash flow and operations review',
      descPt: 'Ligar indicadores operacionais a impacto financeiro (30 dias).',
      descEs: 'Vincular operación con impacto financiero (30 días).',
      descEn: 'Link operational indicators to financial impact (30 days).',
    },
  ],
  SCALE_GLOBAL: [
    {
      slotKey: 'SCALE-s1',
      priority: 'HIGH',
      titlePt: 'Jornada — Plano de entrada em mercados prioritários',
      titleEs: 'Jornada — Plan de entrada en mercados prioritarios',
      titleEn: 'Journey — Go-to-market for priority regions',
      descPt: 'Derivado da fase Escalar / internacional. Use as regiões-alvo da jornada e próximos passos regulatórios.',
      descEs: 'Derivado de escala internacional. Use regiones objetivo y próximos pasos.',
      descEn: 'Derived from Scale / international. Use journey target regions and regulatory next steps.',
    },
    {
      slotKey: 'SCALE-s2',
      priority: 'MEDIUM',
      titlePt: 'Jornada — Conformidade fiscal, dados e logística internacional',
      titleEs: 'Jornada — Cumplimiento fiscal, datos y logística internacional',
      titleEn: 'Journey — Tax, data, and international logistics compliance',
      descPt: 'Checklist prática: faturação, privacidade, Incoterms (ligar à lista internacional).',
      descEs: 'Checklist: facturación, privacidad, Incoterms.',
      descEn: 'Practical checklist: invoicing, privacy, Incoterms.',
    },
  ],
};

export function journeyScopeTagPrefix(kind: 'network' | 'company', id: string): string {
  return kind === 'network' ? `journey-scope:net:${id}` : `journey-scope:co:${id}`;
}

export function journeySlotTag(slotKey: string): string {
  return `journey-slot:${slotKey}`;
}

export function journeyIntlTag(itemId: string): string {
  return `journey-intl:${itemId}`;
}

/** Tarefas de fase (fase actual apenas). */
export function templatesForStage(stage: string): JourneyRoadmapTemplate[] {
  const s = isValidStage(stage) ? stage : 'DISCOVER';
  return STAGE_TEMPLATES[s];
}

/** Até N itens internacionais ainda por marcar (prioridade: maior peso primeiro). */
export function intlGapTemplates(
  checklist: Record<string, boolean>,
  locale: string,
  max: number
): Array<{ slotKey: string; priority: 'MEDIUM'; title: string; description: string }> {
  const out: Array<{ slotKey: string; priority: 'MEDIUM'; title: string; description: string }> = [];
  const sorted = [...INTERNATIONAL_READINESS_ITEMS].sort((a, b) => b.weight - a.weight);
  for (const item of sorted) {
    if (checklist[item.id]) continue;
    const title =
      locale === 'es' ? item.labelEs : locale === 'pt' ? item.labelPt : item.labelEn;
    out.push({
      slotKey: `INTL-${item.id}`,
      priority: 'MEDIUM',
      title:
        locale === 'es'
          ? `Jornada — Prontidão internacional: ${title}`
          : locale === 'pt'
            ? `Jornada — Prontidão internacional: ${title}`
            : `Journey — International readiness: ${title}`,
      description:
        locale === 'es'
          ? 'Gerado a partir da checklist internacional da jornada (item ainda por concluir).'
          : locale === 'pt'
            ? 'Gerado a partir da checklist internacional da jornada (item ainda por concluir).'
            : 'Generated from journey international checklist (item still open).',
    });
    if (out.length >= max) break;
  }
  return out;
}

export function pickLocalizedTemplate(
  t: JourneyRoadmapTemplate,
  locale: string
): { title: string; description: string } {
  if (locale === 'es') return { title: t.titleEs, description: t.descEs };
  if (locale === 'pt') return { title: t.titlePt, description: t.descPt };
  return { title: t.titleEn, description: t.descEn };
}
