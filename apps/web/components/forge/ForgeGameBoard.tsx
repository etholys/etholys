'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { GameSpecV1 } from '@/lib/forge/schemas/game-spec-v1';
import { Coins, MapPin, Sparkles, Target } from 'lucide-react';
import { ForgeBoardTrack } from '@/components/forge/ForgeBoardTrack';
import { ForgeVirtualDice } from '@/components/forge/ForgeVirtualDice';
import { ForgeInfoTip } from '@/components/forge/ForgeInfoTip';
import { parseMulti, currentPlayer, type BoardGuide } from '@/lib/forge/expedicion-board-multi';
import { useForgeT } from '@/lib/forge/use-forge-t';

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
    syncMode === 'viewer' || (syncMode === 'facilitator' && !facilitatorEmergency);
  const canAct =
    syncMode === 'solo' ||
    syncMode === 'host' ||
    syncMode === 'player' ||
    (syncMode === 'facilitator' && facilitatorEmergency);
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
    if (!canAct) return;
    setLoading(true);
    const payload = {
      ...action.payload,
      ...(facilitatorEmergency && isFacilitator ? { facilitatorOverride: true } : {}),
    };
    try {
      if ((syncMode === 'host' || syncMode === 'player' || syncMode === 'facilitator') && roomId) {
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
  const displayEco = turnPlayer?.ecoCredits ?? state.ecoCredits ?? 500;

  async function rollWithAnimation() {
    setDiceRolling(true);
    setPendingRoll(undefined);
    await sendAction({ type: 'roll_dice' });
    setDiceRolling(false);
  }

  return (
    <div className="space-y-5">
      {multi && turnPlayer && (
        <div className="rounded-xl border border-emerald-500/40 bg-emerald-950/60 px-3 py-2 flex flex-wrap items-center gap-2">
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
      <div className="grid gap-3 sm:grid-cols-4">
        <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-center">
          <Coins className="mx-auto h-5 w-5 text-amber-700" />
          <p className="text-[10px] font-bold uppercase text-amber-800 mt-1">Eco-Créditos</p>
          <p className="text-2xl font-black text-amber-900">{displayEco}</p>
        </div>
        <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-center">
          <Sparkles className="mx-auto h-5 w-5 text-emerald-700" />
          <p className="text-[10px] font-bold uppercase text-emerald-800 mt-1">Impacto</p>
          <p className="text-2xl font-black text-emerald-900">{state.impactPoints ?? 0}</p>
        </div>
        <div className="rounded-xl bg-blue-50 border border-blue-200 p-3 text-center">
          <MapPin className="mx-auto h-5 w-5 text-blue-700" />
          <p className="text-[10px] font-bold uppercase text-blue-800 mt-1">Casilla</p>
          <p className="text-2xl font-black text-blue-900">
            {pos}/{goal}
          </p>
        </div>
        <div className="rounded-xl bg-violet-50 border border-violet-200 p-3 text-center">
          <Target className="mx-auto h-5 w-5 text-violet-700" />
          <p className="text-[10px] font-bold uppercase text-violet-800 mt-1">Fichas</p>
          <p className="text-2xl font-black text-violet-900">
            {insights.length}/{minInsights}
          </p>
        </div>
      </div>

      <ForgeBoardTrack spaces={spaces} position={pos} players={players} />

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

      {!state.currentCard && !state.finished && canAct && (
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
      )}

      {state.finished && (
        <div className="rounded-xl bg-emerald-100 border border-emerald-300 p-4 text-center">
          <p className="text-lg font-bold text-emerald-900">¡Expedición completada!</p>
          <p className="text-sm text-emerald-800 mt-1">
            Eco-Créditos: {state.ecoCredits} · Impacto: {state.impactPoints} · Fichas: {insights.length}
          </p>
        </div>
      )}

      {events.length > 0 && (
        <ul className="space-y-1 rounded-lg bg-white border border-slate-100 p-2 text-xs text-slate-600 max-h-32 overflow-y-auto">
          {events.map((m, i) => (
            <li key={i}>• {m}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
