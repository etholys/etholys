import type { GameSpecV1 } from '@/lib/forge/schemas/game-spec-v1';
import { PLAYER_PAWN_COLORS, stationForSpace } from '@/lib/forge/board-spaces';

export type BoardPlayer = {
  userId: string;
  name: string;
  color: string;
  position: number;
  ecoCredits: number;
  impactPoints: number;
  insights: string[];
};

export type BoardGuide = {
  message: string;
  type: 'turn' | 'landed' | 'card' | 'decision' | 'knowledge' | 'system';
  playerName?: string;
  at: number;
};

export type MultiBoardState = {
  multiplayer: true;
  players: BoardPlayer[];
  currentPlayerIndex: number;
  turn: number;
  finished: boolean;
  currentCard?: {
    id: string;
    prompt: string;
    reflection?: string;
    type?: string;
    forUserId?: string;
  } | null;
  lastRoll?: number;
  lastRollBy?: string;
  guide?: BoardGuide | null;
  knowledgeCard?: { title: string; body: string } | null;
  facilitatorOverride?: boolean;
  /** Legacy collective position (mirror del líder de turno) */
  position?: number;
  ecoCredits?: number;
  impactPoints?: number;
  insights?: string[];
};

export function rosterFromEnrollments(
  rows: { userId: string; name: string | null; email: string | null }[]
): BoardPlayer[] {
  return rows.map((r, i) => ({
    userId: r.userId,
    name: (r.name || r.email || `Jugador ${i + 1}`).split('@')[0],
    color: PLAYER_PAWN_COLORS[i % PLAYER_PAWN_COLORS.length],
    position: 0,
    ecoCredits: 500,
    impactPoints: 0,
    insights: [],
  }));
}

export function createMultiplayerInitialState(
  roster: BoardPlayer[],
  spec: GameSpecV1
): MultiBoardState {
  const start = spec.board?.startSpace ?? 0;
  const players = roster.map((p) => ({ ...p, position: start }));
  const first = players[0];
  return {
    multiplayer: true,
    players,
    currentPlayerIndex: 0,
    turn: 1,
    finished: false,
    currentCard: null,
    position: start,
    ecoCredits: first?.ecoCredits ?? 500,
    impactPoints: 0,
    insights: [],
    guide: first
      ? {
          message: `Turno de ${first.name}. Lanza el dado o roba carta en tu estación.`,
          type: 'turn',
          playerName: first.name,
          at: Date.now(),
        }
      : null,
  };
}

export function currentPlayer(s: MultiBoardState): BoardPlayer | null {
  return s.players[s.currentPlayerIndex] ?? null;
}

export function syncLegacyFields(s: MultiBoardState): MultiBoardState {
  const p = currentPlayer(s);
  if (!p) return s;
  return {
    ...s,
    position: p.position,
    ecoCredits: p.ecoCredits,
    impactPoints: p.impactPoints,
    insights: p.insights,
  };
}

export function isMultiState(raw: Record<string, unknown>): raw is MultiBoardState & Record<string, unknown> {
  return raw.multiplayer === true && Array.isArray(raw.players);
}

export function canPlayerAct(
  s: MultiBoardState,
  userId: string,
  isFacilitator: boolean,
  useOverride: boolean
): boolean {
  if (s.finished) return false;
  if (isFacilitator && useOverride) return true;
  const cur = currentPlayer(s);
  return cur?.userId === userId;
}

export function advanceTurn(s: MultiBoardState, spec: GameSpecV1): MultiBoardState {
  if (s.players.length === 0) return s;
  const nextIdx = (s.currentPlayerIndex + 1) % s.players.length;
  const wrapped = nextIdx === 0;
  const next = s.players[nextIdx];
  const out: MultiBoardState = {
    ...s,
    currentPlayerIndex: nextIdx,
    turn: wrapped ? s.turn + 1 : s.turn,
    currentCard: null,
    guide: {
      message: `Turno de ${next.name}. Tu movimiento en el tablero colectivo.`,
      type: 'turn',
      playerName: next.name,
      at: Date.now(),
    },
  };
  return syncLegacyFields(out);
}

export function landedGuide(player: BoardPlayer, position: number): BoardGuide {
  const st = stationForSpace(position);
  return {
    message: `${player.name} cayó en ${st.name} (casilla ${position}). ${st.desc} Roba carta o resuelve en tu mapa A2.`,
    type: 'landed',
    playerName: player.name,
    at: Date.now(),
  };
}

export function parseMulti(raw: Record<string, unknown>): MultiBoardState | null {
  if (!isMultiState(raw)) return null;
  const players = (raw.players as BoardPlayer[]).map((p) => ({
    userId: p.userId,
    name: p.name,
    color: p.color,
    position: typeof p.position === 'number' ? p.position : 0,
    ecoCredits: typeof p.ecoCredits === 'number' ? p.ecoCredits : 500,
    impactPoints: typeof p.impactPoints === 'number' ? p.impactPoints : 0,
    insights: Array.isArray(p.insights) ? p.insights : [],
  }));
  return {
    multiplayer: true,
    players,
    currentPlayerIndex: typeof raw.currentPlayerIndex === 'number' ? raw.currentPlayerIndex : 0,
    turn: typeof raw.turn === 'number' ? raw.turn : 0,
    finished: Boolean(raw.finished),
    currentCard: (raw.currentCard as MultiBoardState['currentCard']) ?? null,
    lastRoll: typeof raw.lastRoll === 'number' ? raw.lastRoll : undefined,
    guide: (raw.guide as BoardGuide | null) ?? null,
    knowledgeCard: (raw.knowledgeCard as MultiBoardState['knowledgeCard']) ?? null,
    facilitatorOverride: Boolean(raw.facilitatorOverride),
    position: typeof raw.position === 'number' ? raw.position : players[0]?.position,
    ecoCredits: typeof raw.ecoCredits === 'number' ? raw.ecoCredits : players[0]?.ecoCredits,
    impactPoints: typeof raw.impactPoints === 'number' ? raw.impactPoints : 0,
    insights: Array.isArray(raw.insights) ? (raw.insights as string[]) : [],
  };
}
