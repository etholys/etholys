'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

type Comment = {
  id: string;
  content: string;
  createdAt: string;
  user?: { id: string; name: string | null } | null;
};

type UserOpt = { id: string; name: string | null; email?: string };

export function WorkUpdates({
  taskId,
  users = [],
  onPosted,
  t,
}: {
  taskId: string;
  users?: UserOpt[];
  onPosted?: () => void;
  t: (en: string, es: string, pt: string) => string;
}) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/comments?taskId=${encodeURIComponent(taskId)}`);
    const data = await res.json().catch(() => ({}));
    if (res.ok) setComments(data.comments || []);
  }, [taskId]);

  useEffect(() => {
    void load();
  }, [load]);

  const mentionSuggestions = useMemo(() => {
    if (mentionQuery == null) return [];
    const q = mentionQuery.toLowerCase();
    return users
      .filter((u) => {
        const label = `${u.name || ''} ${u.email || ''}`.toLowerCase();
        return !q || label.includes(q);
      })
      .slice(0, 6);
  }, [mentionQuery, users]);

  const onTextChange = (value: string) => {
    setText(value);
    const at = value.lastIndexOf('@');
    if (at < 0) {
      setMentionQuery(null);
      return;
    }
    const after = value.slice(at + 1);
    if (/\s/.test(after)) {
      setMentionQuery(null);
      return;
    }
    setMentionQuery(after);
  };

  const pickMention = (u: UserOpt) => {
    const at = text.lastIndexOf('@');
    if (at < 0) return;
    const label = u.name || u.email || 'user';
    setText(`${text.slice(0, at)}@${label} `);
    setMentionQuery(null);
  };

  const renderBody = (content: string) => {
    const parts = String(content || '').split(/(@[^\s@][^@]*?)(?=\s|$|@)/g);
    return parts.map((part, i) =>
      part.startsWith('@') ? (
        <span key={i} className="rounded bg-teal-500/20 px-1 font-medium text-teal-700 dark:text-teal-200">
          {part}
        </span>
      ) : (
        <span key={i}>{part}</span>
      ),
    );
  };

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
        setMentionQuery(null);
        await load();
        onPosted?.();
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="space-y-2 bg-[color:var(--sys-panel-soft)] px-4 py-3"
      onClick={(e) => e.stopPropagation()}
    >
      <p className="text-[11px] font-semibold uppercase tracking-wide text-[color:var(--sys-muted)]">
        {t('Updates', 'Actualizaciones', 'Atualizações')}
      </p>
      <ul className="max-h-40 space-y-2 overflow-y-auto">
        {comments.length === 0 && (
          <li className="text-xs text-[color:var(--sys-faint)]">
            {t(
              'No updates yet. Write @name to tag someone.',
              'Aún no hay actualizaciones. Escribe @nombre para etiquetar.',
              'Ainda não há atualizações. Escreve @nome para etiquetar.',
            )}
          </li>
        )}
        {comments.map((c) => (
          <li key={c.id} className="text-sm text-[color:var(--sys-ink)]">
            <span className="font-semibold">{c.user?.name || t('Someone', 'Alguien', 'Alguém')}</span>
            <span className="ml-2 text-[11px] text-[color:var(--sys-faint)]">
              {new Date(c.createdAt).toLocaleString()}
            </span>
            <p className="whitespace-pre-wrap">{renderBody(c.content)}</p>
          </li>
        ))}
      </ul>
      <div className="relative">
        <div className="flex gap-2">
          <input
            value={text}
            onChange={(e) => onTextChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void post();
              }
            }}
            placeholder={t(
              'Write an update… @name',
              'Escribe una actualización… @nombre',
              'Escreve uma atualização… @nome',
            )}
            className="etask-field min-w-0 flex-1 rounded-lg border border-[color:var(--sys-line)] bg-[color:var(--sys-panel)] px-2.5 py-1.5 text-sm text-[color:var(--sys-ink)] outline-none focus:border-teal-500"
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
        {mentionSuggestions.length > 0 && (
          <ul className="absolute left-0 right-12 z-20 mt-1 overflow-hidden rounded-lg border border-[color:var(--sys-line)] bg-[color:var(--sys-panel)] shadow-lg">
            {mentionSuggestions.map((u) => (
              <li key={u.id}>
                <button
                  type="button"
                  onClick={() => pickMention(u)}
                  className="w-full px-3 py-2 text-left text-sm text-[color:var(--sys-ink)] hover:bg-[color:var(--sys-nav-hover)]"
                >
                  {u.name || u.email}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
