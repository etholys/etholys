'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Lock, Share2, Trash2, Users, Mail } from 'lucide-react';
import { useApp } from '@/app/providers';

type ShareRow = {
  id: string;
  email: string;
  role: string;
  accessMode: string;
  acceptedAt: string | null;
  user?: { id: string; name: string } | null;
};

type MemberRow = { userId: string; name: string; email: string };

type Props = {
  companyId: string;
  folderId?: string | null;
  documentId?: string | null;
  title: string;
  open: boolean;
  onClose: () => void;
  onVisibilityChange?: (visibility: 'private' | 'company') => void;
};

export function StudioShareDialog({
  companyId,
  folderId,
  documentId,
  title,
  open,
  onClose,
  onVisibilityChange,
}: Props) {
  const { locale } = useApp();
  const t = (pt: string, es: string, en: string) => (locale === 'pt' ? pt : locale === 'es' ? es : en);

  const [shares, setShares] = useState<ShareRow[]>([]);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'viewer' | 'editor'>('viewer');
  const [asExternal, setAsExternal] = useState(false);
  const [visibility, setVisibility] = useState<'private' | 'company'>('private');
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!open || !companyId) return;
    setLoading(true);
    setMsg(null);
    try {
      const q = new URLSearchParams({ companyId });
      if (folderId) q.set('folderId', folderId);
      if (documentId) q.set('documentId', documentId);
      const [sr, mr] = await Promise.all([
        fetch(`/api/studio/shares?${q}`),
        fetch(`/api/studio/shares?companyId=${encodeURIComponent(companyId)}&members=1`),
      ]);
      const sd = await sr.json();
      const md = await mr.json();
      if (sr.ok) {
        setShares(sd.shares || []);
        setVisibility(sd.visibility === 'company' ? 'company' : 'private');
      }
      if (mr.ok) setMembers(md.members || []);
    } catch {
      setMsg('Erro ao carregar');
    } finally {
      setLoading(false);
    }
  }, [open, companyId, folderId, documentId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function shareWith(targetEmail: string, forceExternal?: boolean) {
    if (!targetEmail.trim()) return;
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch('/api/studio/shares', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          folderId: folderId || undefined,
          documentId: documentId || undefined,
          email: targetEmail.trim(),
          role,
          forceExternal: forceExternal ?? asExternal,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`);
      setMsg(
        d.emailSent
          ? t('Convite enviado por email.', 'Invitación enviada por email.', 'Invite emailed.')
          : t(
              `Partilha criada. Link: ${d.inviteUrl}`,
              `Compartido. Enlace: ${d.inviteUrl}`,
              `Share created. Link: ${d.inviteUrl}`,
            ),
      );
      setEmail('');
      await load();
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : 'Erro');
    } finally {
      setBusy(false);
    }
  }

  async function changeVisibility(next: 'private' | 'company') {
    if (next === visibility) return;
    if (
      next === 'company' &&
      !confirm(
        t(
          'Confirmas? Qualquer membro da empresa vai poder abrir e editar isto.',
          '¿Confirmas? Cualquier miembro de la empresa podrá abrir y editar esto.',
          'Confirm? Any company member will be able to open and edit this.',
        ),
      )
    ) {
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const r = folderId
        ? await fetch('/api/studio/folders', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: folderId, companyId, visibility: next }),
          })
        : await fetch(`/api/studio/documents/${documentId}?companyId=${encodeURIComponent(companyId)}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ visibility: next }),
          });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        throw new Error(d.error || `HTTP ${r.status}`);
      }
      setVisibility(next);
      onVisibilityChange?.(next);
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : 'Erro');
    } finally {
      setBusy(false);
    }
  }

  async function revoke(id: string) {
    if (!confirm(t('Revogar acesso?', '¿Revocar acceso?', 'Revoke access?'))) return;
    setBusy(true);
    try {
      const r = await fetch(
        `/api/studio/shares?id=${encodeURIComponent(id)}&companyId=${encodeURIComponent(companyId)}`,
        { method: 'DELETE' },
      );
      if (!r.ok) {
        const d = await r.json();
        throw new Error(d.error || 'Erro');
      }
      await load();
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : 'Erro');
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-xl">
        <div className="sticky top-0 flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
              <Share2 className="h-5 w-5 text-orange-600" />
              {t('Partilhar', 'Compartir', 'Share')}
            </h2>
            <p className="mt-0.5 truncate text-xs text-slate-500">{title}</p>
          </div>
          <button type="button" onClick={onClose} className="text-sm text-slate-500 hover:text-slate-800">
            {t('Fechar', 'Cerrar', 'Close')}
          </button>
        </div>

        <div className="space-y-4 p-5">
          <div className="rounded-xl border border-slate-200 p-3">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <Lock className="h-3.5 w-3.5" />
              {t('Quem pode ver', 'Quién puede ver', 'Who can see')}
            </p>
            <div className="space-y-2">
              <label className="flex items-start gap-2 text-sm text-slate-700">
                <input
                  type="radio"
                  className="mt-1"
                  checked={visibility === 'private'}
                  disabled={busy}
                  onChange={() => void changeVisibility('private')}
                />
                <span>
                  <span className="font-medium text-slate-900">
                    {t('Privado', 'Privado', 'Private')}
                  </span>
                  <span className="block text-xs text-slate-500">
                    {t(
                      'Só eu e quem eu convidar abaixo.',
                      'Solo yo y quien invite abajo.',
                      'Only me and the people I invite below.',
                    )}
                  </span>
                </span>
              </label>
              <label className="flex items-start gap-2 text-sm text-slate-700">
                <input
                  type="radio"
                  className="mt-1"
                  checked={visibility === 'company'}
                  disabled={busy}
                  onChange={() => void changeVisibility('company')}
                />
                <span>
                  <span className="font-medium text-slate-900">
                    {t('Toda a empresa', 'Toda la empresa', 'Whole company')}
                  </span>
                  <span className="block text-xs text-slate-500">
                    {t(
                      'Qualquer membro da empresa vê e edita — não usar com informação sensível.',
                      'Cualquier miembro de la empresa ve y edita — no usar con información sensible.',
                      'Any company member can view and edit — not for sensitive information.',
                    )}
                  </span>
                </span>
              </label>
            </div>
          </div>

          <div className="flex gap-2">
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as 'viewer' | 'editor')}
              className="rounded-lg border border-slate-200 px-2 py-2 text-sm"
            >
              <option value="viewer">{t('Só ler', 'Solo leer', 'View only')}</option>
              <option value="editor">{t('Editar', 'Editar', 'Edit')}</option>
            </select>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@…"
              className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
            <button
              type="button"
              disabled={busy || !email.trim()}
              onClick={() => void shareWith(email)}
              className="rounded-lg bg-orange-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-40"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
            </button>
          </div>

          <label className="flex items-center gap-2 text-xs text-slate-600">
            <input type="checkbox" checked={asExternal} onChange={(e) => setAsExternal(e.target.checked)} />
            {t(
              'Acesso externo isolado (não vê o resto da empresa)',
              'Acceso externo aislado (no ve el resto de la empresa)',
              'Isolated external access (cannot see the rest of the company)',
            )}
          </label>

          {members.length > 0 && (
            <div>
              <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <Users className="h-3.5 w-3.5" />
                {t('Membros da empresa', 'Miembros de la empresa', 'Company members')}
              </p>
              <ul className="max-h-40 space-y-1 overflow-y-auto">
                {members.map((m) => (
                  <li key={m.userId} className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 px-3 py-2 text-sm">
                    <span className="min-w-0 truncate">
                      <span className="font-medium text-slate-900">{m.name}</span>
                      <span className="ml-1 text-xs text-slate-500">{m.email}</span>
                    </span>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void shareWith(m.email, false)}
                      className="shrink-0 text-xs font-semibold text-orange-700 hover:underline"
                    >
                      {t('Partilhar', 'Compartir', 'Share')}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              {t('Quem tem acesso', 'Quién tiene acceso', 'Who has access')}
            </p>
            {loading ? (
              <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
            ) : shares.length === 0 ? (
              <p className="text-sm text-slate-500">{t('Ninguém ainda.', 'Nadie aún.', 'Nobody yet.')}</p>
            ) : (
              <ul className="space-y-1">
                {shares.map((s) => (
                  <li
                    key={s.id}
                    className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 px-3 py-2 text-sm"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium text-slate-900">
                        {s.user?.name || s.email}
                      </p>
                      <p className="text-[10px] text-slate-500">
                        {s.role} · {s.accessMode === 'external_guest' ? 'externo' : 'empresa'}
                        {s.acceptedAt ? '' : ' · pendente'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void revoke(s.id)}
                      className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {msg && <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-950">{msg}</p>}
        </div>
      </div>
    </div>
  );
}
