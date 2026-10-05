'use client';

import { useCallback, useEffect, useState } from 'react';
import { useApp } from '@/app/providers';
import { cn, isLikelyDbId } from '@/lib/utils';
import { Loader2, MessageSquare, Send } from 'lucide-react';

type CommentRow = {
  id: string;
  content: string;
  createdAt: string;
  author: string;
};

export function ProposalReviewPanel({
  workspaceId,
  tone = 'light',
}: {
  workspaceId: string;
  /** Match FundHub shell sidebar (dark). */
  tone?: 'light' | 'shell';
}) {
  const { locale, activeCompanyId } = useApp();
  const companyId = String(activeCompanyId ?? '').trim();
  const ok = isLikelyDbId(companyId) && Boolean(workspaceId);
  const t = (pt: string, es: string, en: string) =>
    locale === 'pt' ? pt : locale === 'es' ? es : en;
  const shell = tone === 'shell';

  const [comments, setComments] = useState<CommentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [text, setText] = useState('');

  const load = useCallback(async () => {
    if (!ok) return;
    setLoading(true);
    try {
      const r = await fetch(
        `/api/fundhub/proposals/comments?companyId=${encodeURIComponent(companyId)}&workspaceId=${encodeURIComponent(workspaceId)}`,
        { cache: 'no-store' },
      );
      const d = (await r.json()) as { comments?: CommentRow[] };
      if (r.ok) setComments(d.comments ?? []);
    } finally {
      setLoading(false);
    }
  }, [ok, companyId, workspaceId]);

  useEffect(() => {
    void load();
  }, [load]);

  const send = async () => {
    if (!ok || !text.trim()) return;
    setSending(true);
    try {
      const r = await fetch(
        `/api/fundhub/proposals/comments?companyId=${encodeURIComponent(companyId)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ workspaceId, content: text.trim() }),
        },
      );
      const d = (await r.json()) as { comment?: CommentRow };
      if (r.ok && d.comment) {
        setComments((prev) => [d.comment!, ...prev]);
        setText('');
      }
    } finally {
      setSending(false);
    }
  };

  if (!ok) return null;

  return (
    <div
      className={cn(
        'rounded-xl px-3 py-3',
        shell
          ? 'border border-white/10 bg-white/[0.04]'
          : 'border border-gray-200 bg-white px-4',
      )}
    >
      <div className="flex items-center gap-2">
        <MessageSquare className={cn('h-4 w-4', shell ? 'text-amber-300' : 'text-amber-700')} />
        <p className={cn('text-xs font-semibold', shell ? 'text-white' : 'text-gray-900')}>
          {t('Revisão / comentários', 'Revisión / comentarios', 'Review / comments')}
        </p>
      </div>
      <div className="mt-2 flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void send();
          }}
          placeholder={t('Nota para a equipa…', 'Nota para el equipo…', 'Note for the team…')}
          className={cn(
            'min-w-0 flex-1 rounded-lg px-3 py-1.5 text-xs outline-none',
            shell
              ? 'border border-white/10 bg-white/[0.04] text-white placeholder:text-white/40 focus:border-amber-400/40'
              : 'border border-gray-200',
          )}
        />
        <button
          type="button"
          disabled={sending || !text.trim()}
          onClick={() => void send()}
          className={cn(
            'inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium disabled:opacity-50',
            shell
              ? 'bg-amber-500/20 text-amber-100 hover:bg-amber-500/30'
              : 'bg-gray-900 text-white',
          )}
        >
          {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
        </button>
      </div>
      {loading ? (
        <p className={cn('mt-2 text-xs', shell ? 'text-white/40' : 'text-gray-400')}>…</p>
      ) : (
        <ul className="mt-2 max-h-36 space-y-1.5 overflow-y-auto">
          {comments.length === 0 ? (
            <li className={cn('py-2 text-center text-xs', shell ? 'text-white/40' : 'text-gray-400')}>
              {t('Sem comentários ainda.', 'Sin comentarios aún.', 'No comments yet.')}
            </li>
          ) : (
            comments.map((c) => (
              <li
                key={c.id}
                className={cn(
                  'rounded-lg px-2.5 py-1.5 text-xs',
                  shell ? 'bg-white/[0.06]' : 'bg-gray-50',
                )}
              >
                <p className={cn('font-medium', shell ? 'text-amber-100' : 'text-gray-800')}>{c.author}</p>
                <p className={cn('whitespace-pre-wrap', shell ? 'text-white/80' : 'text-gray-700')}>
                  {c.content}
                </p>
                <p className={cn('mt-0.5 text-[10px]', shell ? 'text-white/35' : 'text-gray-400')}>
                  {new Date(c.createdAt).toLocaleString(
                    locale === 'pt' ? 'pt-PT' : locale === 'es' ? 'es-ES' : 'en-US',
                  )}
                </p>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
