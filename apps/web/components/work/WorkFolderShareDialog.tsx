'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

type UserRow = { id: string; name?: string | null; email?: string | null };
type MemberRow = {
  id: string;
  userId: string;
  role: string;
  user?: UserRow | null;
};

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
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [pickUserId, setPickUserId] = useState('');
  const [pickRole, setPickRole] = useState<'viewer' | 'editor'>('viewer');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !folderId) return;
    setLoading(true);
    setError(null);
    fetch(`/api/work-folders/${folderId}`)
      .then((r) => r.json())
      .then((d) => {
        setMembers(d?.folder?.members ?? []);
        setOwnerId(d?.folder?.ownerId ?? null);
      })
      .catch(() => setError(t('Failed to load', 'Error al cargar', 'Falha ao carregar')))
      .finally(() => setLoading(false));
  }, [open, folderId, t]);

  const available = users.filter(
    (u) => u.id !== ownerId && !members.some((m) => m.userId === u.id),
  );

  const persist = async (next: { userId: string; role: string }[]) => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/work-folders/${folderId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          members: next.map((m) => ({ userId: m.userId, role: m.role })),
          visibility: 'SHARED',
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || t('Could not save', 'No se pudo guardar', 'Não foi possível guardar'));
        return;
      }
      setMembers(data?.folder?.members ?? []);
      onSaved();
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
    await persist(next);
    setPickUserId('');
  };

  const updateRole = async (userId: string, role: 'viewer' | 'editor') => {
    const next = members.map((m) =>
      m.userId === userId ? { userId, role } : { userId: m.userId, role: m.role === 'editor' ? 'editor' : 'viewer' },
    );
    await persist(next);
  };

  const removeMember = async (userId: string) => {
    const next = members
      .filter((m) => m.userId !== userId)
      .map((m) => ({ userId: m.userId, role: m.role === 'editor' ? 'editor' : 'viewer' }));
    await persist(next);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
        <div className="flex items-start justify-between gap-2 border-b border-slate-100 px-4 py-3">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-cyan-700">
              {t('Share folder', 'Compartir carpeta', 'Partilhar pasta')}
            </p>
            <h3 className="truncate text-base font-semibold text-slate-900">{folderName}</h3>
            <p className="mt-0.5 text-[11px] text-slate-400">
              {t(
                'Only people you invite can see this folder.',
                'Solo las personas invitadas ven esta carpeta.',
                'Só as pessoas convidadas veem esta pasta.',
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

              {error && <p className="text-xs text-rose-600">{error}</p>}

              <ul className="max-h-56 space-y-1 overflow-y-auto">
                {members.length === 0 && (
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
              </ul>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
