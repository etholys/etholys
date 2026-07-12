'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { GameSpecV1 } from '@/lib/forge/schemas/game-spec-v1';
import { Coins, MapPin, RotateCcw, Sparkles, Target, Undo2, XCircle } from 'lucide-react';
import { historyCount } from '@/lib/forge/board-history';
import { ForgeBoardTrack } from '@/components/forge/ForgeBoardTrack';
import { ForgeVirtualDice } from '@/components/forge/ForgeVirtualDice';
import { ForgeInfoTip } from '@/components/forge/ForgeInfoTip';
import { parseMulti, currentPlayer, type BoardGuide } from '@/lib/forge/expedicion-board-multi';
import { useForgeT } from '@/lib/forge/use-forge-t';
import { cn } from '@/lib/utils';

type SessionState = {
  position?: number;
  turn?: number;
  insights?: string[];
  ecoCredits?: number;
  impactPoints?: number;
  lastRoll?: number;
  finished?: boolean;
  currentCard?: { id: string; prompt: string; reflection?: string; type?: string } | null;
};

export type ForgeGameSyncMode = 'solo' | 'host' | 'viewer' | 'player' | 'facilitator';

export function ForgeGameBoard({
  sessionId,
  roomId,
  syncMode = 'solo',
  spec,
  initialState,
  roomVersion = 0,
  myUserId,
  isFacilitator = false,
  facilitatorEmergency = false,
  onGuideChange,
  onComplete,
  onRoomState,
  onGameEvents,
  v2EcoBalance,
  projectionMode = false,
  facilitatorDrives = false,
  fitContainer = false,
}: {
  sessionId?: string;
  roomId?: string;
  syncMode?: ForgeGameSyncMode;
  spec: GameSpecV1;
  initialState: SessionState;
  roomVersion?: number;
  myUserId?: string;
  isFacilitator?: boolean;
  facilitatorEmergency?: boolean;
  onGuideChange?: (guide: BoardGuide | null, knowledge: { title: string; body: string } | null) => void;
  onComplete?: () => void;
  onRoomState?: (state: SessionState, finished: boolean) => void;
  onGameEvents?: (events: Array<{ type?: string; message?: string; amount?: number }>) => void;
  /** Saldo V2 — sustituye ecoCredits legado en UI */
  v2EcoBalance?: number;
  /** Facilitador a projetar: tabuleiro maximizado, menos chrome */
  projectionMode?: boolean;
  /** Facilitador conduce la mesa (puede lanzar dado sin modo emergencia) */
  facilitatorDrives?: boolean;
  /** Tabuleiro escala ao espaço disponível (mesa) */
  fitContainer?: boolean;
}) {
  const ft = useForgeT();
  const [state, setState] = useState<SessionState>(initialState);
  const [events, setEvents] = useState<string[]>([]);
  const [answer, setAnswer] = useState('');
  const [loading, setLoading] = useState(false);
  const [diceRolling, setDiceRolling] = useState(false);
  const [pendingRoll, setPendingRoll] = useState<number | undefined>();
  const versionRef = useRef(roomVersion);

  const multi = parseMulti(initialState as Record<string, unknown>);
  const readOnly =
    syncMode === 'viewer' ||
    (syncMode === 'facilitator' && !facilitatorEmergency && !facilitatorDrives);
  const canAct =
    syncMode === 'solo' ||
    syncMode === 'host' ||
    syncMode === 'player' ||
    (syncMode === 'facilitator' && (facilitatorEmergency || facilitatorDrives));
  useEffect(() => {
    setState(initialState);
    const m = parseMulti(initialState as Record<string, unknown>);
    if (m?.guide) onGuideChange?.(m.guide, m.knowledgeCard ?? null);
  }, [initialState, roomVersion, onGuideChange]);

  useEffect(() => {
    versionRef.current = roomVersion;
  }, [roomVersion]);

  const pollRoom = useCallback(async () => {
    if (!roomId || syncMode === 'solo' || syncMode === 'host') return;
    const res = await fetch(`/api/forge/shared-game-rooms/${roomId}`);
    const data = await res.json();
    if (!res.ok || !data.room) return;
    const next = (data.room.state ?? {}) as SessionState;
    setState(next);
    versionRef.current = data.room.version;
    const msgs = (data.room.lastEvents ?? [])
      .map((e: { message?: string }) => e.message)
      .filter(Boolean);
    if (msgs.length) setEvents((prev) => [...msgs, ...prev].slice(0, 12));
    if (data.room.status === 'closed' && next.finished) {
      onRoomState?.(next, true);
      onComplete?.();
    }
  }, [roomId, syncMode, onComplete, onRoomState]);

  useEffect(() => {
    if (!roomId || syncMode === 'solo' || syncMode === 'host') return;
    pollRoom();
    const t = setInterval(pollRoom, 2000);
    return () => clearInterval(t);
  }, [syncMode, roomId, pollRoom]);

  async function sendAction(action: { type: string; payload?: Record<string, unknown> }) {
    const facOnly = new Set(['undo_last', 'restart_game', 'clear_card']);
    const facAction = isFacilitator && facOnly.has(action.type);
    if (!canAct && !facAction) return;
    setLoading(true);
    const payload = {
      ...action.payload,
      ...((facilitatorEmergency || facilitatorDrives) && isFacilitator
        ? { facilitatorOverride: true }
        : {}),
    };
    try {
      if (
        roomId &&
        (syncMode === 'host' ||
          syncMode === 'player' ||
          syncMode === 'facilitator' ||
          facAction)
      ) {
        const res = await fetch(`/api/forge/shared-game-rooms/${roomId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: { ...action, payload },
            expectedVersion: versionRef.current,
          }),
        });
        const data = await res.json();
        if (res.status === 409 && data.room) {
          setState((data.room.state ?? {}) as SessionState);
          versionRef.current = data.room.version;
          setEvents((prev) => ['Tablero actualizado por otro dispositivo.', ...prev]);
          return;
        }
        if (!res.ok) throw new Error(data.error || 'Error');
        const next = (data.room?.state ?? {}) as SessionState;
        setState(next);
        versionRef.current = data.room?.version ?? versionRef.current;
        const m = parseMulti(next as Record<string, unknown>);
        if (m?.guide) onGuideChange?.(m.guide, m.knowledgeCard ?? null);
        const msgs = (data.events ?? []).map((e: { message?: string }) => e.message).filter(Boolean);
        if (msgs.length) setEvents((prev) => [...msgs, ...prev].slice(0, 12));
        if (data.events?.length) onGameEvents?.(data.events);
        if (action.type === 'roll_dice' && m?.lastRoll) {
          setPendingRoll(m.lastRoll);
        }
        if (data.done || data.room?.status === 'closed') {
          onRoomState?.(next, true);
          onComplete?.();
        }
      } else if (sessionId) {
        const res = await fetch('/api/forge/game-sessions', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId, action }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Error en la jugada');
        setState((data.session?.state ?? {}) as SessionState);
        const msgs = (data.events ?? []).map((e: { message?: string }) => e.message).filter(Boolean);
        if (msgs.length) setEvents((prev) => [...msgs, ...prev].slice(0, 10));
        if (data.events?.length) onGameEvents?.(data.events);
        if (data.session?.status === 'completed') onComplete?.();
      }
    } catch (e) {
      setEvents((prev) => [e instanceof Error ? e.message : 'Error', ...prev]);
    } finally {
      setLoading(false);
    }
  }

  const goal = spec.board?.goalSpace ?? (spec.board?.spaces ?? 20) - 1;
  const spaces = spec.board?.spaces ?? 20;
  const minInsights = spec.rules?.minInsights ?? 8;
  const pos = state.position ?? 0;
  const insights = state.insights ?? [];
  const players = multi?.players ?? [];
  const turnPlayer = multi ? currentPlayer(multi) : null;
  const isMyTurn = Boolean(
    myUserId && turnPlayer && turnPlayer.userId === myUserId && syncMode === 'player'
  );
  const displayEco = v2EcoBalance ?? turnPlayer?.ecoCredits ?? state.ecoCredits ?? 500;
  const undoCount = historyCount(initialState as Record<string, unknown>);

  async function rollWithAnimation() {
    setDiceRolling(true);
    setPendingRoll(undefined);
    await sendAction({ type: 'roll_dice' });
    setDiceRolling(false);
  }

  const boardFits = fitContainer || projectionMode;
  const showFullChrome = !projectionMode;
  const showCompactChrome = projectionMode && isFacilitator;

  const diceCardControls = !state.currentCard && !state.finished && canAct && (
    <div className="flex flex-wrap items-center gap-3">
      <ForgeVirtualDice rolling={diceRolling} value={pendingRoll ?? state.lastRoll} />
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={loading || diceRolling}
          onClick={() => void rollWithAnimation()}
          className="rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50"
        >
          {ft('forge.room.rollDice')}
        </button>
        <button
          type="button"
          disabled={loading}
          onClick={() => sendAction({ type: 'draw_card' })}
          className="rounded-lg border-2 border-amber-400 bg-amber-100 px-5 py-2.5 text-sm font-semibold text-amber-900 hover:bg-amber-200 disabled:opacity-50"
        >
          {ft('forge.room.drawCard')}
        </button>
        {multi && (
          <button
            type="button"
            disabled={loading}
            onClick={() => sendAction({ type: 'end_turn' })}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700"
          >
            {ft('forge.room.endTurn')}
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div className={cn('relative flex flex-col h-full min-h-0', projectionMode ? 'gap-0' : 'gap-2 p-2')}>
      {isFacilitator && roomId && !projectionMode && (
        <div className="flex flex-wrap gap-2 rounded-xl border border-slate-600 bg-slate-800/80 p-2">
          <button
            type="button"
            disabled={loading || undoCount === 0}
            onClick={() => sendAction({ type: 'undo_last' })}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-500 px-3 py-1.5 text-xs font-bold text-slate-100 hover:bg-slate-700 disabled:opacity-40"
          >
            <Undo2 className="h-3.5 w-3.5" />
            {ft('forge.room.undo')} ({undoCount})
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => {
              if (window.confirm(ft('forge.room.restartConfirm'))) {
                sendAction({ type: 'restart_game' });
              }
            }}
            className="inline-flex items-center gap-1 rounded-lg border border-amber-500/50 bg-amber-950 px-3 py-1.5 text-xs font-bold text-amber-100 hover:bg-amber-900"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            {ft('forge.room.restart')}
          </button>
          {state.currentCard && (
            <button
              type="button"
              disabled={loading}
              onClick={() => sendAction({ type: 'clear_card' })}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-500 px-3 py-1.5 text-xs font-bold text-slate-200 hover:bg-slate-700"
            >
              <XCircle className="h-3.5 w-3.5" />
              {ft('forge.room.clearCard')}
            </button>
          )}
        </div>
      )}
      {multi && turnPlayer && (showFullChrome || showCompactChrome) && (
        <div
          className={cn(
            'rounded-xl border border-emerald-500/40 bg-emerald-950/60 px-3 py-2 flex flex-wrap items-center gap-2',
            showCompactChrome && 'absolute bottom-3 left-3 right-3 z-20 bg-emerald-950/90 shadow-lg'
          )}
        >
          <p className="text-sm font-bold text-emerald-100">
            {isMyTurn ? ft('forge.room.yourTurn') : ft('forge.room.turnOf', { name: turnPlayer.name })}
          </p>
          {myUserId && (
            <div className="flex gap-1 ml-auto">
              {players.map((p) => (
                <span
                  key={p.userId}
                  title={`${p.name} · casilla ${p.position}`}
                  className={`h-3 w-3 rounded-full border-2 ${
                    p.userId === turnPlayer.userId ? 'border-white scale-125' : 'border-transparent opacity-70'
                  }`}
                  style={{ backgroundColor: p.color }}
                />
              ))}
            </div>
          )}
        </div>
      )}
      <div className="flex-1 min-h-0 flex items-stretch justify-center overflow-hidden">
        <ForgeBoardTrack
          spaces={spaces}
          position={pos}
          players={players}
          immersive={!boardFits}
          fitContainer={boardFits}
          hideLegend={!boardFits}
          className="w-full h-full"
        />
      </div>

      {!showFullChrome && showCompactChrome && state.currentCard && (
        <div className="absolute bottom-3 left-3 right-3 z-20 rounded-xl border-2 border-amber-300 bg-amber-50/95 p-3 shadow-lg max-h-40 overflow-y-auto">
          <p className="text-xs font-bold uppercase text-amber-800">{ft('forge.room.cardFac')}</p>
          <p className="mt-1 text-sm font-semibold text-slate-900 line-clamp-3">{state.currentCard.prompt}</p>
        </div>
      )}

      {showFullChrome && (
      <>
      <div className="grid grid-cols-4 gap-1 shrink-0">
        <div className="rounded-lg bg-amber-950/80 border border-amber-600/40 p-1.5 text-center">
          <p className="text-[8px] font-bold uppercase text-amber-300">Eco</p>
          <p className="text-sm font-black text-amber-100">{displayEco}</p>
        </div>
        <div className="rounded-lg bg-emerald-950/80 border border-emerald-600/40 p-1.5 text-center">
          <p className="text-[8px] font-bold uppercase text-emerald-300">Impacto</p>
          <p className="text-sm font-black text-emerald-100">{state.impactPoints ?? 0}</p>
        </div>
        <div className="rounded-lg bg-blue-950/80 border border-blue-600/40 p-1.5 text-center">
          <p className="text-[8px] font-bold uppercase text-blue-300">Casilla</p>
          <p className="text-sm font-black text-blue-100">
            {pos}/{goal}
          </p>
        </div>
        <div className="rounded-lg bg-violet-950/80 border border-violet-600/40 p-1.5 text-center">
          <p className="text-[8px] font-bold uppercase text-violet-300">Fichas</p>
          <p className="text-sm font-black text-violet-100">
            {insights.length}/{minInsights}
          </p>
        </div>
      </div>

      {state.currentCard && (
        <div className="rounded-xl border-2 border-amber-300 bg-amber-50 p-4 shadow-sm">
          <p className="text-xs font-bold uppercase text-amber-800 flex items-center gap-1">
            Carta actual {state.currentCard.id ? `· ${state.currentCard.id}` : ''}
            {state.currentCard.type ? ` · ${state.currentCard.type}` : ''}
            <ForgeInfoTip text={state.currentCard.reflection || state.currentCard.prompt} />
          </p>
          <p className="mt-2 text-base font-semibold text-slate-900">{state.currentCard.prompt}</p>
          {state.currentCard.reflection && (
            <p className="mt-2 text-sm text-amber-900/80">💡 {state.currentCard.reflection}</p>
          )}
          {canAct && (
            <>
              <textarea
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                placeholder="Tu respuesta (escribe o resume tu ficha)..."
                rows={3}
                className="mt-3 w-full rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm"
                disabled={loading || state.finished}
              />
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={loading || state.finished || answer.trim().length < 8}
                  onClick={() => {
                    sendAction({ type: 'complete_card', payload: { text: answer } });
                    setAnswer('');
                  }}
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  Validar ficha (+100)
                </button>
                <button
                  type="button"
                  disabled={loading || state.finished}
                  onClick={() => sendAction({ type: 'skip_card' })}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-600"
                >
                  Corregir después (-50)
                </button>
              </div>
            </>
          )}
          {!canAct && (
            <p className="mt-3 text-sm text-amber-800 italic">
              {syncMode === 'facilitator'
                ? ft('forge.room.facilitatorWatch')
                : ft('forge.room.waitYourTurn')}
            </p>
          )}
        </div>
      )}

      {!state.currentCard && !state.finished && canAct && showFullChrome && diceCardControls}

      {showCompactChrome && diceCardControls && (
        <div className="absolute bottom-16 left-3 right-3 z-20 rounded-xl border border-[#145A45]/20 bg-white/95 p-2 shadow-lg">
          {diceCardControls}
        </div>
      )}

      {state.finished && showFullChrome && (
        <div className="rounded-xl bg-emerald-100 border border-emerald-300 p-4 text-center">
          <p className="text-lg font-bold text-emerald-900">¡Expedición completada!</p>
          {!v2EcoBalance ? (
            <p className="text-sm text-emerald-800 mt-1">
              Eco-Créditos: {state.ecoCredits} · Impacto: {state.impactPoints} · Fichas:{' '}
              {insights.length}
            </p>
          ) : (
            <p className="text-sm text-emerald-800 mt-1">
              Ledger V2: {v2EcoBalance} Eco · Fichas mapa: {insights.length}
            </p>
          )}
        </div>
      )}

      {events.length > 0 && (
        <ul className="space-y-1 rounded-lg bg-white border border-slate-100 p-2 text-xs text-slate-600 max-h-32 overflow-y-auto">
          {events.map((m, i) => (
            <li key={i}>• {m}</li>
          ))}
        </ul>
      )}
      </>
      )}
    </div>
  );
}
