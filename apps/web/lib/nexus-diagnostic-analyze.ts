import { llmGenerateContent } from './llm-client';
import type { DxLocale, DxQuestion } from './nexus-sector-diagnostic';
import {
  computeFullDiagnosticResult,
  type FullDiagnosticResult,
  listDiagnosticQuestions,
} from './nexus-sector-diagnostic';
import type { IncubationProgram } from './nexus-incubation-program';
import type { VentureStageId } from './nexus-venture';
import {
  buildInterventionNarrative,
  buildStrategicDraft,
  buildTechnicalBrief,
  type InterventionNarrative,
  type StrategicDraft,
  type TechnicalBrief,
} from './nexus-diagnostic-brief';

export type DiagnosticAnalyzeInput = {
  sectorId: string;
  locale: DxLocale;
  answers: Array<{ id: string; question: string; answer: string; score?: number }>;
  finalize?: boolean;
  program?: IncubationProgram | null;
  answerIds?: Record<string, string>;
};

export type DiagnosticExtensionQuestion = {
  id: string;
  prompt: string;
  help?: string;
};

export type DiagnosticAnalyzeResult = {
  summary: string;
  priorities: string[];
  needsExtension: boolean;
  extensionQuestions: DiagnosticExtensionQuestion[];
  computed: FullDiagnosticResult;
  strengths: FullDiagnosticResult['strengths'];
  weaknesses: FullDiagnosticResult['weaknesses'];
  potentials: FullDiagnosticResult['potentials'];
  pillarScores: FullDiagnosticResult['pillarScores'];
  aiUsed: boolean;
  /** Fase da jornada inferida — não escolhida pelo utilizador */
  inferredStage: VentureStageId;
  technicalBrief: TechnicalBrief;
  intervention: InterventionNarrative;
  strategicDraft: StrategicDraft;
};

function truncate(s: string, max: number): string {
  const t = s.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1).trim()}…`;
}

function isEarlyVenture(answerIds?: Record<string, string>): boolean {
  const stage = answerIds?.core_stage;
  return stage === 'idea' || stage === 'surviving';
}

function attachBrief(
  base: Omit<DiagnosticAnalyzeResult, 'inferredStage' | 'technicalBrief' | 'intervention' | 'strategicDraft'>,
  sectorId: string,
  answerIds: Record<string, string>,
  locale: DxLocale
): DiagnosticAnalyzeResult {
  const technicalBrief = buildTechnicalBrief(sectorId, base.computed, answerIds, locale);
  const intervention = buildInterventionNarrative(technicalBrief, locale);
  const strategicDraft = buildStrategicDraft(technicalBrief, locale);
  return {
    ...base,
    inferredStage: technicalBrief.inferredStage,
    technicalBrief,
    intervention,
    strategicDraft,
  };
}

/** Deterministic analysis (no LLM) — exported for tests. */
export function fallbackAnalyze(input: DiagnosticAnalyzeInput): DiagnosticAnalyzeResult {
  const answerIds = input.answerIds || buildAnswerIdsFromPayload(input.answers);
  const questions = listDiagnosticQuestions(input.sectorId, input.program);
  const computed = computeFullDiagnosticResult(input.sectorId, questions, answerIds, input.locale);
  const weak = computed.weaknesses.map((w) => w.label);
  const early = isEarlyVenture(answerIds);

  const summary =
    early
      ? input.locale === 'es'
        ? `Score ${computed.overall}/100 en ${computed.sectorName} (fase de arranque). Priorizar bases: ${weak.slice(0, 2).join(' · ') || 'modelo, caja y primeros clientes'}.`
        : input.locale === 'pt'
          ? `Score ${computed.overall}/100 em ${computed.sectorName} (fase de arranque). Priorizar bases: ${weak.slice(0, 2).join(' · ') || 'modelo, caixa e primeiros clientes'}.`
          : `Score ${computed.overall}/100 in ${computed.sectorName} (startup phase). Prioritize basics: ${weak.slice(0, 2).join(' · ') || 'model, cash and first customers'}.`
      : input.locale === 'es'
        ? `Score ${computed.overall}/100 en ${computed.sectorName}. Priorizar: ${weak.slice(0, 2).join(' · ') || 'consolidar operación'}.`
        : input.locale === 'pt'
          ? `Score ${computed.overall}/100 em ${computed.sectorName}. Priorizar: ${weak.slice(0, 2).join(' · ') || 'consolidar operação'}.`
          : `Score ${computed.overall}/100 in ${computed.sectorName}. Prioritize: ${weak.slice(0, 2).join(' · ') || 'core operations'}.`;

  /** Extensão subjetiva («por qué no hace X») añade poco y castiga arranques — desligada no fallback. */
  const needsExtension = false;

  return attachBrief(
    {
      summary: truncate(summary, 280),
      priorities: weak.slice(0, 12),
      needsExtension,
      extensionQuestions: [],
      computed,
      strengths: computed.strengths,
      weaknesses: computed.weaknesses,
      potentials: computed.potentials,
      pillarScores: computed.pillarScores,
      aiUsed: false,
    },
    input.sectorId,
    answerIds,
    input.locale
  );
}

function buildAnswerIdsFromPayload(
  answers: DiagnosticAnalyzeInput['answers']
): Record<string, string> {
  const map: Record<string, string> = {};
  for (const row of answers) {
    if (row.score == null) continue;
    const opt =
      row.score >= 85 ? 'strong' : row.score >= 68 ? 'ok' : row.score >= 45 ? 'partial' : 'weak';
    if (row.id.startsWith('p_')) {
      map[row.id] = row.score >= 85 ? 'l4' : row.score >= 68 ? 'l3' : row.score >= 45 ? 'l2' : 'l1';
    } else {
      map[row.id] = opt;
    }
  }
  return map;
}

function parseAnalyzeJson(raw: string): Partial<DiagnosticAnalyzeResult> | null {
  const m = raw.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    return JSON.parse(m[0]) as Partial<DiagnosticAnalyzeResult>;
  } catch {
    return null;
  }
}

export async function analyzeSectorDiagnostic(input: DiagnosticAnalyzeInput): Promise<DiagnosticAnalyzeResult> {
  const fallback = fallbackAnalyze(input);

  if (process.env.LLM_DISABLED === '1' || !process.env.ANTHROPIC_API_KEY) {
    return fallback;
  }

  const lang =
    input.locale === 'es' ? 'español' : input.locale === 'pt' ? 'português' : 'English';

  const system = `Analista de diagnóstico MIPYME por sector económico. Responde SOLO JSON válido, sin markdown.
Idioma de salida: ${lang}.
REGRAS ESTRICTAS:
- summary: MÁXIMO 240 caracteres, 2 frases.
- priorities: MÁXIMO 12 strings, cada una MÁXIMO 80 caracteres.
- Si el negocio está en arranque / nuevo modelo: NO asumas procesos ya existentes; habla de bases a construir.
- needsExtension: casi siempre false. Solo true si falta UN dato factual crítico (número, canal, permiso). NUNCA preguntes «por qué no hace X».
- Máximo 1 extensionQuestion si needsExtension=true. Prompt MÁXIMO 100 caracteres.
- Si finalize=true O ya hay ≥12 respuestas: needsExtension=false y extensionQuestions=[].

Schema:
{"summary":"...","priorities":["..."],"needsExtension":false,"extensionQuestions":[]} `;

  const user = JSON.stringify({
    sectorId: input.sectorId,
    finalize: input.finalize ?? false,
    earlyVenture: isEarlyVenture(input.answerIds),
    answers: input.answers,
    deterministicScore: fallback.computed.overall,
  });

  try {
    const out = await llmGenerateContent({
      systemInstruction: system,
      userText: user,
      maxOutputTokens: 512,
      temperature: 0.2,
      responseMimeType: 'application/json',
    });
    const parsed = parseAnalyzeJson(out.text || '');
    if (!parsed?.summary) return fallback;

    const answerIds = input.answerIds || buildAnswerIdsFromPayload(input.answers);
    const questions = listDiagnosticQuestions(input.sectorId, input.program);
    const computed = computeFullDiagnosticResult(input.sectorId, questions, answerIds, input.locale);

    const early = isEarlyVenture(answerIds);
    const allowExt =
      !input.finalize &&
      !early &&
      input.answers.length < 12 &&
      Boolean(parsed.needsExtension);

    return attachBrief(
      {
        summary: truncate(String(parsed.summary), 280),
        priorities: (parsed.priorities || computed.weaknesses.map((w) => w.label))
          .slice(0, 12)
          .map((p) => truncate(String(p), 80)),
        needsExtension: allowExt,
        extensionQuestions: allowExt
          ? (parsed.extensionQuestions || [])
              .slice(0, 1)
              .map((q, i) => ({
                id: String(q.id || `ext_${i}`),
                prompt: truncate(String(q.prompt || ''), 120),
                help: q.help ? truncate(String(q.help), 80) : undefined,
              }))
              .filter((q) => q.prompt.length >= 8)
          : [],
        computed,
        strengths: computed.strengths,
        weaknesses: computed.weaknesses,
        potentials: computed.potentials,
        pillarScores: computed.pillarScores,
        aiUsed: true,
      },
      input.sectorId,
      answerIds,
      input.locale
    );
  } catch {
    return fallback;
  }
}
