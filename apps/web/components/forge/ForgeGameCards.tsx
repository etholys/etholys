'use client';

import { useState } from 'react';
import type { GameSpecV1 } from '@/lib/forge/schemas/game-spec-v1';

export function ForgeGameCards({
  sessionId,
  spec,
  initialState,
  onComplete,
}: {
  sessionId: string;
  spec: GameSpecV1;
  initialState: { hand?: string[]; played?: string[]; finished?: boolean };
  onComplete?: () => void;
}) {
  const [hand, setHand] = useState<string[]>(initialState.hand ?? []);
  const [played, setPlayed] = useState<string[]>(initialState.played ?? []);
  const [msg, setMsg] = useState<string | null>(null);
  const [reflection, setReflection] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(Boolean(initialState.finished));

  const cardMap = Object.fromEntries((spec.cards ?? []).map((c) => [c.id, c]));

  async function act(action: { type: string; payload?: Record<string, unknown> }) {
    setLoading(true);
    try {
      const res = await fetch('/api/forge/game-sessions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const st = data.session?.state as { hand?: string[]; played?: string[]; finished?: boolean };
      if (st?.hand) setHand(st.hand);
      if (st?.played) setPlayed(st.played);
      const m = (data.events ?? []).map((e: { message?: string }) => e.message).filter(Boolean).join(' ');
      if (m) setMsg(m);
      if (data.session?.status === 'completed') {
        setDone(true);
        onComplete?.();
      }
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Erro');
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return <p className="rounded-lg bg-emerald-100 px-4 py-3 text-sm text-emerald-800">Baralho concluído.</p>;
  }

  return (
    <div className="space-y-4 rounded-xl border border-amber-200 bg-amber-50/80 p-5">
      <h3 className="font-bold text-slate-900">{spec.title}</h3>
      <p className="text-xs text-slate-500">Cartas jogadas: {played.length}</p>
      <div className="flex flex-wrap gap-2">
        {hand.map((id) => {
          const c = cardMap[id];
          return (
            <button
              key={id}
              type="button"
              disabled={loading}
              onClick={() => act({ type: 'play_card', payload: { cardId: id } })}
              className="max-w-xs rounded-lg border border-amber-300 bg-white px-3 py-2 text-left text-sm shadow-sm hover:bg-amber-100"
            >
              {c?.prompt ?? id}
            </button>
          );
        })}
      </div>
      <div className="flex gap-2">
        <input
          value={reflection}
          onChange={(e) => setReflection(e.target.value)}
          placeholder="Reflexão final..."
          className="flex-1 rounded border px-2 py-1.5 text-sm"
        />
        <button
          type="button"
          disabled={loading || !reflection.trim()}
          onClick={() => act({ type: 'record_reflection', payload: { text: reflection } })}
          className="rounded bg-amber-600 px-3 py-1.5 text-sm text-white"
        >
          Enviar
        </button>
      </div>
      {msg && <p className="text-sm text-amber-900">{msg}</p>}
    </div>
  );
}
