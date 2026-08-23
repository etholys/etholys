'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Calendar, Check, Loader2, MessageSquare, Video } from 'lucide-react';
import { AT_CASE_KIND_LABELS, AT_STATUS_LABELS, type AtCaseKind } from '@/lib/nexus-at-shared';

export type AtCaseCardModel = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  dueDate?: string | null;
  createdAt: string;
  companyId: string | null;
  caseKind: string;
  projectId?: string | null;
  engagementId?: string | null;
  isOpen?: boolean;
  serviceTitle?: string | null;
  projectName?: string | null;
  companyLabel?: string | null;
  assignee: { id: string; name: string | null; email: string } | null;
};

type CommentRow = {
  id: string;
  content: string;
  createdAt: string;
  user: { id: string; name: string | null; email: string } | null;
};

const STATUSES = ['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE', 'CANCELLED'];
const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

type Props = {
  caseItem: AtCaseCardModel;
  onUpdated?: (c: AtCaseCardModel) => void;
  showServiceLink?: boolean;
};

export function NexusAtCaseCard({ caseItem, onUpdated, showServiceLink }: Props) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [draftDesc, setDraftDesc] = useState(caseItem.description || '');
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [commentText, setCommentText] = useState('');
  const [loadingComments, setLoadingComments] = useState(false);

  const kind = (caseItem.caseKind || 'other') as AtCaseKind;
  const kindLabel = AT_CASE_KIND_LABELS[kind]?.pt || caseItem.caseKind;
  const overdue =
    caseItem.dueDate &&
    caseItem.isOpen !== false &&
    !['DONE', 'CANCELLED'].includes(caseItem.status) &&
    new Date(caseItem.dueDate).getTime() < Date.now();

  useEffect(() => {
    if (!expanded) return;
    let cancelled = false;
    (async () => {
      setLoadingComments(true);
      try {
        const r = await fetch(`/api/nexus/at/cases/${encodeURIComponent(caseItem.id)}/comments`);
        const d = await r.json();
        if (!cancelled && r.ok) setComments(d.comments || []);
      } catch {
        /* ignore */
      } finally {
        if (!cancelled) setLoadingComments(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [expanded, caseItem.id]);

  const patch = async (body: Record<string, unknown>) => {
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch(`/api/nexus/at/cases/${encodeURIComponent(caseItem.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Falha ao atualizar');
      onUpdated?.(d.case);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Erro');
    } finally {
      setBusy(false);
    }
  };

  const postComment = async () => {
    if (!commentText.trim()) return;
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch(`/api/nexus/at/cases/${encodeURIComponent(caseItem.id)}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: commentText.trim() }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Falha ao comentar');
      setComments((prev) => [...prev, d.comment]);
      setCommentText('');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Erro');
    } finally {
      setBusy(false);
    }
  };

  const startMeet = async () => {
    if (!caseItem.companyId) {
      setMsg('Caso sem empresa.');
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch('/api/meet/nexus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId: caseItem.companyId,
          title: `AT · ${caseItem.title}`.slice(0, 120),
          description: caseItem.description || undefined,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Falha Meet');
      const url = d.joinPath || d.meetingUrl || d.joinUrl || d.url;
      if (url) {
        const href = String(url).startsWith('/') ? `${window.location.origin}${url}` : String(url);
        window.open(href, '_blank', 'noopener,noreferrer');
      } else setMsg('Sala criada — abre Meet no Hub.');
      await patch({ status: 'IN_PROGRESS', take: true });
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Erro Meet');
      setBusy(false);
    }
  };

  return (
    <div
      className={`rounded-xl border bg-white p-4 shadow-sm ${
        overdue ? 'border-amber-300' : 'border-gray-200'
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-medium text-gray-900">{caseItem.title}</p>
          <p className="mt-1 text-xs text-gray-500">
            {kindLabel}
            {caseItem.companyLabel ? ` · ${caseItem.companyLabel}` : ''}
            {caseItem.projectName ? ` · ${caseItem.projectName}` : ''}
            {caseItem.dueDate && (
              <span className={overdue ? ' text-amber-800 font-medium' : ''}>
                {' · '}
                <Calendar className="inline h-3 w-3" />{' '}
                {new Date(caseItem.dueDate).toLocaleDateString('pt-PT')}
                {overdue ? ' (atrasado)' : ''}
              </span>
            )}
          </p>
          {showServiceLink && caseItem.engagementId && (
            <Link
              href={`/hub/nexus/at/${caseItem.engagementId}`}
              className="mt-1 inline-block text-xs font-medium text-violet-700 hover:underline"
            >
              {caseItem.serviceTitle || 'Abrir serviço'} →
            </Link>
          )}
        </div>
        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700">
          {AT_STATUS_LABELS[caseItem.status] || caseItem.status}
        </span>
      </div>

      {caseItem.description && !expanded && (
        <p className="mt-2 line-clamp-2 text-sm text-gray-600">{caseItem.description}</p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <select
          disabled={busy}
          value={caseItem.status}
          onChange={(e) => patch({ status: e.target.value })}
          className="rounded-lg border border-gray-200 px-2 py-1 text-xs"
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {AT_STATUS_LABELS[s] || s}
            </option>
          ))}
        </select>
        <select
          disabled={busy}
          value={caseItem.priority}
          onChange={(e) => patch({ priority: e.target.value })}
          className="rounded-lg border border-gray-200 px-2 py-1 text-xs"
        >
          {PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <input
          type="date"
          disabled={busy}
          value={caseItem.dueDate ? new Date(caseItem.dueDate).toISOString().slice(0, 10) : ''}
          onChange={(e) => patch({ dueDate: e.target.value || null })}
          className="rounded-lg border border-gray-200 px-2 py-1 text-xs"
        />
        {caseItem.status !== 'DONE' && (
          <button
            type="button"
            disabled={busy}
            onClick={() => patch({ status: 'DONE' })}
            className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2 py-1 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            <Check className="h-3 w-3" /> Concluir
          </button>
        )}
        {caseItem.status === 'TODO' && (
          <button
            type="button"
            disabled={busy}
            onClick={() => patch({ take: true })}
            className="rounded-lg border border-violet-200 bg-violet-50 px-2 py-1 text-xs font-semibold text-violet-900 disabled:opacity-50"
          >
            Assumir
          </button>
        )}
        {(kind === 'call' || kind === 'followup') && caseItem.companyId && (
          <button
            type="button"
            disabled={busy}
            onClick={startMeet}
            className="inline-flex items-center gap-1 rounded-lg border border-sky-200 bg-sky-50 px-2 py-1 text-xs font-semibold text-sky-900 disabled:opacity-50"
          >
            <Video className="h-3 w-3" /> Meet
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            setExpanded((v) => !v);
            setDraftDesc(caseItem.description || '');
          }}
          className="inline-flex items-center gap-1 text-xs text-gray-500 hover:underline"
        >
          <MessageSquare className="h-3 w-3" />
          {expanded ? 'Fechar' : 'Notas / chat'}
        </button>
        {busy && <Loader2 className="h-3.5 w-3.5 animate-spin text-violet-600" />}
      </div>

      {expanded && (
        <div className="mt-3 space-y-3 border-t border-gray-100 pt-3">
          <div className="space-y-2">
            <p className="text-xs font-medium text-gray-500">Notas do caso</p>
            <textarea
              value={draftDesc}
              onChange={(e) => setDraftDesc(e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              placeholder="Resumo / contexto do atendimento…"
            />
            <button
              type="button"
              disabled={busy}
              onClick={() => patch({ description: draftDesc })}
              className="rounded-lg bg-violet-700 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
            >
              Guardar notas
            </button>
            {caseItem.assignee?.name && (
              <p className="text-xs text-gray-500">Responsável: {caseItem.assignee.name}</p>
            )}
          </div>

          <div className="space-y-2">
            <p className="text-xs font-medium text-gray-500">Thread de acompanhamento</p>
            {loadingComments ? (
              <p className="text-xs text-gray-400">A carregar…</p>
            ) : comments.length === 0 ? (
              <p className="text-xs text-gray-400">Sem comentários ainda.</p>
            ) : (
              <ul className="max-h-48 space-y-2 overflow-y-auto">
                {comments.map((c) => (
                  <li key={c.id} className="rounded-lg bg-gray-50 px-3 py-2 text-sm">
                    <p className="text-xs text-gray-500">
                      {c.user?.name || c.user?.email || 'Utilizador'} ·{' '}
                      {new Date(c.createdAt).toLocaleString('pt-PT')}
                    </p>
                    <p className="mt-0.5 whitespace-pre-wrap text-gray-800">{c.content}</p>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex gap-2">
              <input
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    postComment();
                  }
                }}
                className="min-w-0 flex-1 rounded-lg border border-gray-200 px-3 py-1.5 text-sm"
                placeholder="Escrever atualização…"
              />
              <button
                type="button"
                disabled={busy || !commentText.trim()}
                onClick={postComment}
                className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-900 disabled:opacity-50"
              >
                Enviar
              </button>
            </div>
          </div>
        </div>
      )}

      {msg && <p className="mt-2 text-xs text-red-700">{msg}</p>}
    </div>
  );
}
