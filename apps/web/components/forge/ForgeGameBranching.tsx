'use client';

import { useState } from 'react';
import type { GameSpecV1 } from '@/lib/forge/schemas/game-spec-v1';

type Branch = {
  id: string;
  prompt: string;
  choices: { id: string; label: string; nextId: string; feedback?: string }[];
};

function branchesFromSpec(spec: GameSpecV1): Branch[] {
  const b = (spec as GameSpecV1 & { branches?: Branch[] }).branches;
  if (b?.length) return b;
  return (spec.cards ?? []).map((c) => ({
    id: c.id,
    prompt: c.prompt,
    choices: [{ id: `${c.id}-go`, label: 'Continuar', nextId: 'end', feedback: c.reflection }],
  }));
}

export function ForgeGameBranching({
  sessionId,
  spec,
  initialState,
  onComplete,
}: {
  sessionId: string;
  spec: GameSpecV1;
  initialState: { nodeId?: string; finished?: boolean };
  onComplete?: () => void;
}) {
  const branches = branchesFromSpec(spec);
  const [nodeId, setNodeId] = useState(initialState.nodeId ?? branches[0]?.id ?? '');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(Boolean(initialState.finished));

  const node = branches.find((b) => b.id === nodeId) ?? branches[0];

  async function choose(choiceId: string) {
    setLoading(true);
    try {
      const res = await fetch('/api/forge/game-sessions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, action: { type: 'choose', payload: { choiceId } } }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const st = data.session?.state as { nodeId?: string; finished?: boolean };
      if (st?.nodeId) setNodeId(st.nodeId);
      const ev = (data.events ?? []).find((e: { message?: string }) => e.message);
      if (ev?.message) setFeedback(ev.message);
      if (data.session?.status === 'completed') {
        setDone(true);
        onComplete?.();
      }
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return <p className="rounded-lg bg-emerald-100 px-4 py-3 text-sm text-emerald-800">Simulação concluída.</p>;
  }

  if (!node) return <p className="text-sm text-slate-500">Cenário sem ramos.</p>;

  return (
    <div className="space-y-4 rounded-xl border border-teal-200 bg-teal-50/80 p-5">
      <h3 className="font-bold text-slate-900">{spec.title}</h3>
      <p className="text-slate-800">{node.prompt}</p>
      <div className="space-y-2">
        {node.choices.map((ch) => (
          <button
            key={ch.id}
            type="button"
            disabled={loading}
            onClick={() => choose(ch.id)}
            className="block w-full rounded-lg border border-teal-200 bg-white px-4 py-3 text-left text-sm hover:bg-teal-50"
          >
            {ch.label}
          </button>
        ))}
      </div>
      {feedback && <p className="text-sm text-teal-800 italic">{feedback}</p>}
    </div>
  );
}
