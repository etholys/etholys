import { llmGenerateContent } from './llm-client';
import type { DxLocale, DxQuestion } from './nexus-sector-diagnostic';
import {
  computeFullDiagnosticResult,
  type FullDiagnosticResult,
  listDiagnosticQuestions,
} from './nexus-sector-diagnostic';
import type { IncubationProgram } from './nexus-incubation-program';

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
};

function truncate(s: string, max: number): string {
  const t = s.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1).trim()}…`;
}

/** Deterministic analysis (no LLM) — exported for tests. */
export function fallbackAnalyze(input: DiagnosticAnalyzeInput): DiagnosticAnalyzeResult {
  const answerIds = input.answerIds || buildAnswerIdsFromPayload(input.answers);
  const questions = listDiagnosticQuestions(input.sectorId, input.program);
  const computed = computeFullDiagnosticResult(input.sectorId, questions, answerIds, input.locale);
  const weak = computed.weaknesses.map((w) => w.label);

  const summary =
    input.locale === 'es'
      ? `Score ${computed.overall}/100 en ${computed.sectorName}. Priorizar: ${weak.slice(0, 2).join(' · ') || 'consolidar operación'}.`
      : input.locale === 'pt'
        ? `Score ${computed.overall}/100 em ${computed.sectorName}. Priorizar: ${weak.slice(0, 2).join(' · ') || 'consolidar operação'}.`
        : `Score ${computed.overall}/100 in ${computed.sectorName}. Prioritize: ${weak.slice(0, 2).join(' · ') || 'core operations'}.`;

  const needsExtension =
    !input.finalize && computed.overall < 62 && computed.weaknesses.length >= 3 && input.answers.length < 35;

  return {
    summary: truncate(summary, 280),
    priorities: weak.slice(0, 12),
    needsExtension,
    extensionQuestions: needsExtension
      ? computed.weaknesses.slice(0, 3).map((w, i) => ({
          id: `ext_${i}`,
          prompt:
            input.locale === 'es'
              ? `¿Qué impide mejorar: ${w.label.slice(0, 90)}?`
              : input.locale === 'pt'
                ? `O que impede melhorar: ${w.label.slice(0, 90)}?`
                : `What blocks improvement on: ${w.label.slice(0, 90)}?`,
        }))
      : [],
    computed,
    strengths: computed.strengths,
    weaknesses: computed.weaknesses,
    potentials: computed.potentials,
    pillarScores: computed.pillarScores,
    aiUsed: false,
  };
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
- extensionQuestions: SOLO si faltan datos críticos tras las respuestas. MÁXIMO 2 preguntas. Cada prompt MÁXIMO 100 caracteres.
- Si finalize=true O las respuestas son suficientes: needsExtension=false y extensionQuestions=[].
- NO repitas preguntas ya respondidas. NO escribas párrafos largos.

Schema:
{"summary":"...","priorities":["..."],"needsExtension":false,"extensionQuestions":[{"id":"ext_0","prompt":"...","help":"..."}]}`;

  const user = JSON.stringify({
    sectorId: input.sectorId,
    finalize: input.finalize ?? false,
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

    return {
      summary: truncate(String(parsed.summary), 280),
      priorities: (parsed.priorities || computed.weaknesses.map((w) => w.label))
        .slice(0, 12)
        .map((p) => truncate(String(p), 80)),
      needsExtension: input.finalize ? false : Boolean(parsed.needsExtension),
      extensionQuestions: input.finalize
        ? []
        : (parsed.extensionQuestions || [])
            .slice(0, 3)
            .map((q, i) => ({
              id: String(q.id || `ext_${i}`),
              prompt: truncate(String(q.prompt || ''), 120),
              help: q.help ? truncate(String(q.help), 80) : undefined,
            }))
            .filter((q) => q.prompt.length >= 8),
      computed,
      strengths: computed.strengths,
      weaknesses: computed.weaknesses,
      potentials: computed.potentials,
      pillarScores: computed.pillarScores,
      aiUsed: true,
    };
  } catch {
    return fallback;
  }
}
