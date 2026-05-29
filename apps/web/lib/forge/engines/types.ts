import type { GameSpecV1 } from '@/lib/forge/schemas/game-spec-v1';

export type GameState = Record<string, unknown>;

export type GameAction = {
  type: string;
  payload?: Record<string, unknown>;
};

export type GameEvent = {
  type: string;
  message?: string;
  xp?: number;
};

export interface ForgeEngine {
  engine: string;
  validateSpec(spec: GameSpecV1): GameSpecV1;
  createInitialState(spec: GameSpecV1): GameState;
  applyAction(
    state: GameState,
    action: GameAction,
    spec: GameSpecV1
  ): { state: GameState; events: GameEvent[] };
  isComplete(state: GameState, spec: GameSpecV1): boolean;
  computeScore(state: GameState, spec: GameSpecV1): number;
}
