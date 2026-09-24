/**
 * Programa de incubação / AT — envelope de acompanhamento (tempo, modo, horizonte).
 */

import type { AtContractKind } from './nexus-at-cycle';
import { contractLoops } from './nexus-at-cycle';
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
  /**
   * self_ai = autodesenvolvimento da empresa ativa (sem horas de consultor).
   * at_assisted = AT a MIPYME cliente (programa de acompanhamento técnico).
   */
  deliveryKind?: 'self_ai' | 'at_assisted';
  /**
   * Tipo de contrato AT — decide se o ciclo fecha ou volta (análise anual + re-diagnóstico).
   * permanente = cliente direto; projeto = prazo; pontual = uma passagem.
   */
  contractKind?: AtContractKind;
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
    deliveryKind: 'at_assisted',
    contractKind: 'project',
  };
}

/** Envelope mínimo para autodiagnóstico da própria empresa (sem AT técnica). */
export function defaultSelfAiProgram(stage: VentureStageId = 'DISCOVER'): IncubationProgram {
  return {
    mode: 'ongoing',
    durationMonths: 12,
    hoursPerMonth: 2,
    totalHours: 24,
    ventureStage: stage,
    strategicHorizon: 'none',
    deliveryKind: 'self_ai',
    contractKind: 'permanent',
    diagnosticDepth: 'standard',
    atEngagementId: null,
    atProjectId: null,
    siepProjectId: null,
  };
}

export function normalizeProgram(raw: Partial<IncubationProgram> | null | undefined): IncubationProgram {
  const kind: 'self_ai' | 'at_assisted' =
    raw?.deliveryKind === 'self_ai' || raw?.deliveryKind === 'at_assisted'
      ? raw.deliveryKind
      : raw?.atEngagementId
        ? 'at_assisted'
        : 'at_assisted';
  const base = kind === 'self_ai' ? defaultSelfAiProgram(raw?.ventureStage) : defaultIncubationProgram(raw?.ventureStage);
  const months = Math.min(60, Math.max(1, Math.round(Number(raw?.durationMonths) || base.durationMonths)));
  const hpm = Math.min(80, Math.max(2, Math.round(Number(raw?.hoursPerMonth) || base.hoursPerMonth)));
  const mode =
    raw?.mode === 'ongoing' || raw?.mode === 'graduate' || raw?.mode === 'intensive' ? raw.mode : base.mode;
  const horizon =
    raw?.strategicHorizon === '12m' || raw?.strategicHorizon === '36m' ? raw.strategicHorizon : mode === 'graduate' ? '12m' : 'none';
  const contractKind: AtContractKind =
    raw?.contractKind === 'permanent' || raw?.contractKind === 'project' || raw?.contractKind === 'punctual'
      ? raw.contractKind
      : mode === 'ongoing'
        ? 'permanent'
        : mode === 'graduate'
          ? 'punctual'
          : 'project';
  return {
    mode,
    durationMonths: months,
    hoursPerMonth: hpm,
    totalHours: months * hpm,
    ventureStage:
      raw?.ventureStage && isValidStage(raw.ventureStage) ? raw.ventureStage : base.ventureStage,
    strategicHorizon: horizon,
    siepProjectId: kind === 'self_ai' ? null : raw?.siepProjectId || null,
    atEngagementId: kind === 'self_ai' ? null : raw?.atEngagementId || null,
    atProjectId: kind === 'self_ai' ? null : raw?.atProjectId || null,
    diagnosticDepth: raw?.diagnosticDepth || base.diagnosticDepth,
    deliveryKind: kind,
    contractKind,
    notes: raw?.notes?.slice(0, 2000),
  };
}

export function applyContractKind(program: IncubationProgram, kind: AtContractKind): IncubationProgram {
  if (kind === 'permanent') {
    return normalizeProgram({
      ...program,
      contractKind: 'permanent',
      mode: 'ongoing',
      durationMonths: Math.max(12, program.durationMonths),
      strategicHorizon: program.strategicHorizon === 'none' ? '12m' : program.strategicHorizon,
    });
  }
  if (kind === 'punctual') {
    return normalizeProgram({
      ...program,
      contractKind: 'punctual',
      mode: 'intensive',
      durationMonths: Math.min(3, program.durationMonths || 2),
      strategicHorizon: 'none',
    });
  }
  return normalizeProgram({
    ...program,
    contractKind: 'project',
    mode: 'intensive',
    durationMonths: program.durationMonths || 6,
  });
}

export function programLoopsAnnually(program: IncubationProgram): boolean {
  return contractLoops(program.contractKind || 'project').annualReview;
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
      return { min: 8, max: 12, label: '~10 (triagem em camadas)' };
    case 'standard':
      return { min: 16, max: 26, label: '~20–24 (360: estrutura · gestão · produção · comercial)' };
    case 'deep':
      return { min: 24, max: 40, label: '~30 (camadas + matriz setorial)' };
    case 'exhaustive':
      return { min: 35, max: 60, label: '~45+ (mapa completo)' };
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
  if (program.deliveryKind === 'self_ai') return 12;
  /** AT: mínimo 12 ações concretas; escala com horas */
  return Math.max(12, Math.min(48, Math.round(program.totalHours / 3)));
}

/** Alias usado pelas APIs de diagnóstico */
export const normalizeIncubationProgram = normalizeProgram;
