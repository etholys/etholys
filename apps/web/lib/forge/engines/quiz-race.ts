import type { GameSpecV1 } from '@/lib/forge/schemas/game-spec-v1';
import type { ForgeEngine, GameAction, GameEvent, GameState } from '@/lib/forge/engines/types';

type QuizState = {
  index: number;
  correct: number;
  streak: number;
  answers: number[];
  finished: boolean;
};

function asQuizState(state: GameState): QuizState {
  const s = state as Partial<QuizState>;
  return {
    index: typeof s.index === 'number' ? s.index : 0,
    correct: typeof s.correct === 'number' ? s.correct : 0,
    streak: typeof s.streak === 'number' ? s.streak : 0,
    answers: Array.isArray(s.answers) ? (s.answers as number[]) : [],
    finished: Boolean(s.finished),
  };
}

export const quizRaceEngine: ForgeEngine = {
  engine: 'quiz_race',

  validateSpec(spec: GameSpecV1): GameSpecV1 {
    if (!spec.questions?.length) {
      throw new Error('Motor quiz_race requer questions[]');
    }
    return spec;
  },

  createInitialState(_spec: GameSpecV1): GameState {
    return { index: 0, correct: 0, streak: 0, answers: [], finished: false } satisfies QuizState;
  },

  applyAction(state: GameState, action: GameAction, spec: GameSpecV1): { state: GameState; events: GameEvent[] } {
    const s = asQuizState(state);
    const events: GameEvent[] = [];
    const questions = spec.questions ?? [];

    if (s.finished) {
      return { state: s, events: [{ type: 'already_finished' }] };
    }

    if (action.type === 'answer') {
      const chosen = typeof action.payload?.index === 'number' ? action.payload.index : -1;
      const q = questions[s.index];
      if (!q) {
        s.finished = true;
        return { state: s, events: [{ type: 'done' }] };
      }

      const ok = chosen === q.correctIndex;
      s.answers.push(chosen);
      if (ok) {
        s.correct += 1;
        s.streak += 1;
        events.push({
          type: 'correct',
          message: q.explanation ?? 'Correto!',
          xp: 10 + s.streak * 2,
        });
      } else {
        s.streak = 0;
        events.push({
          type: 'incorrect',
          message: q.explanation ?? 'Incorreto. Tente na próxima.',
        });
      }

      s.index += 1;
      if (s.index >= questions.length) {
        s.finished = true;
        events.push({ type: 'quiz_complete', message: 'Quiz concluído.' });
      }
      return { state: s, events };
    }

    return { state: s, events: [{ type: 'error', message: `Ação desconhecida: ${action.type}` }] };
  },

  isComplete(state: GameState, spec: GameSpecV1): boolean {
    const s = asQuizState(state);
    return s.finished || s.index >= (spec.questions?.length ?? 0);
  },

  computeScore(state: GameState, spec: GameSpecV1): number {
    const s = asQuizState(state);
    const total = spec.questions?.length ?? 1;
    return Math.min(1, s.correct / total);
  },
};
