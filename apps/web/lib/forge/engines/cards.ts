import type { GameSpecV1 } from '@/lib/forge/schemas/game-spec-v1';
import type { ForgeEngine, GameAction, GameEvent, GameState } from '@/lib/forge/engines/types';

type CardsState = {
  hand: string[];
  played: string[];
  reflections: string[];
  finished: boolean;
};

function asState(state: GameState): CardsState {
  const s = state as Partial<CardsState>;
  return {
    hand: Array.isArray(s.hand) ? (s.hand as string[]) : [],
    played: Array.isArray(s.played) ? (s.played as string[]) : [],
    reflections: Array.isArray(s.reflections) ? (s.reflections as string[]) : [],
    finished: Boolean(s.finished),
  };
}

export const cardsEngine: ForgeEngine = {
  engine: 'cards',

  validateSpec(spec: GameSpecV1): GameSpecV1 {
    if (!spec.cards?.length) throw new Error('Motor cards requer cards[]');
    return spec;
  },

  createInitialState(spec: GameSpecV1): GameState {
    const ids = (spec.cards ?? []).map((c) => c.id);
    const hand = ids.slice(0, Math.min(3, ids.length));
    return { hand, played: [], reflections: [], finished: false } satisfies CardsState;
  },

  applyAction(state: GameState, action: GameAction, spec: GameSpecV1): { state: GameState; events: GameEvent[] } {
    const s = asState(state);
    const events: GameEvent[] = [];
    const minPlays = spec.rules?.minInsights ?? 2;

    if (s.finished) return { state: s, events: [{ type: 'already_finished' }] };

    if (action.type === 'play_card') {
      const cardId = typeof action.payload?.cardId === 'string' ? action.payload.cardId : '';
      if (!s.hand.includes(cardId)) {
        return { state: s, events: [{ type: 'error', message: 'Carta não está na mão.' }] };
      }
      const card = spec.cards?.find((c) => c.id === cardId);
      s.hand = s.hand.filter((id) => id !== cardId);
      s.played.push(cardId);
      events.push({ type: 'card_played', message: card?.prompt, xp: card?.xp });

      const pool = (spec.cards ?? []).map((c) => c.id).filter((id) => !s.hand.includes(id) && !s.played.includes(id));
      if (pool.length && s.hand.length < 3) {
        s.hand.push(pool[Math.floor(Math.random() * pool.length)]);
      }

      if (s.played.length >= minPlays) {
        s.finished = true;
        events.push({ type: 'win', message: 'Mão concluída.' });
      }
      return { state: s, events };
    }

    if (action.type === 'record_reflection') {
      const text = typeof action.payload?.text === 'string' ? action.payload.text.trim() : '';
      if (!text) return { state: s, events: [{ type: 'error', message: 'Reflexão vazia.' }] };
      s.reflections.push(text.slice(0, 2000));
      events.push({ type: 'reflection', xp: 20 });
      if (s.played.length >= minPlays && s.reflections.length >= 1) {
        s.finished = true;
        events.push({ type: 'win' });
      }
      return { state: s, events };
    }

    return { state: s, events: [{ type: 'error', message: `Ação: ${action.type}` }] };
  },

  isComplete(state: GameState, spec: GameSpecV1): boolean {
    const s = asState(state);
    const min = spec.rules?.minInsights ?? 2;
    return s.finished || s.played.length >= min;
  },

  computeScore(state: GameState, spec: GameSpecV1): number {
    const s = asState(state);
    const min = spec.rules?.minInsights ?? 2;
    return Math.min(1, s.played.length / min);
  },
};
