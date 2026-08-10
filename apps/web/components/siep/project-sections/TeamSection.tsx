'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { SectionProps } from './types';
import { SectionTooltip } from './SectionTooltip';
import { getInitials, formatCurrency } from '@/lib/utils';
import {
  Users,
  Plus,
  X,
  Trash2,
  Mail,
  Briefcase,
  Percent,
  DollarSign,
  Edit2,
  Check,
  UserPlus,
  Shield,
} from 'lucide-react';
import {
  DEFAULT_PROJECT_GUEST_PERMISSIONS,
  FIELD_TECHNICIAN_PERMISSIONS,
  getSiepPermissionGroups,
  type SiepPermissionKey,
} from '@/lib/siep/permissions-shared';
import { useApp } from '@/app/providers';
import { useSiepT } from '@/lib/siep/use-siep-t';

type AddMode = 'company' | 'guest';

export function TeamSection({ project, onRefresh, tr }: SectionProps) {
  const { locale } = useApp();
  const st = useSiepT();
  const [showForm, setShowForm] = useState(false);
  const [addMode, setAddMode] = useState<AddMode>('company');
  const [form, setForm] = useState<any>({
    userId: '',
    email: '',
    role: 'member',
    dedicationPct: '100',
    monthlyCost: '',
  });
  const [selectedPerms, setSelectedPerms] = useState<SiepPermissionKey[]>([
    ...DEFAULT_PROJECT_GUEST_PERMISSIONS,
  ]);
  const [users, setUsers] = useState<any[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<any>({});
  const [editPerms, setEditPerms] = useState<SiepPermissionKey[]>([]);
  const [hrContracts, setHrContracts] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inviteInfo, setInviteInfo] = useState<string | null>(null);

  const permGroups = useMemo(() => getSiepPermissionGroups(locale as any), [locale]);

  useEffect(() => {
    fetch('/api/users').then((r) => r.json()).then((d) => setUsers(d?.users ?? [])).catch(() => {});
  }, []);

  const fetchContracts = useCallback(() => {
    if (!project?.companyId) return;
    fetch(`/api/hr/contracts?companyId=${project.companyId}`)
      .then((r) => r.json())
      .then((d) => setHrContracts(d?.contracts ?? []))
      .catch(() => {});
  }, [project?.companyId]);

  useEffect(() => {
    fetchContracts();
  }, [fetchContracts]);

  const members = project?.members ?? [];

  const contractMap = new Map<string, any>();
  hrContracts.forEach((c) => {
    if (!contractMap.has(c.userId)) contractMap.set(c.userId, c);
  });

  const togglePerm = (key: SiepPermissionKey, list: SiepPermissionKey[], setList: (v: SiepPermissionKey[]) => void) => {
    if (list.includes(key)) setList(list.filter((k) => k !== key));
    else setList([...list, key]);
  };

  const openAdd = (mode: AddMode) => {
    setAddMode(mode);
    setError(null);
    setInviteInfo(null);
    setForm({
      userId: '',
      email: '',
      role: mode === 'guest' ? 'aliado' : 'member',
      dedicationPct: '100',
      monthlyCost: '',
    });
    setSelectedPerms([...DEFAULT_PROJECT_GUEST_PERMISSIONS]);
    setShowForm(true);
  };

  const addMember = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setInviteInfo(null);
    try {
      const body: any = {
        projectId: project.id,
        role: form.role,
        dedicationPct: form.dedicationPct,
        monthlyCost: form.monthlyCost || undefined,
        permissions: selectedPerms,
      };
      if (addMode === 'guest') {
        body.inviteGuest = true;
        body.email = form.email;
        body.accessMode = 'project_guest';
      } else {
        body.userId = form.userId;
      }

      const res = await fetch('/api/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Error al agregar');
        return;
      }
      if (data.invitation?.code) {
        setInviteInfo(
          `Invitado: ${data.invitation.email}. Código de acceso: ${data.invitation.code} (también puede iniciar sesión / restablecer contraseña con este email).`,
        );
      }
      setShowForm(false);
      onRefresh();
    } finally {
      setSaving(false);
    }
  };

  const removeMember = async (memberId: string) => {
    if (!confirm(tr('general.confirm') + '?')) return;
    await fetch(`/api/members?id=${memberId}`, { method: 'DELETE' });
    onRefresh();
  };

  const startEdit = (m: any) => {
    setEditingId(m.id);
    setEditData({
      role: m.role || 'member',
      dedicationPct: String(m.dedicationPct ?? 100),
      monthlyCost: m.monthlyCost ? String(m.monthlyCost) : '',
    });
    const perms = Array.isArray(m.permissions) ? m.permissions : [];
    setEditPerms(perms.length ? perms : [...DEFAULT_PROJECT_GUEST_PERMISSIONS]);
  };

  const saveEdit = async () => {
    if (!editingId) return;
    await fetch('/api/members', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: editingId, ...editData, permissions: editPerms }),
    });
    setEditingId(null);
    onRefresh();
  };

  const roleColors: Record<string, string> = {
    director: 'bg-purple-100 text-purple-700',
    coordinador: 'bg-indigo-100 text-indigo-700',
    coordinator: 'bg-indigo-100 text-indigo-700',
    consultor: 'bg-blue-100 text-blue-700',
    consultant: 'bg-blue-100 text-blue-700',
    aliado: 'bg-amber-100 text-amber-800',
    member: 'bg-gray-100 text-gray-700',
    miembro: 'bg-gray-100 text-gray-700',
    admin: 'bg-red-100 text-red-700',
  };

  const getRoleStyle = (role: string) => {
    const key = (role ?? '').toLowerCase();
    return roleColors[key] || 'bg-gray-100 text-gray-600';
  };

  const totalMonthlyCost = members.reduce((sum: number, m: any) => {
    const contract = contractMap.get(m.userId);
    const baseSalary = contract?.salary || 0;
    const ded = m.dedicationPct ?? 100;
    const cost = m.monthlyCost || (baseSalary * ded) / 100;
    return sum + cost;
  }, 0);

  const PermChecklist = ({
    value,
    onChange,
  }: {
    value: SiepPermissionKey[];
    onChange: (next: SiepPermissionKey[]) => void;
  }) => (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onChange([...FIELD_TECHNICIAN_PERMISSIONS])}
          className="rounded-lg border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-900 hover:bg-emerald-100"
          title={st('siep.perm.preset.fieldTechDesc')}
        >
          {st('siep.perm.preset.fieldTech')}
        </button>
      </div>
      <div className="max-h-56 space-y-3 overflow-y-auto rounded-lg border border-gray-200 bg-gray-50 p-3">
        {permGroups.map((group) => (
          <div key={group.id}>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">{group.label}</p>
            <div className="space-y-1.5">
              {group.permissions.map((p) => (
                <label key={p.key} className="flex cursor-pointer items-start gap-2 text-sm text-gray-800">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={value.includes(p.key)}
                    onChange={() => togglePerm(p.key, value, onChange)}
                  />
                  <span>
                    <span className="font-medium">{p.label}</span>
                    {p.description ? <span className="block text-xs text-gray-500">{p.description}</span> : null}
                  </span>
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100">
            <Users className="h-5 w-5 text-violet-600" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-gray-900">{tr('project.team')}</h2>
              <SectionTooltip content="Equipo del proyecto. Puede agregar personal de la empresa o aliados externos solo vinculados a este proyecto, con permisos exactos de ver/hacer." />
            </div>
            <p className="text-sm text-gray-500">
              {members.length} miembros · Costo mensual: {formatCurrency(totalMonthlyCost)}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => openAdd('company')}
            className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-sm text-white transition hover:bg-indigo-700"
          >
            <Plus className="h-4 w-4" />
            De la empresa
          </button>
          <button
            onClick={() => openAdd('guest')}
            className="flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-900 transition hover:bg-amber-100"
          >
            <UserPlus className="h-4 w-4" />
            Aliado / temporal
          </button>
        </div>
      </div>

      {inviteInfo && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">{inviteInfo}</div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {members.map((m: any) => {
          const contract = contractMap.get(m.userId);
          const baseSalary = contract?.salary || 0;
          const ded = m.dedicationPct ?? 100;
          const effectiveCost = m.monthlyCost || (baseSalary * ded) / 100;
          const isEditing = editingId === m.id;
          const isGuest = m.accessMode === 'project_guest';

          return (
            <div key={m?.id} className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm transition hover:shadow-md">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-indigo-400 to-indigo-600 text-sm font-bold text-white">
                    {getInitials(m?.user?.name)}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">{m?.user?.name ?? ''}</p>
                    <p className="flex items-center gap-1 text-xs text-gray-500">
                      <Mail className="h-3 w-3" />
                      {m?.user?.email ?? ''}
                    </p>
                    {isGuest && (
                      <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800">
                        Solo proyecto
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {isEditing ? (
                    <button onClick={saveEdit} className="rounded p-1 text-green-600 transition hover:bg-green-50">
                      <Check className="h-3.5 w-3.5" />
                    </button>
                  ) : (
                    <button
                      onClick={() => startEdit(m)}
                      className="rounded p-1 text-gray-400 transition hover:bg-indigo-50 hover:text-indigo-600"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <button
                    onClick={() => removeMember(m?.id)}
                    className="rounded p-1 text-red-400 transition hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              <div className="mt-3 flex items-center gap-2">
                <Briefcase className="h-3.5 w-3.5 text-gray-400" />
                {isEditing ? (
                  <input
                    value={editData.role}
                    onChange={(e) => setEditData({ ...editData, role: e.target.value })}
                    className="w-full rounded border px-2 py-0.5 text-xs"
                  />
                ) : (
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${getRoleStyle(m?.role)}`}>
                    {m?.role ?? 'Miembro'}
                  </span>
                )}
              </div>

              <div className="mt-3 space-y-2">
                <div className="flex items-center gap-2">
                  <Percent className="h-3.5 w-3.5 text-blue-500" />
                  {isEditing ? (
                    <div className="flex flex-1 items-center gap-1">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={editData.dedicationPct}
                        onChange={(e) => setEditData({ ...editData, dedicationPct: e.target.value })}
                        className="w-16 rounded border px-2 py-0.5 text-xs"
                      />
                      <span className="text-xs text-gray-500">% dedicación</span>
                    </div>
                  ) : (
                    <span className="text-xs text-gray-700">
                      <span className="font-semibold text-blue-700">{ded}%</span> dedicación
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <DollarSign className="h-3.5 w-3.5 text-green-500" />
                  {isEditing ? (
                    <div className="flex flex-1 items-center gap-1">
                      <input
                        type="number"
                        min="0"
                        value={editData.monthlyCost}
                        onChange={(e) => setEditData({ ...editData, monthlyCost: e.target.value })}
                        className="w-24 rounded border px-2 py-0.5 text-xs"
                        placeholder="Costo mensual"
                      />
                      <span className="text-xs text-gray-500">/mes</span>
                    </div>
                  ) : (
                    <span className="text-xs text-gray-700">
                      {effectiveCost > 0 ? (
                        <>
                          <span className="font-semibold text-green-700">{formatCurrency(effectiveCost)}</span>/mes
                        </>
                      ) : (
                        <span className="italic text-gray-400">Sin costo</span>
                      )}
                    </span>
                  )}
                </div>
              </div>

              {isEditing && (
                <div className="mt-3">
                  <p className="mb-1.5 flex items-center gap-1 text-xs font-semibold text-gray-700">
                    <Shield className="h-3.5 w-3.5" /> Permisos en este proyecto
                  </p>
                  <PermChecklist value={editPerms} onChange={setEditPerms} />
                </div>
              )}

              {!isEditing && Array.isArray(m.permissions) && m.permissions.length > 0 && (
                <p className="mt-2 text-[11px] text-gray-500">{m.permissions.length} permisos definidos</p>
              )}

              <div className="mt-2">
                <div className="h-1.5 w-full rounded-full bg-gray-100">
                  <div className="h-1.5 rounded-full bg-blue-500 transition-all" style={{ width: `${Math.min(ded, 100)}%` }} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {members.length === 0 && (
        <div className="rounded-xl border border-gray-100 bg-white py-12 text-center shadow-sm">
          <Users className="mx-auto mb-3 h-10 w-10 text-gray-300" />
          <p className="text-sm text-gray-400">{tr('general.noData')}</p>
          <button onClick={() => openAdd('guest')} className="mt-2 text-sm text-indigo-600 hover:underline">
            Invitar aliado al proyecto →
          </button>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowForm(false)}>
          <div
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b p-5">
              <h2 className="text-lg font-semibold">
                {addMode === 'guest' ? 'Agregar aliado / temporal' : 'Agregar miembro de la empresa'}
              </h2>
              <button onClick={() => setShowForm(false)}>
                <X className="h-5 w-5 text-gray-400" />
              </button>
            </div>
            <form onSubmit={addMember} className="space-y-4 p-5">
              {addMode === 'guest' ? (
                <div>
                  <label className="mb-1 block text-sm font-medium">Email del aliado *</label>
                  <input
                    type="email"
                    required
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="w-full rounded-lg border px-3 py-2 text-sm"
                    placeholder="persona@organizacion.org"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    No necesita pertenecer a la empresa. Quedará vinculado solo a este proyecto.
                  </p>
                </div>
              ) : (
                <div>
                  <label className="mb-1 block text-sm font-medium">Usuario *</label>
                  <select
                    required
                    value={form.userId}
                    onChange={(e) => setForm({ ...form, userId: e.target.value })}
                    className="w-full rounded-lg border px-3 py-2 text-sm"
                  >
                    <option value="">Seleccionar...</option>
                    {users.map((u: any) => (
                      <option key={u?.id} value={u?.id}>
                        {u?.name} ({u?.email})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="mb-1 block text-sm font-medium">Rol en el proyecto</label>
                <input
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                  placeholder="Ej: Consultor, Facilitador, Aliado..."
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm font-medium">Dedicación %</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={form.dedicationPct}
                    onChange={(e) => setForm({ ...form, dedicationPct: e.target.value })}
                    className="w-full rounded-lg border px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Costo mensual</label>
                  <input
                    type="number"
                    min="0"
                    value={form.monthlyCost}
                    onChange={(e) => setForm({ ...form, monthlyCost: e.target.value })}
                    className="w-full rounded-lg border px-3 py-2 text-sm"
                    placeholder="Opcional"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 flex items-center gap-1.5 text-sm font-medium">
                  <Shield className="h-4 w-4 text-indigo-600" />
                  Qué puede ver y hacer *
                </label>
                <PermChecklist value={selectedPerms} onChange={setSelectedPerms} />
              </div>

              {error && <p className="text-sm text-red-600">{error}</p>}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="rounded-lg px-4 py-2 text-sm text-gray-600 hover:bg-gray-100"
                >
                  {tr('general.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={saving || selectedPerms.length === 0}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  {saving ? 'Guardando…' : addMode === 'guest' ? 'Invitar al proyecto' : tr('general.create')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
