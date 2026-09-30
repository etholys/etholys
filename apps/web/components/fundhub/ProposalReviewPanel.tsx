'use client';

import { useCallback, useEffect, useState } from 'react';
import { useApp } from '@/app/providers';
import { isLikelyDbId } from '@/lib/utils';
import { Loader2, MessageSquare, Send } from 'lucide-react';

type CommentRow = {
  id: string;
  content: string;
  createdAt: string;
  author: string;
};

export function ProposalReviewPanel({ workspaceId }: { workspaceId: string }) {
  const { locale, activeCompanyId } = useApp();
  const companyId = String(activeCompanyId ?? '').trim();
  const ok = isLikelyDbId(companyId) && Boolean(workspaceId);
  const t = (pt: string, es: string, en: string) =>
    locale === 'pt' ? pt : locale === 'es' ? es : en;

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
    <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
      <div className="flex items-center gap-2">
        <MessageSquare className="h-4 w-4 text-amber-700" />
        <p className="text-xs font-semibold text-gray-900">
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
          className="min-w-0 flex-1 rounded-lg border border-gray-200 px-3 py-1.5 text-xs"
        />
        <button
          type="button"
          disabled={sending || !text.trim()}
          onClick={() => void send()}
          className="inline-flex items-center gap-1 rounded-lg bg-gray-900 px-2.5 py-1.5 text-xs font-medium text-white disabled:opacity-50"
        >
          {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
        </button>
      </div>
      {loading ? (
        <p className="mt-2 text-xs text-gray-400">…</p>
      ) : (
        <ul className="mt-2 max-h-36 space-y-1.5 overflow-y-auto">
          {comments.length === 0 ? (
            <li className="py-2 text-center text-xs text-gray-400">
              {t('Sem comentários ainda.', 'Sin comentarios aún.', 'No comments yet.')}
            </li>
          ) : (
            comments.map((c) => (
              <li key={c.id} className="rounded-lg bg-gray-50 px-2.5 py-1.5 text-xs">
                <p className="font-medium text-gray-800">{c.author}</p>
                <p className="text-gray-700 whitespace-pre-wrap">{c.content}</p>
                <p className="mt-0.5 text-[10px] text-gray-400">
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
