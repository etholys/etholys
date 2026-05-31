'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { GameSpecV1 } from '@/lib/forge/schemas/game-spec-v1';
import { Coins, MapPin, Radio, Sparkles, Target, Users } from 'lucide-react';
import { ForgeBoardTrack } from '@/components/forge/ForgeBoardTrack';

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

export type ForgeGameSyncMode = 'solo' | 'host' | 'viewer';

export function ForgeGameBoard({
  sessionId,
  roomId,
  syncMode = 'solo',
  spec,
  initialState,
  roomVersion = 0,
  onComplete,
  onRoomState,
}: {
  sessionId?: string;
  roomId?: string;
  syncMode?: ForgeGameSyncMode;
  spec: GameSpecV1;
  initialState: SessionState;
  roomVersion?: number;
  onComplete?: () => void;
  onRoomState?: (state: SessionState, finished: boolean) => void;
}) {
  const [state, setState] = useState<SessionState>(initialState);
  const [events, setEvents] = useState<string[]>([]);
  const [answer, setAnswer] = useState('');
  const [loading, setLoading] = useState(false);
  const versionRef = useRef(roomVersion);

  const readOnly = syncMode === 'viewer';
  const isLive = syncMode === 'host' || syncMode === 'viewer';

  useEffect(() => {
    setState(initialState);
  }, [initialState, roomVersion]);

  useEffect(() => {
    versionRef.current = roomVersion;
  }, [roomVersion]);

  const pollRoom = useCallback(async () => {
    if (!roomId || syncMode !== 'viewer') return;
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
    if (syncMode !== 'viewer' || !roomId) return;
    pollRoom();
    const t = setInterval(pollRoom, 2000);
    return () => clearInterval(t);
  }, [syncMode, roomId, pollRoom]);

  async function sendAction(action: { type: string; payload?: Record<string, unknown> }) {
    if (readOnly) return;
    setLoading(true);
    try {
      if (syncMode === 'host' && roomId) {
        const res = await fetch(`/api/forge/shared-game-rooms/${roomId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action, expectedVersion: versionRef.current }),
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
        const msgs = (data.events ?? []).map((e: { message?: string }) => e.message).filter(Boolean);
        if (msgs.length) setEvents((prev) => [...msgs, ...prev].slice(0, 12));
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

  return (
    <div className="space-y-5">
      {isLive && (
        <div
          className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${
            syncMode === 'host'
              ? 'border-violet-300 bg-violet-50'
              : 'border-sky-300 bg-sky-50'
          }`}
        >
          {syncMode === 'host' ? (
            <>
              <Radio className="h-5 w-5 text-violet-600 animate-pulse" />
              <div>
                <p className="text-sm font-bold text-violet-900">Tú controlas el tablero en vivo</p>
                <p className="text-xs text-violet-700">
                  Los alumnos ven los mismos movimientos en tiempo real (actualización cada 2 s).
                </p>
              </div>
            </>
          ) : (
            <>
              <Users className="h-5 w-5 text-sky-600" />
              <div>
                <p className="text-sm font-bold text-sky-900">Modo espectador — tablero sincronizado</p>
                <p className="text-xs text-sky-700">
                  El facilitador mueve el juego. Sigue la videollamada y observa el tablero aquí.
                </p>
              </div>
            </>
          )}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-4">
        <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-center">
          <Coins className="mx-auto h-5 w-5 text-amber-700" />
          <p className="text-[10px] font-bold uppercase text-amber-800 mt-1">Eco-Créditos</p>
          <p className="text-2xl font-black text-amber-900">{state.ecoCredits ?? 500}</p>
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

      <ForgeBoardTrack spaces={spaces} position={pos} />

      {state.currentCard && (
        <div className="rounded-xl border-2 border-amber-300 bg-amber-50 p-4 shadow-sm">
          <p className="text-xs font-bold uppercase text-amber-800">
            Carta actual {state.currentCard.id ? `· ${state.currentCard.id}` : ''}
            {state.currentCard.type ? ` · ${state.currentCard.type}` : ''}
          </p>
          <p className="mt-2 text-base font-semibold text-slate-900">{state.currentCard.prompt}</p>
          {state.currentCard.reflection && (
            <p className="mt-2 text-sm text-amber-900/80">💡 {state.currentCard.reflection}</p>
          )}
          {!readOnly && (
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
          {readOnly && (
            <p className="mt-3 text-sm text-amber-800 italic">
              El facilitador valida las fichas en la sesión en vivo.
            </p>
          )}
        </div>
      )}

      {!state.currentCard && !state.finished && !readOnly && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={loading}
            onClick={() => sendAction({ type: 'roll_dice' })}
            className="rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50"
          >
            🎲 Lanzar dado y avanzar
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => sendAction({ type: 'draw_card' })}
            className="rounded-lg border-2 border-amber-400 bg-amber-100 px-5 py-2.5 text-sm font-semibold text-amber-900 hover:bg-amber-200 disabled:opacity-50"
          >
            🃏 Robar carta de estación
          </button>
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
