import type { GameSpecV1 } from '@/lib/forge/schemas/game-spec-v1';
import type { ForgeEngine, GameAction, GameEvent, GameState } from '@/lib/forge/engines/types';

type CurrentCard = { id: string; prompt: string; reflection?: string; xp?: number; type?: string };

type BoardState = {
  position: number;
  turn: number;
  insights: string[];
  ecoCredits: number;
  impactPoints: number;
  lastRoll?: number;
  finished: boolean;
  currentCard?: CurrentCard | null;
};

function asBoardState(state: GameState): BoardState {
  const s = state as Partial<BoardState>;
  return {
    position: typeof s.position === 'number' ? s.position : 0,
    turn: typeof s.turn === 'number' ? s.turn : 0,
    insights: Array.isArray(s.insights) ? (s.insights as string[]) : [],
    ecoCredits: typeof s.ecoCredits === 'number' ? s.ecoCredits : 500,
    impactPoints: typeof s.impactPoints === 'number' ? s.impactPoints : 0,
    lastRoll: typeof s.lastRoll === 'number' ? s.lastRoll : undefined,
    finished: Boolean(s.finished),
    currentCard: s.currentCard ?? null,
  };
}

function checkWin(s: BoardState, spec: GameSpecV1): BoardState {
  const goal = spec.board?.goalSpace ?? (spec.board?.spaces ?? 24) - 1;
  const minInsights = spec.rules?.minInsights ?? 8;
  if (!s.finished && s.position >= goal && s.insights.length >= minInsights) {
    s.finished = true;
  }
  return s;
}

export const boardEngine: ForgeEngine = {
  engine: 'board',

  validateSpec(spec: GameSpecV1): GameSpecV1 {
    const spaces = spec.board?.spaces ?? 24;
    if (!spec.board) {
      spec = {
        ...spec,
        board: { spaces, loops: true, startSpace: 0, goalSpace: spaces - 1 },
      };
    }
    if (!spec.cards?.length) {
      throw new Error('Motor board requer pelo menos um cartão em cards[]');
    }
    return spec;
  },

  createInitialState(spec: GameSpecV1): GameState {
    const start = spec.board?.startSpace ?? 0;
    return {
      position: start,
      turn: 0,
      insights: [],
      ecoCredits: 500,
      impactPoints: 0,
      finished: false,
      currentCard: null,
    } satisfies BoardState;
  },

  applyAction(state: GameState, action: GameAction, spec: GameSpecV1): { state: GameState; events: GameEvent[] } {
    let s = asBoardState(state);
    const events: GameEvent[] = [];
    const goal = spec.board?.goalSpace ?? (spec.board?.spaces ?? 24) - 1;
    const maxTurns = spec.rules?.maxTurns ?? 30;
    const spaces = spec.board?.spaces ?? 20;

    if (s.finished) {
      return { state: s, events: [{ type: 'already_finished', message: 'Partida ya concluida.' }] };
    }

    if (action.type === 'roll_dice') {
      if (s.currentCard) {
        return { state: s, events: [{ type: 'error', message: 'Completa la carta actual antes de avanzar.' }] };
      }
      const sides = spec.rules?.diceSides ?? 6;
      const roll = Math.floor(Math.random() * sides) + 1;
      s.turn += 1;
      s.lastRoll = roll;
      let next = s.position + roll;
      if (spec.board?.loops && next > goal) {
        next = next % spaces;
      } else {
        next = Math.min(goal, next);
      }
      s.position = next;
      events.push({ type: 'rolled', message: `Dado: ${roll}. Casilla ${s.position}.` });

      if (s.turn >= maxTurns) {
        s.finished = true;
        events.push({ type: 'max_turns', message: 'Turnos agotados.' });
      }
      s = checkWin(s, spec);
      return { state: s, events };
    }

    if (action.type === 'draw_card') {
      const cards = spec.cards ?? [];
      const idx = Math.floor(Math.random() * cards.length);
      const card = cards[idx];
      s.currentCard = {
        id: card.id,
        prompt: card.prompt,
        reflection: card.reflection,
        xp: card.xp,
        type: card.type,
      };
      if (card.type === 'penalty' || card.prompt.toLowerCase().includes('pag')) {
        s.ecoCredits = Math.max(0, s.ecoCredits - 100);
        events.push({ type: 'penalty', message: `Desafío: -100 Eco-Créditos. ${card.prompt}` });
      } else if (card.type === 'bonus') {
        s.ecoCredits += card.xp ?? 50;
        events.push({ type: 'bonus', message: `Bono: +${card.xp ?? 50} Eco-Créditos.` });
      } else {
        events.push({ type: 'card', message: card.prompt, xp: card.xp });
      }
      return { state: s, events };
    }

    if (action.type === 'complete_card' || action.type === 'record_insight') {
      const text = typeof action.payload?.text === 'string' ? action.payload.text.trim() : '';
      if (!text || text.length < 8) {
        return { state: s, events: [{ type: 'error', message: 'Escribe al menos 8 caracteres de respuesta.' }] };
      }
      s.insights.push(text.slice(0, 2000));
      s.impactPoints += 1;
      s.ecoCredits += 100;
      const xp = spec.scoring?.xpPerInsight ?? 40;
      events.push({
        type: 'validated',
        message: `¡Ficha validada! +100 Eco-Créditos · +1 Impacto`,
        xp,
      });
      s.currentCard = null;
      s = checkWin(s, spec);
      if (s.finished) {
        events.push({ type: 'win', message: '¡Expedición completada!' });
      }
      return { state: s, events };
    }

    if (action.type === 'skip_card') {
      s.ecoCredits = Math.max(0, s.ecoCredits - 50);
      s.currentCard = null;
      events.push({ type: 'skip', message: 'Carta corregida más tarde: -50 Eco-Créditos.' });
      return { state: s, events };
    }

    return { state: s, events: [{ type: 'error', message: `Acción desconocida: ${action.type}` }] };
  },

  isComplete(state: GameState, spec: GameSpecV1): boolean {
    const s = asBoardState(state);
    if (s.finished) return true;
    const minInsights = spec.rules?.minInsights ?? 8;
    const goal = spec.board?.goalSpace ?? (spec.board?.spaces ?? 24) - 1;
    return s.insights.length >= minInsights && s.position >= goal - 1;
  },

  computeScore(state: GameState, spec: GameSpecV1): number {
    const s = asBoardState(state);
    const goal = spec.board?.goalSpace ?? (spec.board?.spaces ?? 24) - 1;
    const minInsights = spec.rules?.minInsights ?? 8;
    const posPart = goal > 0 ? Math.min(1, s.position / goal) * 0.3 : 0;
    const insightPart = Math.min(1, s.insights.length / minInsights) * 0.4;
    const ecoPart = Math.min(1, s.ecoCredits / 1500) * 0.3;
    return Math.min(1, posPart + insightPart + ecoPart);
  },
};
