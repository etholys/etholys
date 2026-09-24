/**
 * Diagnóstico NEXUS — camadas (core → nível → comercial → setor → produção)
 * + matriz profunda opcional em agricultura/agroindústria.
 */

import { inferOfferKind, scoreAtQuads, type AtOfferKind, type AtQuadScore } from './nexus-at-cycle';
import { NEXUS_DIAGNOSTIC_QUIZ } from './nexus-diagnostic-quiz';
import { NEXUS_ECONOMIC_SECTORS, normalizeEconomicSectorId, sectorLabel } from './nexus-economic-sectors';
import {
  depthFromProgram,
  type DiagnosticDepth,
  type IncubationProgram,
} from './nexus-incubation-program';
import { hasDeepSectorMatrix, matrixItemsToDxQuestions } from './nexus-sector-matrices';
import {
  buildLayeredDiagnosticQuestions,
  DX_CORE,
  DX_LEVEL,
  DX_COMMERCIAL,
} from './nexus-diagnostic-layers';

export type DxLocale = 'es' | 'pt' | 'en';

export type DxSection =
  | 'core'
  | 'level'
  | 'commercial'
  | 'sector'
  | 'production'
  | 'universal'
  | 'pillar'
  | 'custom';

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
  multi?: boolean;
  exclusiveOptionId?: string;
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
  section?: string;
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
  /** Visão 360: estruturação · gestão · produção · comercial */
  quads: AtQuadScore[];
  offerKind: AtOfferKind | null;
};

const L = (row: { es: string; pt: string; en: string }, locale: DxLocale) => row[locale] || row.es;

/** @deprecated — prefer opções específicas por pergunta nas camadas */
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

export const GROWTH_BLOCKER_OPTIONS: DxOption[] =
  (DX_CORE.find((q) => q.id === 'core_blockers')?.options as DxOption[]) || [];

export const BUSINESS_SCALE_OPTIONS: DxOption[] =
  (DX_CORE.find((q) => q.id === 'core_scale')?.options as DxOption[]) || [];

function matrixExtraCap(depth: DiagnosticDepth): number {
  switch (depth) {
    case 'screening':
      return 0;
    case 'standard':
      return 0;
    case 'deep':
      return 10;
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

  const layered = buildLayeredDiagnosticQuestions(norm, depth) as DxQuestion[];

  const matrixTake = matrixExtraCap(depth);
  if (matrixTake > 0 && hasDeepSectorMatrix(norm)) {
    const matrixQs = matrixItemsToDxQuestions(norm, depth === 'exhaustive' ? 'exhaustive' : 'deep') as DxQuestion[];
    const extras = matrixQs.slice(0, matrixTake).map((q) => ({
      ...q,
      section: 'production' as const,
    }));
    const seen = new Set(layered.map((q) => q.id));
    for (const q of extras) {
      if (seen.has(q.id)) continue;
      seen.add(q.id);
      layered.push(q);
    }
  }

  return layered;
}

export function listDiagnosticQuestionsForSectors(
  sectorIds: string[] | null | undefined,
  program?: IncubationProgram | null
): DxQuestion[] {
  const ids = [
    ...new Set(
      (sectorIds || [])
        .map((id) => normalizeEconomicSectorId(id))
        .filter(Boolean) as string[]
    ),
  ];
  if (ids.length === 0) return listDiagnosticQuestions(null, program);
  if (ids.length === 1) return listDiagnosticQuestions(ids[0], program);

  const depth = program ? depthFromProgram(program) : 'standard';
  const shared = buildLayeredDiagnosticQuestions(ids[0]!, depth).filter(
    (q) => q.section === 'core' || q.section === 'level' || q.section === 'commercial'
  ) as DxQuestion[];

  const seen = new Set(shared.map((q) => q.id));
  const merged: DxQuestion[] = [...shared];

  for (const sid of ids) {
    for (const q of listDiagnosticQuestions(sid, program)) {
      if (q.section === 'core' || q.section === 'level' || q.section === 'commercial') continue;
      if (seen.has(q.id)) continue;
      seen.add(q.id);
      merged.push(q);
    }
  }
  return merged;
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

export function parseAnswerIds(raw: string | null | undefined): string[] {
  if (!raw?.trim()) return [];
  return [...new Set(raw.split(',').map((s) => s.trim()).filter(Boolean))];
}

export function serializeAnswerIds(ids: string[]): string {
  return [...new Set(ids.map((s) => s.trim()).filter(Boolean))].join(',');
}

export function toggleQuestionAnswer(
  q: DxQuestion,
  currentRaw: string | undefined,
  optionId: string
): string {
  if (!q.multi) return optionId;
  const exclusive = q.exclusiveOptionId;
  let selected = parseAnswerIds(currentRaw);
  const on = selected.includes(optionId);
  if (exclusive && optionId === exclusive) {
    return on ? '' : exclusive;
  }
  selected = selected.filter((id) => id !== exclusive);
  if (on) selected = selected.filter((id) => id !== optionId);
  else selected = [...selected, optionId];
  return serializeAnswerIds(selected);
}

export function isOptionSelected(raw: string | undefined, optionId: string): boolean {
  return parseAnswerIds(raw).includes(optionId);
}

function scoreForAnswer(q: DxQuestion, answerRaw: string): number | null {
  const ids = parseAnswerIds(answerRaw);
  if (ids.length === 0) return null;
  const scores = ids
    .map((id) => q.options.find((o) => o.id === id)?.score)
    .filter((s): s is number => typeof s === 'number');
  if (scores.length === 0) return null;
  return Math.min(...scores);
}

function defaultPillarForSection(section: DxSection): string {
  switch (section) {
    case 'commercial':
      return 'commercial';
    case 'production':
    case 'sector':
      return 'operations';
    case 'level':
      return 'strategy';
    case 'core':
    case 'universal':
      return 'strategy';
    default:
      return 'strategy';
  }
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
    const pillarSlug = q.pillarSlug || defaultPillarForSection(q.section);
    rows.push({
      questionId: q.id,
      label,
      score,
      pillarSlug,
      section: q.section,
    });

    const acc = pillarAcc.get(pillarSlug) || { w: 0, ws: 0, n: 0, total: 0, name: pillarSlug };
    acc.w += score * q.weight;
    acc.ws += q.weight;
    acc.n += 1;
    acc.total += 1;
    pillarAcc.set(pillarSlug, acc);
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
    const sectionNames: Record<string, string> = {
      sector: sectorLabel(norm, locale) || 'Sector',
      operations: locale === 'pt' ? 'Operações' : locale === 'en' ? 'Operations' : 'Operaciones',
      commercial: locale === 'pt' ? 'Comercial' : locale === 'en' ? 'Commercial' : 'Comercial',
      finance: locale === 'pt' ? 'Finanças' : locale === 'en' ? 'Finance' : 'Finanzas',
      strategy: locale === 'pt' ? 'Estratégia' : locale === 'en' ? 'Strategy' : 'Estrategia',
      people: locale === 'pt' ? 'Pessoas' : locale === 'en' ? 'People' : 'Personas',
      digital: 'Digital',
    };
    return {
      slug,
      name: quizPillar?.name || sectionNames[slug] || slug,
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
    quads: scoreAtQuads(rows, locale),
    offerKind: inferOfferKind(answers),
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
    const raw = answers[q.id];
    if (!raw) continue;
    const ids = parseAnswerIds(raw);
    if (ids.length === 0) continue;
    const score = scoreForAnswer(q, raw);
    const labels = ids.map((id) => {
      const opt = q.options.find((o) => o.id === id);
      return opt ? optionLabel(opt, locale) : id;
    });
    rows.push({
      id: q.id,
      question: questionLabel(q, locale),
      answer: labels.join('; '),
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
    core: { es: '1 · Cualquier negocio', pt: '1 · Qualquer negócio', en: '1 · Any business' },
    level: { es: '2 · Nivel general', pt: '2 · Nível geral', en: '2 · General level' },
    commercial: { es: '3 · Comercialización', pt: '3 · Comercialização', en: '3 · Commercialization' },
    sector: { es: '4 · Sector específico', pt: '4 · Setor específico', en: '4 · Sector-specific' },
    production: {
      es: '5 · Producción / agroindustria',
      pt: '5 · Produção / agroindústria',
      en: '5 · Production / agro-industry',
    },
    universal: { es: 'Base empresa', pt: 'Base empresa', en: 'Business base' },
    pillar: { es: 'Pilares de gestión', pt: 'Pilares de gestão', en: 'Management pillars' },
    custom: { es: 'Técnico', pt: 'Técnico', en: 'Technician' },
  };
  return L(map[section], locale);
}

export function layeredQuestionCounts() {
  return {
    core: DX_CORE.length,
    level: DX_LEVEL.length,
    commercial: DX_COMMERCIAL.length,
  };
}
