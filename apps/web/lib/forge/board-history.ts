import {
  createMultiplayerInitialState,
  parseMulti,
  syncLegacyFields,
} from '@/lib/forge/expedicion-board-multi';
import type { GameSpecV1 } from '@/lib/forge/schemas/game-spec-v1';

export const MAX_BOARD_HISTORY = 25;

type BoardSnapshot = Record<string, unknown>;

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

export function getHistoryStack(state: Record<string, unknown>): BoardSnapshot[] {
  return Array.isArray(state.historyStack) ? (state.historyStack as BoardSnapshot[]) : [];
}

/** Guarda snapshot antes de uma jogada (sem aninhar historyStack). */
export function pushBoardHistory(state: Record<string, unknown>): Record<string, unknown> {
  const { historyStack: _h, ...rest } = state;
  const stack = getHistoryStack(state);
  stack.push(clone(rest));
  while (stack.length > MAX_BOARD_HISTORY) stack.shift();
  return { ...state, historyStack: stack };
}

export function undoBoardState(state: Record<string, unknown>): {
  state: Record<string, unknown>;
  ok: boolean;
} {
  const stack = getHistoryStack(state);
  if (stack.length === 0) return { state, ok: false };
  const prev = stack.pop()!;
  return { state: { ...clone(prev), historyStack: stack }, ok: true };
}

export function restartBoardState(
  state: Record<string, unknown>,
  spec: GameSpecV1
): Record<string, unknown> {
  const multi = parseMulti(state);
  if (multi) {
    const roster = multi.players.map((p) => ({
      ...p,
      position: spec.board?.startSpace ?? 0,
      ecoCredits: 500,
      impactPoints: 0,
      insights: [],
    }));
    const fresh = createMultiplayerInitialState(roster, spec);
    return { ...fresh, historyStack: [] };
  }
  const start = spec.board?.startSpace ?? 0;
  return {
    position: start,
    turn: 0,
    insights: [],
    ecoCredits: 500,
    impactPoints: 0,
    finished: false,
    currentCard: null,
    historyStack: [],
  };
}

export function clearCurrentCard(state: Record<string, unknown>): Record<string, unknown> {
  const multi = parseMulti(state);
  if (multi) {
    return syncLegacyFields({ ...multi, currentCard: null }) as Record<string, unknown>;
  }
  return { ...state, currentCard: null };
}

export function historyCount(state: Record<string, unknown>): number {
  return getHistoryStack(state).length;
}
