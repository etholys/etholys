import { createEmptyConstructionMap } from '@/lib/forge/expedicion-v2/construction-map';
import { createInitialLedger } from '@/lib/forge/expedicion-v2/ledger';
import type { ExpedicionV2PlayerState } from '@/lib/forge/expedicion-v2/types';
import { MAX_GAME_CYCLES } from '@/lib/forge/expedicion-v2/types';
import { parseConstructionMap } from '@/lib/forge/expedicion-v2/construction-map';
import { parseLedger } from '@/lib/forge/expedicion-v2/ledger';

export function createInitialV2State(): ExpedicionV2PlayerState {
  return {
    phase: 'pre_quiz',
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
  const phase = o.phase ?? 'pre_quiz';
  return {
    phase:
      phase === 'playing' || phase === 'post_quiz' || phase === 'finished' ? phase : 'pre_quiz',
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
