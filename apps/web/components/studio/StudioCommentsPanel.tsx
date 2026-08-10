'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, MessageSquare, Check, RotateCcw, Trash2, X } from 'lucide-react';

export type StudioCommentRow = {
  id: string;
  body: string;
  blockId: string | null;
  createdAt: string;
  resolvedAt: string | null;
  author?: { id: string; name: string | null; email: string } | null;
};

type Props = {
  documentId: string;
  locale: string;
  open: boolean;
  onClose: () => void;
  /** Pré-selecionar bloco ao abrir */
  focusBlockId?: string | null;
  blockTitles?: Record<string, string>;
  onCountChange?: (openCount: number) => void;
};

export function StudioCommentsPanel({
  documentId,
  locale,
  open,
  onClose,
  focusBlockId,
  blockTitles = {},
  onCountChange,
}: Props) {
  const t = (pt: string, es: string, en: string) => (locale === 'pt' ? pt : locale === 'es' ? es : en);
  const [comments, setComments] = useState<StudioCommentRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [showResolved, setShowResolved] = useState(false);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [blockId, setBlockId] = useState<string | null>(focusBlockId || null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const q = showResolved ? '?resolved=1' : '';
      const r = await fetch(`/api/studio/documents/${documentId}/comments${q}`, {
        cache: 'no-store',
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Error');
      setComments(d.comments || []);
      if (typeof d.openCount === 'number') onCountChange?.(d.openCount);
      else onCountChange?.((d.comments || []).filter((c: StudioCommentRow) => !c.resolvedAt).length);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setLoading(false);
    }
  }, [documentId, showResolved, onCountChange]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  useEffect(() => {
    if (focusBlockId) setBlockId(focusBlockId);
  }, [focusBlockId]);

  async function submit() {
    const text = draft.trim();
    if (!text) return;
    setBusy(true);
    setError(null);
    try {
      const r = await fetch(`/api/studio/documents/${documentId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: text, blockId: blockId || undefined }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Error');
      setDraft('');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setBusy(false);
    }
  }

  async function resolve(id: string, resolveFlag: boolean) {
    setBusy(true);
    try {
      const r = await fetch(`/api/studio/documents/${documentId}/comments`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, resolve: resolveFlag }),
      });
      if (!r.ok) {
        const d = await r.json();
        throw new Error(d.error || 'Error');
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!confirm(t('Apagar comentário?', '¿Borrar comentario?', 'Delete comment?'))) return;
    setBusy(true);
    try {
      const r = await fetch(
        `/api/studio/documents/${documentId}/comments?commentId=${encodeURIComponent(id)}`,
        { method: 'DELETE' },
      );
      if (!r.ok) {
        const d = await r.json();
        throw new Error(d.error || 'Error');
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex justify-end bg-black/30">
      <button type="button" className="flex-1" aria-label="Close" onClick={onClose} />
      <aside className="flex h-full w-full max-w-md flex-col bg-white shadow-2xl">
        <header className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-violet-600" />
            <h3 className="font-bold text-slate-900">
              {t('Comentários', 'Comentarios', 'Comments')}
            </h3>
          </div>
          <button type="button" onClick={onClose} className="rounded p-1 text-slate-500 hover:bg-slate-100">
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-2">
          <button
            type="button"
            onClick={() => setShowResolved(false)}
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              !showResolved ? 'bg-violet-100 text-violet-900' : 'text-slate-500'
            }`}
          >
            {t('Abertos', 'Abiertos', 'Open')}
          </button>
          <button
            type="button"
            onClick={() => setShowResolved(true)}
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              showResolved ? 'bg-violet-100 text-violet-900' : 'text-slate-500'
            }`}
          >
            {t('Todos', 'Todos', 'All')}
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3">
          {loading ? (
            <div className="flex justify-center py-8 text-slate-400">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : comments.length === 0 ? (
            <p className="text-sm text-slate-500">
              {t(
                'Ainda sem comentários. Deixe feedback para a equipa.',
                'Aún sin comentarios. Deje feedback para el equipo.',
                'No comments yet. Leave feedback for the team.',
              )}
            </p>
          ) : (
            comments.map((c) => {
              const who = c.author?.name?.trim() || c.author?.email || '—';
              const blockLabel = c.blockId
                ? blockTitles[c.blockId] || c.blockId.slice(0, 8)
                : t('Documento', 'Documento', 'Document');
              return (
                <article
                  key={c.id}
                  className={`rounded-xl border px-3 py-2.5 text-sm ${
                    c.resolvedAt ? 'border-slate-100 bg-slate-50 opacity-70' : 'border-violet-100 bg-violet-50/40'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                        {who} · {new Date(c.createdAt).toLocaleString(locale === 'en' ? 'en' : locale)}
                      </p>
                      <p className="mt-0.5 text-[10px] text-violet-700">@{blockLabel}</p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      {!c.resolvedAt ? (
                        <button
                          type="button"
                          disabled={busy}
                          title={t('Resolver', 'Resolver', 'Resolve')}
                          onClick={() => void resolve(c.id, true)}
                          className="rounded p-1 text-emerald-700 hover:bg-emerald-50"
                        >
                          <Check className="h-3.5 w-3.5" />
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={busy}
                          title={t('Reabrir', 'Reabrir', 'Reopen')}
                          onClick={() => void resolve(c.id, false)}
                          className="rounded p-1 text-slate-600 hover:bg-slate-100"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={busy}
                        title={t('Apagar', 'Borrar', 'Delete')}
                        onClick={() => void remove(c.id)}
                        className="rounded p-1 text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  <p className="mt-1.5 whitespace-pre-wrap text-slate-800">{c.body}</p>
                </article>
              );
            })
          )}
        </div>

        <footer className="border-t border-slate-200 p-4">
          {error && <p className="mb-2 text-xs text-red-600">{error}</p>}
          {blockId && (
            <p className="mb-1 text-[10px] text-violet-700">
              {t('No bloco', 'En el bloque', 'On block')}: {blockTitles[blockId] || blockId.slice(0, 10)}
              <button type="button" className="ml-2 underline" onClick={() => setBlockId(null)}>
                {t('geral', 'general', 'general')}
              </button>
            </p>
          )}
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={3}
            placeholder={t('Escrever comentário…', 'Escribir comentario…', 'Write a comment…')}
            className="w-full resize-y rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-violet-400"
          />
          <button
            type="button"
            disabled={busy || !draft.trim()}
            onClick={() => void submit()}
            className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-violet-600 px-3 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquare className="h-4 w-4" />}
            {t('Comentar', 'Comentar', 'Comment')}
          </button>
        </footer>
      </aside>
    </div>
  );
}
