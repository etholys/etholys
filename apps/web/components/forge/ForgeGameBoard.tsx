'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { GameSpecV1 } from '@/lib/forge/schemas/game-spec-v1';
import { Coins, MapPin, RotateCcw, Sparkles, Target, Undo2, XCircle } from 'lucide-react';
import { historyCount } from '@/lib/forge/board-history';
import { ForgeBoardTrack } from '@/components/forge/ForgeBoardTrack';
import { ForgeBoardLegend } from '@/components/forge/ForgeBoardLegend';
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
  hideEventLog = false,
  onLogMessages,
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
  /** Ocultar lista de eventos no painel (usar dock lateral) */
  hideEventLog?: boolean;
  onLogMessages?: (messages: string[]) => void;
}) {
  const ft = useForgeT();
  const [state, setState] = useState<SessionState>(initialState);
  const [events, setEvents] = useState<string[]>([]);
  const [answer, setAnswer] = useState('');
  const [loading, setLoading] = useState(false);
  const [diceRolling, setDiceRolling] = useState(false);
  const [pendingRoll, setPendingRoll] = useState<number | undefined>();
  const versionRef = useRef(roomVersion);
  /** Evita repetir lastEvents estáticos en cada poll (p. ej. "Partida compartida iniciada."). */
  const seenEventsKeyRef = useRef('');

  const appendRoomEvents = useCallback((lastEvents: Array<{ message?: string }> | undefined) => {
    const key = JSON.stringify(lastEvents ?? []);
    if (key === seenEventsKeyRef.current) return;
    seenEventsKeyRef.current = key;
    const msgs = (lastEvents ?? []).map((e) => e.message).filter(Boolean) as string[];
    if (msgs.length) setEvents((prev) => [...msgs, ...prev].slice(0, 12));
  }, []);

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

  useEffect(() => {
    seenEventsKeyRef.current = '';
  }, [roomId]);

  useEffect(() => {
    onLogMessages?.(events);
  }, [events, onLogMessages]);

  const pollRoom = useCallback(async () => {
    if (!roomId || syncMode === 'solo' || syncMode === 'host') return;
    const res = await fetch(`/api/forge/shared-game-rooms/${roomId}`);
    const data = await res.json();
    if (!res.ok || !data.room) return;
    const next = (data.room.state ?? {}) as SessionState;
    setState(next);
    versionRef.current = data.room.version;
    appendRoomEvents(data.room.lastEvents);
    if (data.room.status === 'closed' && next.finished) {
      onRoomState?.(next, true);
      onComplete?.();
    }
  }, [roomId, syncMode, onComplete, onRoomState, appendRoomEvents]);

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
        appendRoomEvents(data.events ?? data.room?.lastEvents);
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
  const isTeamTurn = Boolean(
    syncMode === 'player' && turnPlayer?.userId?.startsWith('team:')
  );
  const canPlayNow =
    syncMode !== 'player' || isMyTurn || isTeamTurn || !multi;
  const displayEco = v2EcoBalance ?? turnPlayer?.ecoCredits ?? state.ecoCredits ?? 500;
  const undoCount = historyCount(initialState as Record<string, unknown>);

  async function rollWithAnimation() {
    setDiceRolling(true);
    setPendingRoll(undefined);
    await sendAction({ type: 'roll_dice' });
    setDiceRolling(false);
  }

  const boardFits = fitContainer || projectionMode;
  const mesaLayout = fitContainer && !projectionMode;
  const showEventLog = !hideEventLog && !mesaLayout;
  const showFullChrome = !projectionMode;
  const showCompactChrome = projectionMode && isFacilitator;

  const statPills = (
    <div className="flex flex-wrap items-stretch gap-1.5">
      <div className="rounded-lg bg-amber-950/80 border border-amber-600/40 px-2.5 py-1 text-center min-w-[4.5rem]">
        <p className="text-[8px] font-bold uppercase text-amber-300">Eco</p>
        <p className="text-sm font-black text-amber-100 tabular-nums">{displayEco}</p>
      </div>
      <div className="rounded-lg bg-emerald-950/80 border border-emerald-600/40 px-2.5 py-1 text-center min-w-[4.5rem]">
        <p className="text-[8px] font-bold uppercase text-emerald-300">Impacto</p>
        <p className="text-sm font-black text-emerald-100 tabular-nums">{state.impactPoints ?? 0}</p>
      </div>
      <div className="rounded-lg bg-blue-950/80 border border-blue-600/40 px-2.5 py-1 text-center min-w-[4.5rem]">
        <p className="text-[8px] font-bold uppercase text-blue-300">Casilla</p>
        <p className="text-sm font-black text-blue-100 tabular-nums">
          {pos}/{goal}
        </p>
      </div>
      <div className="rounded-lg bg-violet-950/80 border border-violet-600/40 px-2.5 py-1 text-center min-w-[4.5rem]">
        <p className="text-[8px] font-bold uppercase text-violet-300">Fichas</p>
        <p className="text-sm font-black text-violet-100 tabular-nums">
          {insights.length}/{minInsights}
        </p>
      </div>
    </div>
  );

  const showPlayerControls = !state.currentCard && !state.finished && canAct;
  const diceCardControls = showPlayerControls && (
    <div className="flex flex-wrap items-center gap-3">
      <ForgeVirtualDice rolling={diceRolling} value={pendingRoll ?? state.lastRoll} />
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={loading || diceRolling || !canPlayNow}
          onClick={() => void rollWithAnimation()}
          className="rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50"
        >
          {ft('forge.room.rollDice')}
        </button>
        <button
          type="button"
          disabled={loading || !canPlayNow}
          onClick={() => sendAction({ type: 'draw_card' })}
          className="rounded-lg border-2 border-amber-400 bg-amber-100 px-5 py-2.5 text-sm font-semibold text-amber-900 hover:bg-amber-200 disabled:opacity-50"
        >
          {ft('forge.room.drawCard')}
        </button>
        {multi && canPlayNow && (
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
      {syncMode === 'player' && !canPlayNow && turnPlayer && (
        <p className="w-full text-sm font-medium text-slate-600">
          {ft('forge.room.turnOf', { name: turnPlayer.name })}
        </p>
      )}
    </div>
  );

  return (
    <div
      className={cn(
        'relative flex flex-1 h-full w-full min-h-0 min-w-0',
        mesaLayout ? 'flex-col gap-2 p-2 md:p-3' : projectionMode ? 'flex-col gap-0' : 'flex-col gap-2 p-2'
      )}
    >
      {isFacilitator && roomId && !projectionMode && mesaLayout && (
        <div className="flex flex-wrap gap-1.5 shrink-0">
          <button
            type="button"
            disabled={loading || undoCount === 0}
            onClick={() => sendAction({ type: 'undo_last' })}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-500 bg-slate-800/90 px-2.5 py-1 text-[10px] font-bold text-slate-100 hover:bg-slate-700 disabled:opacity-40"
          >
            <Undo2 className="h-3 w-3" />
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
            className="inline-flex items-center gap-1 rounded-lg border border-amber-500/50 bg-amber-950 px-2.5 py-1 text-[10px] font-bold text-amber-100 hover:bg-amber-900"
          >
            <RotateCcw className="h-3 w-3" />
            {ft('forge.room.restart')}
          </button>
          {state.currentCard && (
            <button
              type="button"
              disabled={loading}
              onClick={() => sendAction({ type: 'clear_card' })}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-500 bg-slate-800/90 px-2.5 py-1 text-[10px] font-bold text-slate-200 hover:bg-slate-700"
            >
              <XCircle className="h-3 w-3" />
              {ft('forge.room.clearCard')}
            </button>
          )}
        </div>
      )}
      {isFacilitator && roomId && !projectionMode && !mesaLayout && (
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
      {multi && turnPlayer && (showFullChrome || showCompactChrome) && !mesaLayout && (
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
      {mesaLayout ? (
        <>
          {multi && turnPlayer && (
            <div className="shrink-0 rounded-lg border border-emerald-500/30 bg-emerald-950/70 px-3 py-1.5 flex flex-wrap items-center gap-2">
              <p className="text-xs font-bold text-emerald-100">
                {isMyTurn ? ft('forge.room.yourTurn') : ft('forge.room.turnOf', { name: turnPlayer.name })}
              </p>
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
            </div>
          )}
          <div className="relative grid flex-1 min-h-0 w-full min-w-0 grid-rows-[1fr] overflow-hidden">
            <div className="flex h-full w-full min-h-0 min-w-0 items-stretch gap-2 md:gap-3 p-1 md:p-2">
              <ForgeBoardLegend className="hidden xl:block w-[132px] shrink-0 self-end" />
              <div className="flex flex-1 min-h-0 min-w-0 items-center justify-center">
                <div className="aspect-square w-[min(78vmin,calc(100%-0.5rem))] max-h-full max-w-full shrink-0">
                  <ForgeBoardTrack
                    spaces={spaces}
                    position={pos}
                    players={players}
                    fitContainer
                    hideLegend
                    className="h-full w-full"
                  />
                </div>
              </div>
            </div>
            <ForgeBoardLegend className="absolute bottom-2 left-2 z-10 xl:hidden max-w-[min(42vw,148px)]" />
          </div>
          <div className="shrink-0 space-y-2 rounded-xl border border-[#145A45]/12 bg-white/95 p-2 md:p-3 shadow-sm">
            <div className="flex flex-col gap-2 lg:flex-row lg:flex-wrap lg:items-center">
              {statPills}
              {!state.currentCard && !state.finished && showPlayerControls && (
                <div className="flex flex-1 min-w-0 flex-wrap items-center gap-2 lg:justify-end">
                  {diceCardControls}
                </div>
              )}
            </div>
            {state.currentCard && (
              <div className="rounded-xl border-2 border-amber-300 bg-amber-50 p-3 shadow-sm">
                <p className="text-xs font-bold uppercase text-amber-800 flex items-center gap-1">
                  Carta actual {state.currentCard.id ? `· ${state.currentCard.id}` : ''}
                  {state.currentCard.type ? ` · ${state.currentCard.type}` : ''}
                  <ForgeInfoTip text={state.currentCard.reflection || state.currentCard.prompt} />
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-900">{state.currentCard.prompt}</p>
                {canAct && (
                  <>
                    <textarea
                      value={answer}
                      onChange={(e) => setAnswer(e.target.value)}
                      placeholder="Tu respuesta (escribe o resume tu ficha)..."
                      rows={2}
                      className="mt-2 w-full rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm"
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
              </div>
            )}
            {state.finished && (
              <div className="rounded-xl bg-emerald-100 border border-emerald-300 p-3 text-center">
                <p className="text-base font-bold text-emerald-900">¡Expedición completada!</p>
              </div>
            )}
            {showEventLog && events.length > 0 && (
              <ul className="space-y-0.5 rounded-lg bg-slate-50 border border-slate-100 p-2 text-[11px] text-slate-600 max-h-16 overflow-y-auto">
                {events.map((m, i) => (
                  <li key={i}>• {m}</li>
                ))}
              </ul>
            )}
          </div>
        </>
      ) : (
        <>
      <div className="flex-1 min-h-0 flex items-stretch justify-stretch overflow-hidden w-full">
        <ForgeBoardTrack
          spaces={spaces}
          position={pos}
          players={players}
          immersive={!boardFits}
          fitContainer={boardFits}
          hideLegend={!boardFits}
          className="w-full h-full min-h-0"
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

      {!state.currentCard && !state.finished && showPlayerControls && showFullChrome && diceCardControls}

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

      {showEventLog && events.length > 0 && (
        <ul className="space-y-1 rounded-lg bg-white border border-slate-100 p-2 text-xs text-slate-600 max-h-32 overflow-y-auto">
          {events.map((m, i) => (
            <li key={i}>• {m}</li>
          ))}
        </ul>
      )}
      </>
      )}
        </>
      )}
    </div>
  );
}
