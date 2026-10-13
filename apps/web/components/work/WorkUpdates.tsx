'use client';

import { useCallback, useEffect, useState } from 'react';

type Comment = {
  id: string;
  content: string;
  createdAt: string;
  user?: { id: string; name: string | null } | null;
};

export function WorkUpdates({
  taskId,
  onPosted,
  t,
}: {
  taskId: string;
  onPosted?: () => void;
  t: (en: string, es: string, pt: string) => string;
}) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/comments?taskId=${encodeURIComponent(taskId)}`);
    const data = await res.json().catch(() => ({}));
    if (res.ok) setComments(data.comments || []);
  }, [taskId]);

  useEffect(() => {
    void load();
  }, [load]);

  const post = async () => {
    const content = text.trim();
    if (!content || busy) return;
    setBusy(true);
    try {
      const res = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId, content }),
      });
      if (res.ok) {
        setText('');
        await load();
        onPosted?.();
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2 bg-slate-50 px-4 py-3" onClick={(e) => e.stopPropagation()}>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
        {t('Updates', 'Actualizaciones', 'Atualizações')}
      </p>
      <ul className="max-h-40 space-y-2 overflow-y-auto">
        {comments.length === 0 && (
          <li className="text-xs text-slate-400">
            {t('No updates yet. Write what changed.', 'Aún no hay actualizaciones.', 'Ainda não há atualizações.')}
          </li>
        )}
        {comments.map((c) => (
          <li key={c.id} className="text-sm text-slate-700">
            <span className="font-semibold text-slate-900">{c.user?.name || t('Someone', 'Alguien', 'Alguém')}</span>
            <span className="ml-2 text-[11px] text-slate-400">
              {new Date(c.createdAt).toLocaleString()}
            </span>
            <p className="whitespace-pre-wrap">{c.content}</p>
          </li>
        ))}
      </ul>
      <div className="flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              void post();
            }
          }}
          placeholder={t('Write an update…', 'Escribe una actualización…', 'Escreve uma atualização…')}
          className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-teal-500"
        />
        <button
          type="button"
          disabled={busy || !text.trim()}
          onClick={() => void post()}
          className="rounded-lg bg-teal-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-800 disabled:opacity-40"
        >
          {t('Post', 'Publicar', 'Publicar')}
        </button>
      </div>
    </div>
  );
}
