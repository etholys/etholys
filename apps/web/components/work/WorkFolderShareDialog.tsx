'use client';

import { useEffect, useState } from 'react';
import { Lock, Users, X } from 'lucide-react';
import { cn } from '@/lib/utils';

type UserRow = { id: string; name?: string | null; email?: string | null };
type MemberRow = {
  id: string;
  userId: string;
  role: string;
  user?: UserRow | null;
};
type ShareRow = {
  id: string;
  email: string;
  role: string;
  accessMode: string;
  acceptedAt?: string | null;
  user?: UserRow | null;
};
type BoardVisibility = 'PERSONAL' | 'SHARED';

export function WorkFolderShareDialog({
  folderId,
  folderName,
  users,
  open,
  onClose,
  onSaved,
  t,
}: {
  folderId: string;
  folderName: string;
  users: UserRow[];
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  t: (en: string, es: string, pt: string) => string;
}) {
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [shares, setShares] = useState<ShareRow[]>([]);
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [owner, setOwner] = useState<UserRow | null>(null);
  const [visibility, setVisibility] = useState<BoardVisibility>('PERSONAL');
  const [pickUserId, setPickUserId] = useState('');
  const [emailDraft, setEmailDraft] = useState('');
  const [pickRole, setPickRole] = useState<'viewer' | 'editor'>('viewer');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastInviteUrl, setLastInviteUrl] = useState<string | null>(null);

  const pendingOrGuestShares = shares.filter(
    (s) => s.accessMode === 'external_guest' || !s.acceptedAt,
  );
  const hasPeople = members.length > 0 || pendingOrGuestShares.length > 0;
  const isShared = visibility === 'SHARED' || hasPeople;

  const reload = () => {
    setLoading(true);
    setError(null);
    Promise.all([
      fetch(`/api/work-folders/${folderId}`).then((r) => r.json()),
      fetch(`/api/work-folders/${folderId}/shares`).then((r) => r.json()),
    ])
      .then(([folderData, sharesData]) => {
        setMembers(folderData?.folder?.members ?? []);
        setOwnerId(folderData?.folder?.ownerId ?? null);
        setOwner(folderData?.folder?.owner ?? null);
        setVisibility(folderData?.folder?.visibility === 'SHARED' ? 'SHARED' : 'PERSONAL');
        setShares(sharesData?.shares ?? []);
      })
      .catch(() => setError(t('Failed to load', 'Error al cargar', 'Falha ao carregar')))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!open || !folderId) return;
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, folderId]);

  const available = users.filter(
    (u) => u.id !== ownerId && !members.some((m) => m.userId === u.id),
  );

  const persistMembers = async (
    next: { userId: string; role: string }[],
    opts?: { visibility?: BoardVisibility },
  ) => {
    setSaving(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        members: next.map((m) => ({ userId: m.userId, role: m.role })),
      };
      if (opts?.visibility) {
        body.visibility = opts.visibility;
      } else if (next.length > 0) {
        body.visibility = 'SHARED';
      } else if (pendingOrGuestShares.length === 0) {
        // Last company member removed and no pending email invites → private again
        body.visibility = 'PERSONAL';
      }

      const res = await fetch(`/api/work-folders/${folderId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || t('Could not save', 'No se pudo guardar', 'Não foi possível guardar'));
        return false;
      }
      setMembers(data?.folder?.members ?? []);
      setVisibility(data?.folder?.visibility === 'SHARED' ? 'SHARED' : 'PERSONAL');
      onSaved();
      return true;
    } finally {
      setSaving(false);
    }
  };

  const addMember = async () => {
    if (!pickUserId) return;
    const next = [
      ...members.map((m) => ({ userId: m.userId, role: m.role === 'editor' ? 'editor' : 'viewer' })),
      { userId: pickUserId, role: pickRole },
    ];
    await persistMembers(next);
    setPickUserId('');
  };

  const inviteByEmail = async () => {
    const email = emailDraft.trim();
    if (!email.includes('@')) {
      setError(t('Enter a valid email', 'Introduce un email válido', 'Introduz um email válido'));
      return;
    }
    setSaving(true);
    setError(null);
    setLastInviteUrl(null);
    try {
      const res = await fetch(`/api/work-folders/${folderId}/shares`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, role: pickRole }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || t('Could not invite', 'No se pudo invitar', 'Não foi possível convidar'));
        return;
      }
      setEmailDraft('');
      if (data?.inviteUrl) setLastInviteUrl(String(data.inviteUrl));
      reload();
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  const updateRole = async (userId: string, role: 'viewer' | 'editor') => {
    const next = members.map((m) =>
      m.userId === userId ? { userId, role } : { userId: m.userId, role: m.role === 'editor' ? 'editor' : 'viewer' },
    );
    await persistMembers(next);
  };

  const removeMember = async (userId: string) => {
    const next = members
      .filter((m) => m.userId !== userId)
      .map((m) => ({ userId: m.userId, role: m.role === 'editor' ? 'editor' : 'viewer' }));
    await persistMembers(next);
  };

  const deleteShare = async (shareId: string) => {
    const res = await fetch(
      `/api/work-folders/${folderId}/shares?shareId=${encodeURIComponent(shareId)}`,
      { method: 'DELETE' },
    );
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data?.error || t('Could not remove', 'No se pudo quitar', 'Não foi possível remover'));
      return false;
    }
    return true;
  };

  const revokeShareAndReload = async (shareId: string) => {
    setSaving(true);
    setError(null);
    try {
      const revoked = shares.find((s) => s.id === shareId);
      const ok = await deleteShare(shareId);
      if (!ok) return;
      const remainingShares = shares.filter((s) => s.id !== shareId);
      const remainingMembers = members.filter((m) => m.userId !== revoked?.user?.id);
      if (remainingMembers.length === 0 && remainingShares.length === 0) {
        await persistMembers([], { visibility: 'PERSONAL' });
        setShares([]);
      } else {
        reload();
        onSaved();
      }
    } finally {
      setSaving(false);
    }
  };

  /** Remove everyone + revoke invites + switch board back to private. */
  const makePrivate = async (opts?: { skipConfirm?: boolean }) => {
    if (!opts?.skipConfirm) {
      const confirmed = window.confirm(
        t(
          'Stop sharing this board? Everyone will lose access and it becomes private again.',
          '¿Dejar de compartir este tablero? Todos perderán el acceso y volverá a ser privado.',
          'Deixar de partilhar este quadro? Todos perdem o acesso e volta a ser privado.',
        ),
      );
      if (!confirmed) return;
    }

    setSaving(true);
    setError(null);
    try {
      // API clears members + revokes shares when visibility → PERSONAL
      const res = await fetch(`/api/work-folders/${folderId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ members: [], visibility: 'PERSONAL' }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || t('Could not save', 'No se pudo guardar', 'Não foi possível guardar'));
        return;
      }
      setMembers(data?.folder?.members ?? []);
      setVisibility('PERSONAL');
      setShares([]);
      setLastInviteUrl(null);
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  const setBoardType = async (next: BoardVisibility) => {
    if (next === visibility && !(next === 'PERSONAL' && hasPeople)) return;

    if (next === 'PERSONAL' && (hasPeople || visibility === 'SHARED')) {
      await makePrivate({ skipConfirm: false });
      return;
    }

    if (next === 'SHARED') {
      setSaving(true);
      setError(null);
      try {
        const res = await fetch(`/api/work-folders/${folderId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ visibility: 'SHARED' }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(data?.error || t('Could not save', 'No se pudo guardar', 'Não foi possível guardar'));
          return;
        }
        setVisibility(data?.folder?.visibility === 'SHARED' ? 'SHARED' : 'PERSONAL');
        setMembers(data?.folder?.members ?? members);
        onSaved();
      } finally {
        setSaving(false);
      }
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
        <div className="flex items-start justify-between gap-2 border-b border-slate-100 px-4 py-3">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-teal-600">
              {t('Share board', 'Compartir tablero', 'Partilhar tablero')}
            </p>
            <h3 className="truncate text-base font-semibold text-slate-900">{folderName}</h3>
            <p className="mt-0.5 text-[11px] text-slate-400">
              {isShared
                ? t(
                    'People with access. Change board type or stop sharing entirely.',
                    'Personas con acceso. Cambia el tipo de tablero o deja de compartir.',
                    'Pessoas com acesso. Muda o tipo de quadro ou deixa de partilhar.',
                  )
                : t(
                    'Choose board type, then invite people if you want.',
                    'Elige el tipo de tablero y, si quieres, invita personas.',
                    'Escolhe o tipo de quadro e, se quiseres, convida pessoas.',
                  )}
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3 p-4">
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-cyan-600/30 border-t-cyan-600" />
            </div>
          ) : (
            <>
              <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                  {t('Board type', 'Tipo de tablero', 'Tipo de quadro')}
                </p>
                <div className="grid grid-cols-2 gap-1.5 rounded-lg bg-white p-1 ring-1 ring-slate-200">
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void setBoardType('PERSONAL')}
                    className={cn(
                      'inline-flex items-center justify-center gap-1.5 rounded-md px-2.5 py-2 text-sm font-medium transition disabled:opacity-40',
                      visibility === 'PERSONAL' && !hasPeople
                        ? 'bg-slate-900 text-white shadow-sm'
                        : 'text-slate-600 hover:bg-slate-100',
                    )}
                  >
                    <Lock className="h-3.5 w-3.5" />
                    {t('Only me', 'Solo yo', 'Só eu')}
                  </button>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void setBoardType('SHARED')}
                    className={cn(
                      'inline-flex items-center justify-center gap-1.5 rounded-md px-2.5 py-2 text-sm font-medium transition disabled:opacity-40',
                      visibility === 'SHARED' || hasPeople
                        ? 'bg-teal-600 text-white shadow-sm'
                        : 'text-slate-600 hover:bg-slate-100',
                    )}
                  >
                    <Users className="h-3.5 w-3.5" />
                    {t('Shared', 'Compartido', 'Partilhado')}
                  </button>
                </div>
                <p className="mt-2 text-[11px] leading-snug text-slate-500">
                  {visibility === 'SHARED' || hasPeople
                    ? t(
                        'Shows under Shared. Invite below — access stays invite-only.',
                        'Aparece en Compartidos. Invita abajo — el acceso sigue siendo solo por invitación.',
                        'Aparece em Partilhados. Convida abaixo — o acesso continua só por convite.',
                      )
                    : t(
                        'Private under Only me. Switch to Shared to move legacy boards into Shared.',
                        'Privado en Solo yo. Cambia a Compartido para mover tableros antiguos a Compartidos.',
                        'Privado em Só eu. Muda para Partilhado para mover quadros antigos para Partilhados.',
                      )}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <select
                  value={pickUserId}
                  onChange={(e) => setPickUserId(e.target.value)}
                  className="min-w-0 flex-1 rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                >
                  <option value="">{t('Add person…', 'Añadir persona…', 'Adicionar pessoa…')}</option>
                  {available.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name || u.email || u.id}
                    </option>
                  ))}
                </select>
                <select
                  value={pickRole}
                  onChange={(e) => setPickRole(e.target.value as 'viewer' | 'editor')}
                  className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                >
                  <option value="viewer">{t('Viewer', 'Lector', 'Leitor')}</option>
                  <option value="editor">{t('Editor', 'Editor', 'Editor')}</option>
                </select>
                <button
                  type="button"
                  disabled={!pickUserId || saving}
                  onClick={() => void addMember()}
                  className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-40"
                >
                  {t('Invite', 'Invitar', 'Convidar')}
                </button>
              </div>

              <div className="rounded-xl border border-dashed border-teal-200 bg-teal-50/50 p-3">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-teal-700">
                  {t('Invite by email', 'Invitar por email', 'Convidar por email')}
                </p>
                <div className="flex flex-wrap gap-2">
                  <input
                    type="email"
                    value={emailDraft}
                    onChange={(e) => setEmailDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        void inviteByEmail();
                      }
                    }}
                    placeholder="nome@exemplo.com"
                    className="min-w-0 flex-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm outline-none focus:border-teal-500"
                  />
                  <button
                    type="button"
                    disabled={!emailDraft.trim() || saving}
                    onClick={() => void inviteByEmail()}
                    className="rounded-lg bg-teal-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-teal-500 disabled:opacity-40"
                  >
                    {t('Send invite', 'Enviar', 'Enviar')}
                  </button>
                </div>
                {lastInviteUrl && (
                  <p className="mt-2 break-all text-[10px] text-slate-500">
                    {t('Link', 'Enlace', 'Link')}: {lastInviteUrl}
                  </p>
                )}
              </div>

              {error && <p className="text-xs text-rose-600">{error}</p>}

              <ul className="max-h-56 space-y-1 overflow-y-auto">
                <li className="flex items-center gap-2 rounded-lg border border-slate-100 bg-slate-50/80 px-2.5 py-2">
                  <span className="min-w-0 flex-1 truncate text-sm text-slate-800">
                    {owner?.name || owner?.email || t('You (owner)', 'Tú (dueño)', 'Tu (dono)')}
                  </span>
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                    {t('Owner', 'Dueño', 'Dono')}
                  </span>
                </li>
                {members.length === 0 && pendingOrGuestShares.length === 0 && (
                  <li className="rounded-lg bg-slate-50 px-3 py-4 text-center text-xs text-slate-400">
                    {t('No one invited yet', 'Nadie invitado aún', 'Ninguém convidado ainda')}
                  </li>
                )}
                {members.map((m) => (
                  <li
                    key={m.id || m.userId}
                    className="flex items-center gap-2 rounded-lg border border-slate-100 px-2.5 py-2"
                  >
                    <span className="min-w-0 flex-1 truncate text-sm text-slate-800">
                      {m.user?.name || m.user?.email || m.userId}
                    </span>
                    <select
                      value={m.role === 'editor' ? 'editor' : 'viewer'}
                      onChange={(e) => void updateRole(m.userId, e.target.value as 'viewer' | 'editor')}
                      disabled={saving}
                      className={cn('rounded-md border border-slate-200 px-1.5 py-1 text-xs')}
                    >
                      <option value="viewer">{t('Viewer', 'Lector', 'Leitor')}</option>
                      <option value="editor">{t('Editor', 'Editor', 'Editor')}</option>
                    </select>
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => void removeMember(m.userId)}
                      className="text-xs font-medium text-rose-600 hover:underline disabled:opacity-40"
                    >
                      {t('Remove', 'Quitar', 'Remover')}
                    </button>
                  </li>
                ))}
                {pendingOrGuestShares.map((s) => (
                  <li
                    key={s.id}
                    className="flex items-center gap-2 rounded-lg border border-teal-100 bg-teal-50/40 px-2.5 py-2"
                  >
                    <span className="min-w-0 flex-1 truncate text-sm text-slate-800">
                      {s.email}
                      <span className="ml-1 text-[10px] text-teal-700">
                        {s.acceptedAt
                          ? t('guest', 'invitado', 'convidado')
                          : t('pending', 'pendiente', 'pendente')}
                      </span>
                    </span>
                    <span className="text-[10px] text-slate-500">
                      {s.role === 'editor'
                        ? t('Editor', 'Editor', 'Editor')
                        : t('Viewer', 'Lector', 'Leitor')}
                    </span>
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => void revokeShareAndReload(s.id)}
                      className="text-xs font-medium text-rose-600 hover:underline disabled:opacity-40"
                    >
                      {t('Remove', 'Quitar', 'Remover')}
                    </button>
                  </li>
                ))}
              </ul>

              {isShared && (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void makePrivate()}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700 disabled:opacity-40"
                >
                  <Lock className="h-3.5 w-3.5" />
                  {t('Stop sharing — make private', 'Dejar de compartir — solo yo', 'Deixar de partilhar — só eu')}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
