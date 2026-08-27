/**
 * Diagnóstico NEXUS por setor + pilares — camadas conforme programa de incubação.
 */

import {
  NEXUS_DIAGNOSTIC_QUIZ,
  type QuizQuestion,
  type QuizSector,
} from './nexus-diagnostic-quiz';
import { NEXUS_ECONOMIC_SECTORS, getEconomicSector, normalizeEconomicSectorId, sectorLabel } from './nexus-economic-sectors';
import {
  depthFromProgram,
  type DiagnosticDepth,
  type IncubationProgram,
} from './nexus-incubation-program';

export type DxLocale = 'es' | 'pt' | 'en';

export type DxSection = 'universal' | 'sector' | 'pillar' | 'custom';

export type DxOption = {
  id: string;
  label: { es: string; pt: string; en: string };
  score: number;
};

export type DxQuestion = {
  id: string;
  sectorId: string | 'universal' | 'custom';
  source: 'base' | 'extension' | 'custom';
  section: DxSection;
  pillarSlug?: string;
  areaName?: string;
  prompt: { es: string; pt: string; en: string };
  help?: { es: string; pt: string; en: string };
  options: DxOption[];
  weight: number;
};

export type DxCustomQuestion = {
  id: string;
  prompt: string;
  addedBy?: 'technician';
};

export type DiagnosticAreaRow = {
  questionId: string;
  label: string;
  score: number;
  pillarSlug?: string;
};

export type PillarScoreRow = {
  slug: string;
  name: string;
  score: number;
  answered: number;
  total: number;
};

export type SectorDiagnosticResult = {
  sectorId: string;
  sectorName: string;
  overall: number;
  answered: number;
  totalScored: number;
  weakAreas: DiagnosticAreaRow[];
};

export type FullDiagnosticResult = SectorDiagnosticResult & {
  strengths: DiagnosticAreaRow[];
  weaknesses: DiagnosticAreaRow[];
  potentials: Array<DiagnosticAreaRow & { note?: string }>;
  pillarScores: PillarScoreRow[];
};

const L = (row: { es: string; pt: string; en: string }, locale: DxLocale) => row[locale] || row.es;

const PILLAR_SLUGS = ['strategy', 'finance', 'operations', 'commercial', 'people', 'digital', 'risk'] as const;

/** Prioridade de pilares por setor económico (peso relativo) */
const SECTOR_PILLAR_WEIGHTS: Record<string, Partial<Record<(typeof PILLAR_SLUGS)[number], number>>> = {
  agriculture: { operations: 1.4, commercial: 1.2, finance: 1.1, risk: 1.1 },
  livestock: { operations: 1.4, finance: 1.2, commercial: 1.1, risk: 1.2 },
  food_hospitality: { operations: 1.3, finance: 1.3, commercial: 1.2, people: 1.1 },
  retail_supermarket: { commercial: 1.3, finance: 1.2, operations: 1.2, digital: 1.0 },
  chemical_industry: { operations: 1.3, risk: 1.4, finance: 1.1, people: 1.1 },
  technology: { digital: 1.4, strategy: 1.2, commercial: 1.2, people: 1.1 },
  professional_services: { commercial: 1.3, strategy: 1.2, people: 1.2, finance: 1.1 },
};

export const MATURITY_OPTIONS: DxOption[] = [
  {
    id: 'weak',
    label: { es: 'Muy débil / no existe', pt: 'Muito fraco / não existe', en: 'Very weak / missing' },
    score: 25,
  },
  {
    id: 'partial',
    label: { es: 'Parcial / informal', pt: 'Parcial / informal', en: 'Partial / informal' },
    score: 50,
  },
  {
    id: 'ok',
    label: { es: 'Aceptable / documentado', pt: 'Aceitável / documentado', en: 'Adequate / documented' },
    score: 72,
  },
  {
    id: 'strong',
    label: { es: 'Sólido / medido', pt: 'Sólido / medido', en: 'Strong / measured' },
    score: 92,
  },
];

const UNIVERSAL: Omit<DxQuestion, 'sectorId' | 'section'>[] = [
  {
    id: 'u_model',
    source: 'base',
    section: 'universal',
    prompt: {
      es: 'Claridad del modelo de negocio (qué vende, a quién, cómo cobra)',
      pt: 'Clareza do modelo de negócio (o que vende, a quem, como cobra)',
      en: 'Business model clarity (what, to whom, how you charge)',
    },
    options: MATURITY_OPTIONS,
    weight: 1.2,
  },
  {
    id: 'u_operations',
    source: 'base',
    section: 'universal',
    prompt: {
      es: 'Capacidad operativa semanal (entregar lo prometido)',
      pt: 'Capacidade operacional semanal (entregar o prometido)',
      en: 'Weekly operational capacity (deliver as promised)',
    },
    options: MATURITY_OPTIONS,
    weight: 1.1,
  },
  {
    id: 'u_blocker',
    source: 'base',
    section: 'universal',
    prompt: {
      es: 'Mayor bloqueo actual para crecer',
      pt: 'Maior bloqueio actual para crescer',
      en: 'Biggest current growth blocker',
    },
    options: MATURITY_OPTIONS,
    weight: 1.2,
  },
  {
    id: 'u_cash',
    source: 'base',
    section: 'universal',
    prompt: {
      es: 'Control de caja, márgenes y costes fijos',
      pt: 'Controlo de caixa, margens e custos fixos',
      en: 'Cash, margins and fixed cost control',
    },
    options: MATURITY_OPTIONS,
    weight: 1.15,
  },
  {
    id: 'u_team',
    source: 'base',
    section: 'universal',
    prompt: {
      es: 'Equipo / roles / dependencia del fundador',
      pt: 'Equipa / papéis / dependência do fundador',
      en: 'Team / roles / founder dependency',
    },
    options: MATURITY_OPTIONS,
    weight: 1,
  },
];

function focusPrompt(focus: { es: string; pt: string; en: string }): { es: string; pt: string; en: string } {
  return {
    es: `En su sector — ${focus.es.charAt(0).toLowerCase()}${focus.es.slice(1)}`,
    pt: `No seu setor — ${focus.pt.charAt(0).toLowerCase()}${focus.pt.slice(1)}`,
    en: `In your sector — ${focus.en.charAt(0).toLowerCase()}${focus.en.slice(1)}`,
  };
}

function quizQuestionToDx(q: QuizQuestion, pillar: QuizSector, sectorNorm: string): DxQuestion {
  return {
    id: `p_${pillar.slug}_${q.id}`,
    sectorId: sectorNorm,
    source: 'base',
    section: 'pillar',
    pillarSlug: pillar.slug,
    areaName: q.prompt.slice(0, 80),
    prompt: { es: q.prompt, pt: q.prompt, en: q.prompt },
    help: q.help ? { es: q.help, pt: q.help, en: q.help } : undefined,
    options: q.options.map((o) => ({
      id: o.id,
      label: { es: o.label, pt: o.label, en: o.label },
      score: o.score,
    })),
    weight: q.weight,
  };
}

function rankedPillarsForSector(sectorId: string): QuizSector[] {
  const weights = SECTOR_PILLAR_WEIGHTS[sectorId] || {};
  return [...NEXUS_DIAGNOSTIC_QUIZ].sort((a, b) => {
    const wa = weights[a.slug as (typeof PILLAR_SLUGS)[number]] ?? 1;
    const wb = weights[b.slug as (typeof PILLAR_SLUGS)[number]] ?? 1;
    return wb - wa;
  });
}

function pillarQuestionCap(depth: DiagnosticDepth): number {
  switch (depth) {
    case 'screening':
      return 0;
    case 'standard':
      return 2;
    case 'deep':
      return 4;
    case 'exhaustive':
      return 99;
  }
}

export function listDiagnosticQuestions(
  sectorId: string | null | undefined,
  program?: IncubationProgram | null
): DxQuestion[] {
  const norm = normalizeEconomicSectorId(sectorId) || 'other';
  const depth = program ? depthFromProgram(program) : 'standard';
  const sector = getEconomicSector(norm);

  const universal: DxQuestion[] = UNIVERSAL.map((q) => ({ ...q, sectorId: 'universal' as const }));
  const sectorQs: DxQuestion[] = (sector?.focusAreas || getEconomicSector('other')!.focusAreas).map((area, i) => ({
    id: `${norm}_f${i}`,
    sectorId: norm,
    source: 'base' as const,
    section: 'sector' as const,
    prompt: focusPrompt(area),
    options: MATURITY_OPTIONS,
    weight: 1.05,
  }));

  const perPillar = pillarQuestionCap(depth);
  if (perPillar === 0) return [...universal, ...sectorQs];

  const pillars = rankedPillarsForSector(norm);
  const pillarQs: DxQuestion[] = [];
  const pillarLimit = depth === 'exhaustive' ? pillars.length : Math.min(5, pillars.length);

  for (let pi = 0; pi < pillarLimit; pi++) {
    const pillar = pillars[pi]!;
    const flat = pillar.areas.flatMap((a) => a.questions);
    const take = depth === 'exhaustive' ? flat.length : Math.min(perPillar, flat.length);
    for (let qi = 0; qi < take; qi++) {
      pillarQs.push(quizQuestionToDx(flat[qi]!, pillar, norm));
    }
  }

  return [...universal, ...sectorQs, ...pillarQs];
}

/** @deprecated use listDiagnosticQuestions */
export function listBaseDiagnosticQuestions(sectorId: string | null | undefined): DxQuestion[] {
  return listDiagnosticQuestions(sectorId, null);
}

export function questionLabel(q: DxQuestion, locale: DxLocale): string {
  return L(q.prompt, locale);
}

export function optionLabel(o: DxOption, locale: DxLocale): string {
  return L(o.label, locale);
}

function scoreForAnswer(q: DxQuestion, answerId: string): number | null {
  const opt = q.options.find((o) => o.id === answerId);
  return opt ? opt.score : null;
}

export function computeFullDiagnosticResult(
  sectorId: string | null | undefined,
  questions: DxQuestion[],
  answers: Record<string, string>,
  locale: DxLocale = 'es'
): FullDiagnosticResult {
  const norm = normalizeEconomicSectorId(sectorId) || 'other';
  let weighted = 0;
  let wsum = 0;
  const rows: DiagnosticAreaRow[] = [];

  const pillarAcc = new Map<string, { w: number; ws: number; n: number; total: number; name: string }>();

  for (const q of questions) {
    const score = scoreForAnswer(q, answers[q.id] || '');
    if (score == null) continue;
    weighted += score * q.weight;
    wsum += q.weight;
    const label = questionLabel(q, locale);
    rows.push({
      questionId: q.id,
      label,
      score,
      pillarSlug: q.pillarSlug || (q.section === 'sector' ? 'sector' : q.section === 'universal' ? 'strategy' : undefined),
    });

    const pslug = q.pillarSlug || 'sector';
    const acc = pillarAcc.get(pslug) || { w: 0, ws: 0, n: 0, total: 0, name: pslug };
    acc.w += score * q.weight;
    acc.ws += q.weight;
    acc.n += 1;
    acc.total += 1;
    pillarAcc.set(pslug, acc);
  }

  rows.sort((a, b) => a.score - b.score);

  const strengths = rows.filter((r) => r.score >= 72).slice(-12).reverse();
  const weaknesses = rows.filter((r) => r.score < 55);
  const potentials = rows
    .filter((r) => r.score >= 55 && r.score < 72)
    .slice(0, 12)
    .map((r) => ({
      ...r,
      note:
        locale === 'es'
          ? 'Base aprovechable — subir un nivel con intervención focalizada.'
          : 'Base aproveitável — subir nível com intervenção focada.',
    }));

  const pillarScores: PillarScoreRow[] = [...pillarAcc.entries()].map(([slug, acc]) => {
    const quizPillar = NEXUS_DIAGNOSTIC_QUIZ.find((p) => p.slug === slug);
    return {
      slug,
      name: quizPillar?.name || (slug === 'sector' ? sectorLabel(norm, locale) || 'Sector' : slug),
      score: acc.ws > 0 ? Math.round(acc.w / acc.ws) : 0,
      answered: acc.n,
      total: acc.total,
    };
  });
  pillarScores.sort((a, b) => a.score - b.score);

  return {
    sectorId: norm,
    sectorName: sectorLabel(norm, locale) || norm,
    overall: wsum > 0 ? Math.round(weighted / wsum) : 0,
    answered: rows.length,
    totalScored: questions.length,
    weakAreas: weaknesses.slice(0, 16),
    strengths,
    weaknesses,
    potentials,
    pillarScores,
  };
}

export function computeSectorDiagnosticResult(
  sectorId: string | null | undefined,
  answers: Record<string, string>,
  locale: DxLocale = 'es',
  program?: IncubationProgram | null
): SectorDiagnosticResult {
  const full = computeFullDiagnosticResult(sectorId, listDiagnosticQuestions(sectorId, program), answers, locale);
  return full;
}

export function answersPayloadForAnalyze(
  sectorId: string,
  questions: DxQuestion[],
  answers: Record<string, string>,
  custom: DxCustomQuestion[],
  customAnswers: Record<string, string>,
  locale: DxLocale
): Array<{ id: string; question: string; answer: string; score?: number }> {
  const rows: Array<{ id: string; question: string; answer: string; score?: number }> = [];
  for (const q of questions) {
    const optId = answers[q.id];
    if (!optId) continue;
    const score = scoreForAnswer(q, optId);
    const opt = q.options.find((o) => o.id === optId);
    rows.push({
      id: q.id,
      question: questionLabel(q, locale),
      answer: opt ? optionLabel(opt, locale) : optId,
      score: score ?? undefined,
    });
  }
  for (const cq of custom) {
    const ans = customAnswers[cq.id]?.trim();
    if (!ans) continue;
    rows.push({ id: cq.id, question: cq.prompt, answer: ans });
  }
  return rows;
}

export function listSectorChoices(locale: DxLocale) {
  return NEXUS_ECONOMIC_SECTORS.map((s) => ({
    id: s.id,
    label: L(s.label, locale),
    groupId: s.groupId,
  }));
}

export function sectionLabel(section: DxSection, locale: DxLocale): string {
  const map: Record<DxSection, { es: string; pt: string; en: string }> = {
    universal: { es: 'Base empresa', pt: 'Base empresa', en: 'Business base' },
    sector: { es: 'Sector económico', pt: 'Setor económico', en: 'Economic sector' },
    pillar: { es: 'Pilares de gestión', pt: 'Pilares de gestão', en: 'Management pillars' },
    custom: { es: 'Técnico', pt: 'Técnico', en: 'Technician' },
  };
  return L(map[section], locale);
}
