import {
  createInitialV2State,
  parseV2State,
} from '@/lib/forge/expedicion-v2/player-state';
import type { ExpedicionV2PlayerState } from '@/lib/forge/expedicion-v2/types';

export const V2_TEAM_KEY = 'v2Team';

export function v2FromRoomState(roomState: Record<string, unknown>): ExpedicionV2PlayerState {
  if (roomState[V2_TEAM_KEY]) return parseV2State(roomState[V2_TEAM_KEY]);
  return createInitialV2State();
}

export function mergeV2IntoRoomState(
  roomState: Record<string, unknown>,
  v2: ExpedicionV2PlayerState
): Record<string, unknown> {
  return { ...roomState, [V2_TEAM_KEY]: v2 };
}

export function v2TeamSummary(v2: ExpedicionV2PlayerState) {
  return {
    phase: v2.phase,
    cyclesCompleted: v2.cyclesCompleted,
    maxCycles: v2.maxCycles,
    balance: v2.ledger.balance,
    postItCount: v2.constructionMap.postIts.length,
    connectionCount: v2.constructionMap.connections.length,
    finalScore: v2.finalScore,
    impactPoints: v2.impactPoints ?? 0,
    hasPendingMicroCaso: Boolean(v2.pendingMicroCaso),
    hasPendingFeriaPitch: Boolean(v2.pendingFeriaPitch),
    feriaAwarded: Boolean(v2.feriaAwarded),
    peerCreditsTotal: Object.values(v2.peerCredits ?? {}).reduce((a, b) => a + b, 0),
  };
}
