'use client';

import { useCallback, useEffect, useState } from 'react';
import { Check, Copy, Link2, Loader2, Lock, Share2, Trash2, Users, Mail } from 'lucide-react';
import { useApp } from '@/app/providers';

type ShareRow = {
  id: string;
  email: string;
  role: string;
  accessMode: string;
  acceptedAt: string | null;
  inviteUrl?: string;
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
  const [role, setRole] = useState<'viewer' | 'editor' | 'admin'>('editor');
  const [asExternal, setAsExternal] = useState(false);
  const [sendEmail, setSendEmail] = useState(true);
  const [visibility, setVisibility] = useState<'private' | 'company'>('private');
  const [canChangeVisibility, setCanChangeVisibility] = useState(true);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [lastInviteUrl, setLastInviteUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  function roleLabel(r: string) {
    if (r === 'admin') return t('Admin de conteúdo', 'Admin de contenido', 'Content admin');
    if (r === 'editor') return t('Editor', 'Editor', 'Editor');
    return t('Visualizador', 'Visualizador', 'Viewer');
  }

  const itemUrl =
    typeof window === 'undefined'
      ? ''
      : folderId
        ? `${window.location.origin}/studio/f/${folderId}`
        : `${window.location.origin}/hub/studio/${documentId}`;

  async function copy(value: string, key: string) {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      const el = document.createElement('textarea');
      el.value = value;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
    }
    setCopied(key);
    setTimeout(() => setCopied((cur) => (cur === key ? null : cur)), 2000);
  }

  const load = useCallback(async () => {
    if (!open || !companyId) return;
    setLoading(true);
    setMsg(null);

    const q = new URLSearchParams({ companyId });
    if (folderId) q.set('folderId', folderId);
    if (documentId) q.set('documentId', documentId);

    const readJson = async (res: Response) => {
      try {
        return await res.json();
      } catch {
        return null;
      }
    };

    const [sharesRes, membersRes] = await Promise.allSettled([
      fetch(`/api/studio/shares?${q}`, { cache: 'no-store' }),
      fetch(`/api/studio/shares?companyId=${encodeURIComponent(companyId)}&members=1`, {
        cache: 'no-store',
      }),
    ]);

    const problems: string[] = [];

    if (sharesRes.status === 'fulfilled') {
      const data = await readJson(sharesRes.value);
      if (sharesRes.value.ok) {
        setShares(data?.shares || []);
        setVisibility(data?.visibility === 'company' ? 'company' : 'private');
        setCanChangeVisibility(data?.canChangeVisibility !== false);
      } else {
        problems.push(
          data?.error ||
            t(
              `Não foi possível ler os acessos (HTTP ${sharesRes.value.status}).`,
              `No se pudieron leer los accesos (HTTP ${sharesRes.value.status}).`,
              `Could not read access list (HTTP ${sharesRes.value.status}).`,
            ),
        );
      }
    } else {
      problems.push(t('Falha de rede ao ler acessos.', 'Fallo de red al leer accesos.', 'Network error reading access list.'));
    }

    if (membersRes.status === 'fulfilled') {
      const data = await readJson(membersRes.value);
      if (membersRes.value.ok) {
        setMembers(data?.members || []);
      } else {
        problems.push(
          data?.error ||
            t(
              `Não foi possível listar os membros (HTTP ${membersRes.value.status}).`,
              `No se pudieron listar los miembros (HTTP ${membersRes.value.status}).`,
              `Could not list members (HTTP ${membersRes.value.status}).`,
            ),
        );
      }
    } else {
      problems.push(t('Falha de rede ao listar membros.', 'Fallo de red al listar miembros.', 'Network error listing members.'));
    }

    setMsg(problems.length ? problems.join(' ') : null);
    setLoading(false);
  }, [open, companyId, folderId, documentId, locale]);

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
          sendEmail,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`);
      setLastInviteUrl(d.inviteUrl || null);
      setMsg(
        d.emailSent
          ? t('Convite enviado por email.', 'Invitación enviada por email.', 'Invite emailed.')
          : t(
              'Acesso criado. Copie o link abaixo para o enviar como quiser.',
              'Acceso creado. Copie el enlace de abajo para enviarlo como quiera.',
              'Access created. Copy the link below to send it however you like.',
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

  async function changeRole(id: string, nextRole: 'viewer' | 'editor' | 'admin') {
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch('/api/studio/shares', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, companyId, role: nextRole }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`);
      setShares((prev) => prev.map((s) => (s.id === id ? { ...s, role: nextRole } : s)));
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : 'Erro');
      await load();
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
              {t('Compartilhar e gerenciar acesso', 'Compartir y gestionar acceso', 'Share and manage access')}
            </h2>
            <p className="mt-0.5 truncate text-xs text-slate-500">{title}</p>
          </div>
          <button type="button" onClick={onClose} className="text-sm text-slate-500 hover:text-slate-800">
            {t('Fechar', 'Cerrar', 'Close')}
          </button>
        </div>

        <div className="space-y-4 p-5">
          {canChangeVisibility && (
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
          )}

          <div className="rounded-xl border border-slate-200 p-3">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <Link2 className="h-3.5 w-3.5" />
              {t('Link direto', 'Enlace directo', 'Direct link')}
            </p>
            <div className="flex gap-2">
              <input
                readOnly
                value={itemUrl}
                onFocus={(e) => e.currentTarget.select()}
                className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600"
              />
              <button
                type="button"
                onClick={() => void copy(itemUrl, 'item')}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                {copied === 'item' ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
                {copied === 'item' ? t('Copiado', 'Copiado', 'Copied') : t('Copiar', 'Copiar', 'Copy')}
              </button>
            </div>
            <p className="mt-1.5 text-xs text-slate-500">
              {t(
                'Só abre para quem já tem acesso. Para dar acesso a alguém, convide abaixo.',
                'Solo abre para quien ya tiene acceso. Para dar acceso a alguien, invite abajo.',
                'Only opens for people who already have access. To grant access, invite below.',
              )}
            </p>
          </div>

          <div className="flex gap-2">
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as 'viewer' | 'editor' | 'admin')}
              className="rounded-lg border border-slate-200 px-2 py-2 text-sm"
            >
              <option value="viewer">{roleLabel('viewer')}</option>
              <option value="editor">{roleLabel('editor')}</option>
              <option value="admin">{roleLabel('admin')}</option>
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
              title={
                sendEmail
                  ? t('Convidar e enviar email', 'Invitar y enviar email', 'Invite and send email')
                  : t('Criar acesso e gerar link', 'Crear acceso y generar enlace', 'Create access and get link')
              }
              className="rounded-lg bg-orange-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-40"
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : sendEmail ? (
                <Mail className="h-4 w-4" />
              ) : (
                <Link2 className="h-4 w-4" />
              )}
            </button>
          </div>

          <div className="space-y-1.5">
            <label className="flex items-center gap-2 text-xs text-slate-600">
              <input type="checkbox" checked={asExternal} onChange={(e) => setAsExternal(e.target.checked)} />
              {t(
                'Acesso externo isolado (não vê o resto da empresa)',
                'Acceso externo aislado (no ve el resto de la empresa)',
                'Isolated external access (cannot see the rest of the company)',
              )}
            </label>
            <label className="flex items-center gap-2 text-xs text-slate-600">
              <input type="checkbox" checked={sendEmail} onChange={(e) => setSendEmail(e.target.checked)} />
              {t(
                'Enviar convite por email (desligue para só copiar o link)',
                'Enviar invitación por email (desactive para solo copiar el enlace)',
                'Send invite by email (turn off to just copy the link)',
              )}
            </label>
          </div>

          {lastInviteUrl && (
            <div className="rounded-xl border border-orange-200 bg-orange-50 p-3">
              <p className="mb-1.5 text-xs font-semibold text-orange-900">
                {t('Link do convite criado', 'Enlace de la invitación creada', 'Created invite link')}
              </p>
              <div className="flex gap-2">
                <input
                  readOnly
                  value={lastInviteUrl}
                  onFocus={(e) => e.currentTarget.select()}
                  className="min-w-0 flex-1 rounded-lg border border-orange-200 bg-white px-3 py-2 text-xs text-slate-700"
                />
                <button
                  type="button"
                  onClick={() => void copy(lastInviteUrl, 'invite')}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-orange-600 px-3 py-2 text-xs font-semibold text-white hover:opacity-95"
                >
                  {copied === 'invite' ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied === 'invite' ? t('Copiado', 'Copiado', 'Copied') : t('Copiar', 'Copiar', 'Copy')}
                </button>
              </div>
            </div>
          )}

          <div>
            <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <Users className="h-3.5 w-3.5" />
              {t('Membros da empresa', 'Miembros de la empresa', 'Company members')}
            </p>
            {loading ? (
              <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
            ) : members.length === 0 ? (
              <div className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 px-3 py-2">
                <p className="text-xs text-slate-500">
                  {t(
                    'Não foi possível listar os membros agora.',
                    'No se pudieron listar los miembros ahora.',
                    'Could not list members right now.',
                  )}
                </p>
                <button
                  type="button"
                  onClick={() => void load()}
                  className="shrink-0 text-xs font-semibold text-orange-700 hover:underline"
                >
                  {t('Tentar de novo', 'Reintentar', 'Retry')}
                </button>
              </div>
            ) : (
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
                      {t('Compartilhar', 'Compartir', 'Share')}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

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
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-100 px-3 py-2 text-sm"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-slate-900">
                        {s.user?.name || s.email}
                      </p>
                      <p className="text-[10px] text-slate-500">
                        {s.accessMode === 'external_guest' ? 'externo' : 'empresa'}
                        {s.acceptedAt ? '' : ' · pendente'}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <select
                        value={s.role === 'admin' || s.role === 'editor' ? s.role : 'viewer'}
                        disabled={busy}
                        onChange={(e) =>
                          void changeRole(s.id, e.target.value as 'viewer' | 'editor' | 'admin')
                        }
                        className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
                        title={roleLabel(s.role)}
                      >
                        <option value="viewer">{roleLabel('viewer')}</option>
                        <option value="editor">{roleLabel('editor')}</option>
                        <option value="admin">{roleLabel('admin')}</option>
                      </select>
                      {s.inviteUrl && (
                        <button
                          type="button"
                          title={t('Copiar link do convite', 'Copiar enlace de la invitación', 'Copy invite link')}
                          onClick={() => void copy(s.inviteUrl!, s.id)}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1.5 text-[11px] font-semibold text-slate-600 hover:bg-slate-50"
                        >
                          {copied === s.id ? (
                            <Check className="h-3.5 w-3.5 text-green-600" />
                          ) : (
                            <Link2 className="h-3.5 w-3.5" />
                          )}
                          {copied === s.id ? t('Copiado', 'Copiado', 'Copied') : t('Link', 'Enlace', 'Link')}
                        </button>
                      )}
                      <button
                        type="button"
                        title={t('Revogar acesso', 'Revocar acceso', 'Revoke access')}
                        onClick={() => void revoke(s.id)}
                        className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
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
