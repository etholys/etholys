/**
 * Plano de trabalho e plano estratégico pós-incubação — derivados do diagnóstico + envelope de tempo.
 */

import type { DxLocale } from './nexus-sector-diagnostic';
import type { FullDiagnosticResult } from './nexus-sector-diagnostic';
import {
  type IncubationProgram,
  layerCountForProgram,
  workItemBudget,
  type StrategicHorizon,
} from './nexus-incubation-program';
import {
  findSeedForQuestion,
  getSectorModule,
  linkDiagnosticToModule,
  type ModuleHref,
  type OpsPlanKind,
} from './nexus-sector-modules';

export type WorkPlanItemKind =
  | 'visit'
  | 'workshop'
  | 'deliverable'
  | 'review'
  | 'training'
  | OpsPlanKind;

export type WorkPlanItem = {
  id: string;
  title: string;
  description: string;
  pillar: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  estimatedHours: number;
  kind: WorkPlanItemKind;
  layerIndex: number;
  horizon: 'program' | '12m' | '36m';
  href?: ModuleHref;
  protocolId?: string;
  questionId?: string;
  dueMonth?: number;
  kpi?: string;
  spendType?: 'action' | 'hire' | 'purchase';
};

export type DevelopmentLayer = {
  index: number;
  title: string;
  monthStart: number;
  monthEnd: number;
  hoursBudget: number;
  goals: string[];
  items: WorkPlanItem[];
};

export type StrategicPlanOutline = {
  horizon: StrategicHorizon;
  vision: string;
  pillars: Array<{ name: string; milestones: string[] }>;
};

const PILLAR_LABEL: Record<string, { es: string; pt: string; en: string }> = {
  strategy: { es: 'Estrategia', pt: 'Estratégia', en: 'Strategy' },
  finance: { es: 'Finanzas', pt: 'Finanças', en: 'Finance' },
  operations: { es: 'Operaciones', pt: 'Operações', en: 'Operations' },
  commercial: { es: 'Comercial', pt: 'Comercial', en: 'Commercial' },
  people: { es: 'Personas', pt: 'Pessoas', en: 'People' },
  digital: { es: 'Digital', pt: 'Digital', en: 'Digital' },
  risk: { es: 'Riesgo', pt: 'Risco', en: 'Risk' },
  sector: { es: 'Sector', pt: 'Setor', en: 'Sector' },
};

function L(row: { es: string; pt: string; en: string }, locale: DxLocale) {
  return row[locale] || row.es;
}

function spendForKind(kind: WorkPlanItemKind, pillar: string): 'action' | 'hire' | 'purchase' {
  if (pillar === 'people') return 'hire';
  if (kind === 'sensor') return 'purchase';
  return 'action';
}

function kpiForItem(kind: WorkPlanItemKind, locale: DxLocale): string {
  if (kind === 'field_book') {
    return locale === 'en' ? '1 real line / week in the book' : locale === 'pt' ? '1 linha real / semana no caderno' : '1 línea real / semana en el cuaderno';
  }
  if (kind === 'sensor') {
    return locale === 'en' ? '1 reading / day on the linked sensor' : locale === 'pt' ? '1 leitura / dia no sensor ligado' : '1 lectura / día en el sensor ligado';
  }
  if (kind === 'ops_unit') {
    return locale === 'en' ? 'Units named and active in the module' : locale === 'pt' ? 'Unidades nomeadas e ativas no módulo' : 'Unidades nombradas y activas en el módulo';
  }
  if (kind === 'protocol') {
    return locale === 'en' ? 'Protocol used: record + date in the book' : locale === 'pt' ? 'Protocolo usado: registo + data no caderno' : 'Protocolo usado: registro + fecha en el cuaderno';
  }
  return locale === 'en' ? 'Evidence + owner + review date' : locale === 'pt' ? 'Evidência + dono + data de revisão' : 'Evidencia + dueño + fecha de revisión';
}

function kindForPillar(pillar: string): WorkPlanItemKind {
  if (pillar === 'operations' || pillar === 'sector') return 'visit';
  if (pillar === 'people') return 'training';
  if (pillar === 'strategy') return 'workshop';
  return 'deliverable';
}

function actionTitle(locale: DxLocale, early: boolean, label: string): string {
  const short = label.slice(0, 90);
  if (early) {
    return locale === 'es'
      ? `Construir base: ${short}`
      : locale === 'pt'
        ? `Construir base: ${short}`
        : `Build foundation: ${short}`;
  }
  return locale === 'es'
    ? `Intervención AT: ${short}`
    : locale === 'pt'
      ? `Intervenção AT: ${short}`
      : `TA intervention: ${short}`;
}

function actionDescription(locale: DxLocale, early: boolean, score: number, label: string): string {
  if (early) {
    return locale === 'es'
      ? `Negocio en arranque (score ${score}). Definir el mínimo viable para «${label.slice(0, 60)}»: qué hacer esta semana, con quién y cómo medir.`
      : locale === 'pt'
        ? `Negócio em arranque (score ${score}). Definir o mínimo viável para «${label.slice(0, 60)}»: o que fazer esta semana, com quem e como medir.`
        : `Startup phase (score ${score}). Define the minimum viable for “${label.slice(0, 60)}”: what to do this week, with whom, how to measure.`;
  }
  return locale === 'es'
    ? `Brecha (score ${score}) en «${label.slice(0, 70)}». Visita o taller: evidencias, dueño de la acción y fecha de revisión.`
    : locale === 'pt'
      ? `Lacuna (score ${score}) em «${label.slice(0, 70)}». Visita ou workshop: evidências, dono da ação e data de revisão.`
      : `Gap (score ${score}) on “${label.slice(0, 70)}”. Visit or workshop: evidence, action owner and review date.`;
}

const FOUNDATION_SEEDS: Array<{ pillar: string; es: string; pt: string; en: string }> = [
  {
    pillar: 'strategy',
    es: 'Definir oferta mínima (qué vende / a quién) en una página',
    pt: 'Definir oferta mínima (o que vende / a quem) numa página',
    en: 'Define minimum offer (what/to whom) on one page',
  },
  {
    pillar: 'commercial',
    es: 'Listar 10 clientes o canales posibles y probar 3 contactos',
    pt: 'Listar 10 clientes ou canais possíveis e testar 3 contactos',
    en: 'List 10 possible customers/channels and try 3 contacts',
  },
  {
    pillar: 'finance',
    es: 'Armar registro simple de caja (entradas/salidas) de 4 semanas',
    pt: 'Montar registo simples de caixa (entradas/saídas) de 4 semanas',
    en: 'Set up a simple 4-week cash in/out log',
  },
  {
    pillar: 'operations',
    es: 'Mapear el flujo pedido→entrega en 5 pasos',
    pt: 'Mapear o fluxo pedido→entrega em 5 passos',
    en: 'Map order→delivery flow in 5 steps',
  },
];

export function buildIncubationWorkPlan(
  program: IncubationProgram,
  diagnostic: FullDiagnosticResult,
  locale: DxLocale = 'es',
  opts?: { earlyVenture?: boolean }
): { layers: DevelopmentLayer[]; items: WorkPlanItem[]; strategicPlan: StrategicPlanOutline | null } {
  const budget = workItemBudget(program);
  const layersN = layerCountForProgram(program);
  const monthsPerLayer = Math.max(1, Math.ceil(program.durationMonths / layersN));
  const hoursPerLayer = Math.round(program.totalHours / layersN);
  const early = Boolean(opts?.earlyVenture);

  const candidates: WorkPlanItem[] = [];

  let n = 0;
  const sectorMod = getSectorModule(diagnostic.sectorId);
  const linked = linkDiagnosticToModule(sectorMod, diagnostic.weaknesses, locale, budget);
  for (const a of linked) {
    if (n >= budget) break;
    candidates.push({
      id: a.seedId,
      title: a.title,
      description: a.description,
      pillar: a.pillar,
      priority: a.priority,
      estimatedHours: a.estimatedHours,
      kind: a.kind,
      layerIndex: 0,
      horizon: 'program',
      href: a.href,
      protocolId: a.protocolId,
      questionId: a.questionId,
      dueMonth: 1,
      kpi: kpiForItem(a.kind, locale),
      spendType: spendForKind(a.kind, a.pillar),
    });
    n += 1;
  }

  for (const w of diagnostic.weaknesses) {
    if (n >= budget) break;
    if (findSeedForQuestion(sectorMod, w.questionId)) continue;
    const pillar = w.pillarSlug || 'sector';
    candidates.push({
      id: `wp_${n++}`,
      title: actionTitle(locale, early, w.label),
      description: actionDescription(locale, early, w.score, w.label),
      pillar,
      priority: w.score < 40 ? 'critical' : w.score < 52 ? 'high' : 'medium',
      estimatedHours: w.score < 45 ? 6 : 4,
      kind: kindForPillar(pillar),
      layerIndex: 0,
      horizon: 'program',
    });
  }

  if (early) {
    for (const seed of FOUNDATION_SEEDS) {
      if (n >= budget) break;
      if (candidates.some((c) => c.title.includes(seed[locale] || seed.es))) continue;
      candidates.push({
        id: `wp_${n++}`,
        title: seed[locale] || seed.es,
        description:
          locale === 'es'
            ? 'Acción de arranque — no asume procesos ya maduros.'
            : locale === 'pt'
              ? 'Ação de arranque — não assume processos já maduros.'
              : 'Startup action — does not assume mature processes.',
        pillar: seed.pillar,
        priority: 'high',
        estimatedHours: 4,
        kind: kindForPillar(seed.pillar),
        layerIndex: 0,
        horizon: 'program',
      });
    }
  }

  for (const p of diagnostic.potentials) {
    if (n >= budget) break;
    candidates.push({
      id: `wp_${n++}`,
      title:
        locale === 'es'
          ? `Potenciar: ${p.label.slice(0, 100)}`
          : locale === 'pt'
            ? `Potenciar: ${p.label.slice(0, 100)}`
            : `Build on: ${p.label.slice(0, 100)}`,
      description:
        p.note ||
        (locale === 'es'
          ? 'Ya hay base — subir un nivel con una acción concreta y fecha.'
          : 'Já há base — subir um nível com uma ação concreta e data.'),
      pillar: p.pillarSlug || 'strategy',
      priority: 'medium',
      estimatedHours: 3,
      kind: 'review',
      layerIndex: Math.min(1, layersN - 1),
      horizon: 'program',
    });
  }

  while (n < Math.min(budget, 12) && candidates.length < 12) {
    candidates.push({
      id: `wp_${n++}`,
      title:
        locale === 'es'
          ? 'Revisión quincenal de prioridades con el técnico'
          : locale === 'pt'
            ? 'Revisão quinzenal de prioridades com o técnico'
            : 'Biweekly priority review with the technician',
      description:
        locale === 'es'
          ? 'Ritmo de acompañamiento: qué se hizo, qué falta, próximo paso.'
          : 'Ritmo de acompanhamento: o que foi feito, o que falta, próximo passo.',
      pillar: 'strategy',
      priority: 'medium',
      estimatedHours: 2,
      kind: 'review',
      layerIndex: Math.min(candidates.length % layersN, layersN - 1),
      horizon: 'program',
    });
  }

  // Distribuir por camadas
  const layers: DevelopmentLayer[] = [];
  for (let i = 0; i < layersN; i++) {
    const start = i * monthsPerLayer + 1;
    const end = Math.min(program.durationMonths, (i + 1) * monthsPerLayer);
    const layerItems = candidates
      .filter((_, idx) => idx % layersN === i)
      .map((it) => ({ ...it, layerIndex: i, dueMonth: it.dueMonth || start }));
    layers.push({
      index: i,
      title:
        locale === 'es'
          ? `Capa ${i + 1} · meses ${start}-${end}`
          : locale === 'pt'
            ? `Camada ${i + 1} · meses ${start}-${end}`
            : `Layer ${i + 1} · months ${start}-${end}`,
      monthStart: start,
      monthEnd: end,
      hoursBudget: hoursPerLayer,
      goals:
        i === 0
          ? locale === 'es'
            ? ['Diagnóstico validado', 'Quick wins operativos']
            : ['Diagnóstico validado', 'Quick wins operacionais']
          : i === layersN - 1
            ? locale === 'es'
              ? ['Medición de KPIs', 'Preparar autonomía']
              : ['Medição de KPIs', 'Preparar autonomia']
            : locale === 'es'
              ? ['Consolidar procesos', 'Escalar lo que funciona']
              : ['Consolidar processos', 'Escalar o que funciona'],
      items: layerItems,
    });
  }

  const flat = layers.flatMap((l) => l.items);

  let strategicPlan: StrategicPlanOutline | null = null;
  if (program.strategicHorizon === '12m' || program.strategicHorizon === '36m') {
    const topPillars = diagnostic.pillarScores.slice(0, 4);
    strategicPlan = {
      horizon: program.strategicHorizon,
      vision:
        locale === 'es'
          ? `Empresa ${diagnostic.sectorName} en autonomía — horizonte ${program.strategicHorizon === '36m' ? '3 años' : '12 meses'}.`
          : locale === 'pt'
            ? `Empresa ${diagnostic.sectorName} em autonomia — horizonte ${program.strategicHorizon === '36m' ? '3 anos' : '12 meses'}.`
            : `${diagnostic.sectorName} self-run — ${program.strategicHorizon} horizon.`,
      pillars: topPillars.map((ps) => ({
        name: L(PILLAR_LABEL[ps.slug] || { es: ps.name, pt: ps.name, en: ps.name }, locale),
        milestones: [
          locale === 'es'
            ? `Consolidar ${ps.name} (score actual ${ps.score})`
            : `Consolidar ${ps.name} (score actual ${ps.score})`,
          locale === 'es' ? 'Revisión trimestral con indicador' : 'Revisão trimestral com indicador',
        ],
      })),
    };

    for (const ps of diagnostic.pillarScores.filter((p) => p.score < 58).slice(0, 3)) {
      flat.push({
        id: `strat_${ps.slug}`,
        title:
          locale === 'es'
            ? `[${program.strategicHorizon}] Reforzar ${ps.name}`
            : `[${program.strategicHorizon}] Reforçar ${ps.name}`,
        description: '',
        pillar: ps.slug,
        priority: 'high',
        estimatedHours: 0,
        kind: 'review',
        layerIndex: layersN - 1,
        horizon: program.strategicHorizon,
      });
    }
  }

  return { layers, items: flat, strategicPlan };
}
