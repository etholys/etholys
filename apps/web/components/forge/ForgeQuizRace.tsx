'use client';

import { useState } from 'react';
import type { GameSpecV1 } from '@/lib/forge/schemas/game-spec-v1';

export function ForgeQuizRace({
  sessionId,
  spec,
  initialState,
  onComplete,
}: {
  sessionId: string;
  spec: GameSpecV1;
  initialState: Record<string, unknown>;
  onComplete?: () => void;
}) {
  const questions = spec.questions ?? [];
  const idx = typeof initialState.index === 'number' ? initialState.index : 0;
  const [current, setCurrent] = useState(idx);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(Boolean(initialState.finished));

  const q = questions[current];

  async function answer(optionIndex: number) {
    if (!q || loading || done) return;
    setLoading(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/forge/game-sessions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          action: { type: 'answer', payload: { index: optionIndex } },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro');

      const last = (data.events ?? []).find((e: { type: string }) => e.type === 'correct' || e.type === 'incorrect');
      setFeedback(last?.message ?? (last?.type === 'correct' ? 'Correto!' : 'Tente outra vez na próxima.'));

      if (data.session?.status === 'completed') {
        setDone(true);
        onComplete?.();
      } else {
        setCurrent((data.session?.state as { index?: number })?.index ?? current + 1);
      }
    } catch (e) {
      setFeedback(e instanceof Error ? e.message : 'Erro');
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <p className="rounded-lg bg-emerald-100 px-4 py-3 text-sm font-medium text-emerald-800">
        Quiz concluído — progresso registado.
      </p>
    );
  }

  if (!q) {
    return <p className="text-sm text-slate-500">Sem perguntas no GameSpec.</p>;
  }

  return (
    <div className="space-y-4 rounded-xl border border-indigo-200 bg-gradient-to-br from-indigo-50 to-violet-50 p-5">
      <div>
        <p className="text-xs font-semibold uppercase text-indigo-600">Quiz race</p>
        <h3 className="text-lg font-bold text-slate-900">{spec.title}</h3>
        <p className="text-sm text-slate-500">
          Pergunta {current + 1} de {questions.length}
        </p>
      </div>
      <p className="font-medium text-slate-900">{q.prompt}</p>
      <div className="space-y-2">
        {q.options.map((opt, i) => (
          <button
            key={i}
            type="button"
            disabled={loading}
            onClick={() => answer(i)}
            className="block w-full rounded-lg border border-white bg-white px-4 py-3 text-left text-sm shadow-sm hover:border-indigo-300 hover:bg-indigo-50 disabled:opacity-50"
          >
            {opt}
          </button>
        ))}
      </div>
      {feedback && <p className="text-sm text-indigo-800">{feedback}</p>}
    </div>
  );
}
