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

export type WorkPlanItemKind = 'visit' | 'workshop' | 'deliverable' | 'review' | 'training';

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

function kindForPillar(pillar: string): WorkPlanItemKind {
  if (pillar === 'operations' || pillar === 'sector') return 'visit';
  if (pillar === 'people') return 'training';
  if (pillar === 'strategy') return 'workshop';
  return 'deliverable';
}

export function buildIncubationWorkPlan(
  program: IncubationProgram,
  diagnostic: FullDiagnosticResult,
  locale: DxLocale = 'es'
): { layers: DevelopmentLayer[]; items: WorkPlanItem[]; strategicPlan: StrategicPlanOutline | null } {
  const budget = workItemBudget(program);
  const layersN = layerCountForProgram(program);
  const monthsPerLayer = Math.max(1, Math.ceil(program.durationMonths / layersN));
  const hoursPerLayer = Math.round(program.totalHours / layersN);

  const candidates: WorkPlanItem[] = [];

  let n = 0;
  for (const w of diagnostic.weaknesses) {
    if (n >= budget) break;
    const pillar = w.pillarSlug || 'sector';
    candidates.push({
      id: `wp_${n++}`,
      title:
        locale === 'es'
          ? `Intervención AT: ${w.label.slice(0, 100)}`
          : locale === 'pt'
            ? `Intervenção AT: ${w.label.slice(0, 100)}`
            : `TA intervention: ${w.label.slice(0, 100)}`,
      description:
        locale === 'es'
          ? `Brecha detectada (score ${w.score}). Alinear con plano de incubación.`
          : locale === 'pt'
            ? `Lacuna detetada (score ${w.score}). Alinhar com plano de incubação.`
            : `Gap detected (score ${w.score}). Align with incubation plan.`,
      pillar,
      priority: w.score < 40 ? 'critical' : w.score < 52 ? 'high' : 'medium',
      estimatedHours: w.score < 45 ? 6 : 4,
      kind: kindForPillar(pillar),
      layerIndex: 0,
      horizon: 'program',
    });
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
      description: p.note || '',
      pillar: p.pillarSlug || 'strategy',
      priority: 'medium',
      estimatedHours: 3,
      kind: 'review',
      layerIndex: Math.min(1, layersN - 1),
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
      .map((it) => ({ ...it, layerIndex: i }));
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
