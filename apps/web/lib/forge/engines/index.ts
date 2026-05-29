import type { GameSpecV1 } from '@/lib/forge/schemas/game-spec-v1';
import { boardEngine } from '@/lib/forge/engines/board';
import { quizRaceEngine } from '@/lib/forge/engines/quiz-race';
import { cardsEngine } from '@/lib/forge/engines/cards';
import { branchingEngine } from '@/lib/forge/engines/branching';
import type { ForgeEngine } from '@/lib/forge/engines/types';

const ENGINES: Record<string, ForgeEngine> = {
  board: boardEngine,
  quiz_race: quizRaceEngine,
  cards: cardsEngine,
  branching: branchingEngine,
};

export function getForgeEngine(engine: string): ForgeEngine {
  const e = ENGINES[engine];
  if (!e) throw new Error(`Motor de jogo não implementado: ${engine}`);
  return e;
}

export function validateAndPrepareSpec(spec: GameSpecV1): GameSpecV1 {
  const engine = getForgeEngine(spec.engine);
  return engine.validateSpec(spec);
}

export { ENGINES };
