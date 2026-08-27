/**
 * Programa de incubação / AT — envelope de acompanhamento (tempo, modo, horizonte).
 */

import type { VentureStageId } from './nexus-venture';
import { isValidStage } from './nexus-venture';

export type IncubationProgramMode = 'intensive' | 'ongoing' | 'graduate';

/** Profundidade do diagnóstico derivada do tempo ou escolha explícita */
export type DiagnosticDepth = 'screening' | 'standard' | 'deep' | 'exhaustive';

export type StrategicHorizon = 'none' | '12m' | '36m';

export type IncubationProgram = {
  mode: IncubationProgramMode;
  durationMonths: number;
  hoursPerMonth: number;
  totalHours: number;
  ventureStage: VentureStageId;
  strategicHorizon: StrategicHorizon;
  siepProjectId?: string | null;
  atEngagementId?: string | null;
  /** Projeto interno do engagement AT (NexusAtProject.id) */
  atProjectId?: string | null;
  /** Override manual da profundidade do diagnóstico */
  diagnosticDepth?: DiagnosticDepth;
  notes?: string;
};

export const INCUBATION_PROGRAM_JSON_TAG = '[[NEXUS_INCUBATION_PROGRAM_V1]]';

export const PROGRAM_MODE_LABELS: Record<
  IncubationProgramMode,
  { es: string; pt: string; en: string; desc: { es: string; pt: string; en: string } }
> = {
  intensive: {
    es: 'Intensivo (projeto / plazo)',
    pt: 'Intensivo (projeto / prazo)',
    en: 'Intensive (project / deadline)',
    desc: {
      es: 'Acompañamiento acotado con entregables y capas de desarrollo.',
      pt: 'Acompanhamento delimitado com entregáveis e camadas de desenvolvimento.',
      en: 'Time-boxed support with deliverables and development layers.',
    },
  },
  ongoing: {
    es: 'Permanente / continuo',
    pt: 'Permanente / contínuo',
    en: 'Ongoing / permanent TA',
    desc: {
      es: 'Incubadora viva — revisiones periódicas y nuevas capas según evolución.',
      pt: 'Incubadora viva — revisões periódicas e novas camadas conforme evolução.',
      en: 'Living incubator — periodic reviews and new layers as the venture evolves.',
    },
  },
  graduate: {
    es: 'Salida / autonomía',
    pt: 'Saída / autonomia',
    en: 'Graduation / self-run',
    desc: {
      es: 'Cierre del acompañamiento presencial; plan estratégico 12–36 meses.',
      pt: 'Fecho do acompanhamento presencial; plano estratégico 12–36 meses.',
      en: 'End hands-on support; leave a 12–36 month strategic plan.',
    },
  },
};

export function defaultIncubationProgram(stage: VentureStageId = 'DISCOVER'): IncubationProgram {
  return {
    mode: 'intensive',
    durationMonths: 6,
    hoursPerMonth: 12,
    totalHours: 72,
    ventureStage: stage,
    strategicHorizon: 'none',
  };
}

export function normalizeProgram(raw: Partial<IncubationProgram> | null | undefined): IncubationProgram {
  const base = defaultIncubationProgram(raw?.ventureStage);
  const months = Math.min(60, Math.max(1, Math.round(Number(raw?.durationMonths) || base.durationMonths)));
  const hpm = Math.min(80, Math.max(2, Math.round(Number(raw?.hoursPerMonth) || base.hoursPerMonth)));
  const mode =
    raw?.mode === 'ongoing' || raw?.mode === 'graduate' || raw?.mode === 'intensive' ? raw.mode : base.mode;
  const horizon =
    raw?.strategicHorizon === '12m' || raw?.strategicHorizon === '36m' ? raw.strategicHorizon : mode === 'graduate' ? '12m' : 'none';
  return {
    mode,
    durationMonths: months,
    hoursPerMonth: hpm,
    totalHours: months * hpm,
    ventureStage:
      raw?.ventureStage && isValidStage(raw.ventureStage) ? raw.ventureStage : base.ventureStage,
    strategicHorizon: horizon,
    siepProjectId: raw?.siepProjectId || null,
    atEngagementId: raw?.atEngagementId || null,
    atProjectId: raw?.atProjectId || null,
    diagnosticDepth: raw?.diagnosticDepth,
    notes: raw?.notes?.slice(0, 2000),
  };
}

export function depthFromProgram(program: IncubationProgram): DiagnosticDepth {
  if (program.diagnosticDepth) return program.diagnosticDepth;
  if (program.mode === 'graduate') return 'standard';
  const h = program.totalHours;
  if (h <= 24) return 'screening';
  if (h <= 72) return 'standard';
  if (h <= 160) return 'deep';
  return 'exhaustive';
}

export function expectedQuestionCount(depth: DiagnosticDepth): { min: number; max: number; label: string } {
  switch (depth) {
    case 'screening':
      return { min: 6, max: 8, label: '~6 (triagem sectorial)' };
    case 'standard':
      return { min: 18, max: 22, label: '~20 (sector + pilares)' };
    case 'deep':
      return { min: 28, max: 36, label: '~30 (análise profunda)' };
    case 'exhaustive':
      return { min: 40, max: 55, label: '~45+ (mapa completo)' };
  }
}

export function parseIncubationProgramFromNotes(notes: string | null | undefined): IncubationProgram | null {
  if (!notes?.includes(INCUBATION_PROGRAM_JSON_TAG)) return null;
  const idx = notes.indexOf(INCUBATION_PROGRAM_JSON_TAG);
  const json = notes.slice(idx + INCUBATION_PROGRAM_JSON_TAG.length).trim();
  try {
    return normalizeProgram(JSON.parse(json) as Partial<IncubationProgram>);
  } catch {
    return null;
  }
}

export function serializeIncubationProgramToNotes(program: IncubationProgram, freeNotes?: string): string {
  const human = (freeNotes || '').replace(INCUBATION_PROGRAM_JSON_TAG, '').trim();
  return `${human ? `${human}\n\n` : ''}${INCUBATION_PROGRAM_JSON_TAG}${JSON.stringify(normalizeProgram(program))}`;
}

export function layerCountForProgram(program: IncubationProgram): number {
  if (program.mode === 'graduate') return 1;
  if (program.mode === 'ongoing') return Math.min(6, Math.max(2, Math.ceil(program.durationMonths / 6)));
  return Math.min(4, Math.max(2, Math.ceil(program.durationMonths / 3)));
}

export function workItemBudget(program: IncubationProgram): number {
  /** ~1 ação de rota por cada 3–4 horas de acompanhamento */
  return Math.max(8, Math.min(48, Math.round(program.totalHours / 3.5)));
}

/** Alias usado pelas APIs de diagnóstico */
export const normalizeIncubationProgram = normalizeProgram;
