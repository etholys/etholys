import type { GameSpecV1 } from '@/lib/forge/schemas/game-spec-v1';
import type { ForgeEngine, GameAction, GameEvent, GameState } from '@/lib/forge/engines/types';
import {
  advanceTurn,
  currentPlayer,
  landedGuide,
  parseMulti,
  syncLegacyFields,
  type MultiBoardState,
} from '@/lib/forge/expedicion-board-multi';
import {
  clearCurrentCard,
  pushBoardHistory,
  restartBoardState,
  undoBoardState,
} from '@/lib/forge/board-history';
import { drawCardForPosition } from '@/lib/forge/expedicion-station-decks';
import { adjustEcoCredits, usesV2Ledger } from '@/lib/forge/expedicion-v2/board-v2-mode';

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

function applyFacilitatorAction(
  raw: Record<string, unknown>,
  action: GameAction,
  spec: GameSpecV1
): { state: GameState; events: GameEvent[] } | null {
  if (action.type === 'undo_last') {
    const { state, ok } = undoBoardState(raw);
    if (!ok) return { state: raw, events: [{ type: 'error', message: 'No hay jugada para deshacer.' }] };
    return { state, events: [{ type: 'undo', message: 'Última jugada deshecha.' }] };
  }
  if (action.type === 'restart_game') {
    const fresh = restartBoardState(raw, spec);
    return {
      state: fresh,
      events: [{ type: 'restart', message: 'Partida reiniciada. Mismos jugadores, tablero desde el inicio.' }],
    };
  }
  if (action.type === 'clear_card') {
    const next = clearCurrentCard(raw);
    return { state: next, events: [{ type: 'clear_card', message: 'Carta actual retirada.' }] };
  }
  return null;
}

/** Preserva flags V2 (ledger financeiro) no state serializado da sala. */
function preserveV2RoomFlags(state: GameState, roomRaw?: Record<string, unknown>): GameState {
  if (!roomRaw) return state;
  const out = { ...(state as Record<string, unknown>) };
  if (roomRaw.v2FinancialMode === true) out.v2FinancialMode = true;
  if (roomRaw.v2Team != null) out.v2Team = roomRaw.v2Team;
  return out as GameState;
}

function applyMultiAction(
  multi: MultiBoardState,
  action: GameAction,
  spec: GameSpecV1,
  roomRaw?: Record<string, unknown>
): { state: GameState; events: GameEvent[] } {
  const raw = syncLegacyFields({ ...multi, players: multi.players.map((p) => ({ ...p })) }) as Record<
    string,
    unknown
  >;
  const useV2 = usesV2Ledger(roomRaw ?? raw);
  const fac = applyFacilitatorAction(raw, action, spec);
  if (fac) return fac;

  let s = parseMulti(raw)!;
  const events: GameEvent[] = [];
  const goal = spec.board?.goalSpace ?? (spec.board?.spaces ?? 24) - 1;
  const maxTurns = spec.rules?.maxTurns ?? 30;
  const spaces = spec.board?.spaces ?? 20;
  const cur = currentPlayer(s);
  if (!cur) {
    return { state: s, events: [{ type: 'error', message: 'Sin jugadores en la partida.' }] };
  }
  const idx = s.currentPlayerIndex;

  if (s.finished) {
    return { state: s, events: [{ type: 'already_finished', message: 'Partida ya concluida.' }] };
  }

  const withHistory = (next: MultiBoardState) =>
    preserveV2RoomFlags(
      syncLegacyFields(pushBoardHistory(syncLegacyFields(next) as Record<string, unknown>) as MultiBoardState),
      roomRaw
    );

  if (action.type === 'end_turn') {
    s = advanceTurn(s, spec);
    events.push({ type: 'turn', message: s.guide?.message ?? 'Siguiente turno.' });
    return { state: withHistory(s), events };
  }

  if (action.type === 'roll_dice') {
    if (s.currentCard) {
      return {
        state: syncLegacyFields(s),
        events: [{ type: 'error', message: 'Completa la carta antes de lanzar el dado.' }],
      };
    }
    const sides = spec.rules?.diceSides ?? 6;
    const roll = Math.floor(Math.random() * sides) + 1;
    s.lastRoll = roll;
    s.turn = s.turn || 1;
    let next = cur.position + roll;
    if (spec.board?.loops && next > goal) next = next % spaces;
    else next = Math.min(goal, next);
    s.players[idx] = { ...cur, position: next };
    s.guide = landedGuide(s.players[idx], next);
    events.push({
      type: 'rolled',
      message: `${cur.name} sacó ${roll} y avanzó a casilla ${next}.`,
    });
    if (s.turn >= maxTurns) {
      s.finished = true;
      events.push({ type: 'max_turns', message: 'Turnos agotados.' });
    }
    return { state: withHistory(s), events };
  }

  if (action.type === 'draw_card') {
    const cards = spec.cards ?? [];
    const card = drawCardForPosition(cards, cur.position);
    if (!card) {
      return { state: syncLegacyFields(s), events: [{ type: 'error', message: 'Sin cartas en el mazo.' }] };
    }
    s.currentCard = {
      id: card.id,
      prompt: card.prompt,
      reflection: card.reflection,
      type: card.type,
      forUserId: cur.userId,
    };
    s.guide = {
      message: `${cur.name}: lee la carta y resuélvela en tu mapa. Luego valida o pasa turno.`,
      type: 'card',
      playerName: cur.name,
      at: Date.now(),
    };
    const p = s.players[idx];
    if (card.type === 'penalty' || card.prompt.toLowerCase().includes('pag')) {
      s.players[idx] = {
        ...p,
        ecoCredits: adjustEcoCredits(p.ecoCredits, -100, useV2),
      };
      events.push({ type: 'penalty', message: `${cur.name}: -100 Eco-Créditos. ${card.prompt}` });
    } else if (card.type === 'bonus') {
      const bonus = card.xp ?? 50;
      s.players[idx] = {
        ...p,
        ecoCredits: adjustEcoCredits(p.ecoCredits, bonus, useV2),
      };
      events.push({ type: 'bonus', message: `${cur.name}: bono +${bonus} Eco.` });
    } else {
      events.push({ type: 'card', message: card.prompt });
    }
    return { state: withHistory(s), events };
  }

  if (action.type === 'complete_card' || action.type === 'record_insight') {
    const text = typeof action.payload?.text === 'string' ? action.payload.text.trim() : '';
    if (!text || text.length < 8) {
      return {
        state: syncLegacyFields(s),
        events: [{ type: 'error', message: 'Escribe al menos 8 caracteres.' }],
      };
    }
    const p = s.players[idx];
    s.players[idx] = {
      ...p,
      insights: [...p.insights, text.slice(0, 2000)],
      impactPoints: p.impactPoints + 1,
      ecoCredits: adjustEcoCredits(p.ecoCredits, 100, useV2),
    };
    s.currentCard = null;
    s.guide = {
      message: `¡Ficha validada para ${cur.name}! +100 Eco. Puedes pasar turno.`,
      type: 'decision',
      playerName: cur.name,
      at: Date.now(),
    };
    events.push({ type: 'validated', message: `${cur.name}: +100 Eco · +1 Impacto` });
    s = advanceTurn(s, spec);
    return { state: withHistory(s), events };
  }

  if (action.type === 'skip_card') {
    const p = s.players[idx];
    s.players[idx] = { ...p, ecoCredits: adjustEcoCredits(p.ecoCredits, -50, useV2) };
    s.currentCard = null;
    events.push({ type: 'skip', message: `${cur.name}: carta pendiente (-50 Eco).` });
    s = advanceTurn(s, spec);
    return { state: withHistory(s), events };
  }

  return {
    state: syncLegacyFields(s),
    events: [{ type: 'error', message: `Acción desconocida: ${action.type}` }],
  };
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
    const multiRaw = state as Record<string, unknown>;
    const multi = parseMulti(multiRaw);
    if (multi) {
      return applyMultiAction(multi, action, spec, multiRaw);
    }

    const raw = state as Record<string, unknown>;
    const useV2 = usesV2Ledger(raw);
    const fac = applyFacilitatorAction(raw, action, spec);
    if (fac) return fac;

    let s = asBoardState(state);
    const events: GameEvent[] = [];
    const goal = spec.board?.goalSpace ?? (spec.board?.spaces ?? 24) - 1;
    const maxTurns = spec.rules?.maxTurns ?? 30;
    const spaces = spec.board?.spaces ?? 20;

    if (s.finished) {
      return { state: s, events: [{ type: 'already_finished', message: 'Partida ya concluida.' }] };
    }

    const save = (next: BoardState) => pushBoardHistory({ ...next }) as BoardState;

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
      return { state: save(s), events };
    }

    if (action.type === 'draw_card') {
      const cards = spec.cards ?? [];
      const card = drawCardForPosition(cards, s.position);
      if (!card) {
        return { state: s, events: [{ type: 'error', message: 'Sin cartas en el mazo.' }] };
      }
      s.currentCard = {
        id: card.id,
        prompt: card.prompt,
        reflection: card.reflection,
        xp: card.xp,
        type: card.type,
      };
      if (card.type === 'penalty' || card.prompt.toLowerCase().includes('pag')) {
        s.ecoCredits = adjustEcoCredits(s.ecoCredits, -100, useV2);
        events.push({ type: 'penalty', message: `Desafío: -100 Eco-Créditos. ${card.prompt}` });
      } else if (card.type === 'bonus') {
        const bonus = card.xp ?? 50;
        s.ecoCredits = adjustEcoCredits(s.ecoCredits, bonus, useV2);
        events.push({ type: 'bonus', message: `Bono: +${bonus} Eco-Créditos.` });
      } else {
        events.push({ type: 'card', message: card.prompt, xp: card.xp });
      }
      return { state: save(s), events };
    }

    if (action.type === 'complete_card' || action.type === 'record_insight') {
      const text = typeof action.payload?.text === 'string' ? action.payload.text.trim() : '';
      if (!text || text.length < 8) {
        return { state: s, events: [{ type: 'error', message: 'Escribe al menos 8 caracteres de respuesta.' }] };
      }
      s.insights.push(text.slice(0, 2000));
      s.impactPoints += 1;
      s.ecoCredits = adjustEcoCredits(s.ecoCredits, 100, useV2);
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
      return { state: save(s), events };
    }

    if (action.type === 'skip_card') {
      s.ecoCredits = adjustEcoCredits(s.ecoCredits, -50, useV2);
      s.currentCard = null;
      events.push({ type: 'skip', message: 'Carta corregida más tarde: -50 Eco-Créditos.' });
      return { state: save(s), events };
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
