import { createEmptyConstructionMap } from '@/lib/forge/expedicion-v2/construction-map';
import { createInitialLedger } from '@/lib/forge/expedicion-v2/ledger';
import type { ExpedicionV2PlayerState } from '@/lib/forge/expedicion-v2/types';
import { MAX_GAME_CYCLES } from '@/lib/forge/expedicion-v2/types';
import { parseConstructionMap } from '@/lib/forge/expedicion-v2/construction-map';
import { parseLedger } from '@/lib/forge/expedicion-v2/ledger';
import { normalizeV2State } from '@/lib/forge/expedicion-v2/normalize-v2';

export function createInitialV2State(): ExpedicionV2PlayerState {
  return {
    phase: 'lobby',
    quizGate: null,
    cyclesCompleted: 0,
    maxCycles: MAX_GAME_CYCLES,
    constructionMap: createEmptyConstructionMap(),
    ledger: createInitialLedger(),
    impactPoints: 0,
  };
}

export function parseV2State(raw: unknown): ExpedicionV2PlayerState {
  if (!raw || typeof raw !== 'object') return createInitialV2State();
  const o = raw as Partial<ExpedicionV2PlayerState>;
  const phase = o.phase ?? 'lobby';
  const validPhases = ['lobby', 'playing', 'post_quiz', 'finished', 'pre_quiz'] as const;
  const parsed: ExpedicionV2PlayerState = {
    phase:
      validPhases.includes(phase as (typeof validPhases)[number])
        ? (phase as ExpedicionV2PlayerState['phase'])
        : 'lobby',
    quizGate: o.quizGate === 'pre' || o.quizGate === 'post' ? o.quizGate : null,
    cyclesCompleted: typeof o.cyclesCompleted === 'number' ? o.cyclesCompleted : 0,
    maxCycles: typeof o.maxCycles === 'number' ? o.maxCycles : MAX_GAME_CYCLES,
    constructionMap: parseConstructionMap(o.constructionMap),
    ledger: parseLedger(o.ledger),
    preQuizAnswers: o.preQuizAnswers,
    postQuizAnswers: o.postQuizAnswers,
    preQuizCompletedAt: o.preQuizCompletedAt,
    postQuizCompletedAt: o.postQuizCompletedAt,
    finalScore: o.finalScore,
    finalScoreBreakdown: o.finalScoreBreakdown,
    benefits: o.benefits as ExpedicionV2PlayerState['benefits'],
    pendingMicroCaso: o.pendingMicroCaso as ExpedicionV2PlayerState['pendingMicroCaso'],
    completedMicroCasos: Array.isArray(o.completedMicroCasos)
      ? (o.completedMicroCasos as string[])
      : undefined,
    pendingFeriaPitch: o.pendingFeriaPitch as ExpedicionV2PlayerState['pendingFeriaPitch'],
    feriaAwarded: o.feriaAwarded === true,
    impactPoints: typeof o.impactPoints === 'number' ? o.impactPoints : 0,
    peerCredits: o.peerCredits as ExpedicionV2PlayerState['peerCredits'],
  };
  return normalizeV2State(parsed).v2;
}

export function v2FromJourneyMapState(mapState: Record<string, unknown>): ExpedicionV2PlayerState {
  if (mapState.v2) return parseV2State(mapState.v2);
  return createInitialV2State();
}

export function mergeV2IntoMapState(
  mapState: Record<string, unknown>,
  v2: ExpedicionV2PlayerState
): Record<string, unknown> {
  return { ...mapState, v2 };
}
