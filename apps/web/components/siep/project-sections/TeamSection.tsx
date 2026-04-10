'use client';

import { useState, useEffect, useCallback } from 'react';
import { SectionProps } from './types';
import { SectionTooltip } from './SectionTooltip';
import { getInitials, formatCurrency } from '@/lib/utils';
import { Users, Plus, X, Trash2, Mail, Briefcase, Percent, DollarSign, Edit2, Check } from 'lucide-react';

export function TeamSection({ project, onRefresh, tr }: SectionProps) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<any>({ userId: '', role: 'member', dedicationPct: '100', monthlyCost: '' });
  const [users, setUsers] = useState<any[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<any>({});
  const [hrContracts, setHrContracts] = useState<any[]>([]);

  useEffect(() => {
    fetch('/api/users').then(r => r.json()).then(d => setUsers(d?.users ?? [])).catch(() => {});
  }, []);

  // Fetch HR contracts for the company
  const fetchContracts = useCallback(() => {
    if (!project?.companyId) return;
    fetch(`/api/hr/contracts?companyId=${project.companyId}`)
      .then(r => r.json())
      .then(d => setHrContracts(d?.contracts ?? []))
      .catch(() => {});
  }, [project?.companyId]);

  useEffect(() => { fetchContracts(); }, [fetchContracts]);

  const members = project?.members ?? [];

  // Map userId → HR contract
  const contractMap = new Map<string, any>();
  hrContracts.forEach(c => {
    if (!contractMap.has(c.userId)) contractMap.set(c.userId, c);
  });

  const addMember = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch('/api/members', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, projectId: project.id }),
    });
    setShowForm(false);
    setForm({ userId: '', role: 'member', dedicationPct: '100', monthlyCost: '' });
    onRefresh();
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
  };

  const saveEdit = async () => {
    if (!editingId) return;
    await fetch('/api/members', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: editingId, ...editData }),
    });
    setEditingId(null);
    onRefresh();
  };

  const roleColors: Record<string, string> = {
    'director': 'bg-purple-100 text-purple-700',
    'coordinador': 'bg-indigo-100 text-indigo-700',
    'coordinator': 'bg-indigo-100 text-indigo-700',
    'consultor': 'bg-blue-100 text-blue-700',
    'consultant': 'bg-blue-100 text-blue-700',
    'member': 'bg-gray-100 text-gray-700',
    'miembro': 'bg-gray-100 text-gray-700',
    'admin': 'bg-red-100 text-red-700',
  };

  const getRoleStyle = (role: string) => {
    const key = (role ?? '').toLowerCase();
    return roleColors[key] || 'bg-gray-100 text-gray-600';
  };

  // Calculate totals
  const totalMonthlyCost = members.reduce((sum: number, m: any) => {
    const contract = contractMap.get(m.userId);
    const baseSalary = contract?.salary || 0;
    const ded = m.dedicationPct ?? 100;
    const cost = m.monthlyCost || (baseSalary * ded / 100);
    return sum + cost;
  }, 0);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center">
            <Users className="w-5 h-5 text-violet-600" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-gray-900">{tr('project.team')}</h2>
              <SectionTooltip content="Equipo de trabajo asignado al proyecto. Defina el % de dedicación y costo mensual de cada miembro." />
            </div>
            <p className="text-sm text-gray-500">{members.length} miembros · Costo mensual: {formatCurrency(totalMonthlyCost)}</p>
          </div>
        </div>
        <button onClick={() => setShowForm(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 transition">
          <Plus className="w-4 h-4" />
          Agregar Miembro
        </button>
      </div>

      {/* Team Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {members.map((m: any) => {
          const contract = contractMap.get(m.userId);
          const baseSalary = contract?.salary || 0;
          const ded = m.dedicationPct ?? 100;
          const effectiveCost = m.monthlyCost || (baseSalary * ded / 100);
          const isEditing = editingId === m.id;

          return (
            <div key={m?.id} className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-400 to-indigo-600 text-white flex items-center justify-center text-sm font-bold">
                    {getInitials(m?.user?.name)}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">{m?.user?.name ?? ''}</p>
                    <p className="text-xs text-gray-500 flex items-center gap-1">
                      <Mail className="w-3 h-3" />
                      {m?.user?.email ?? ''}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {isEditing ? (
                    <button onClick={saveEdit} className="p-1 text-green-600 hover:bg-green-50 rounded transition">
                      <Check className="w-3.5 h-3.5" />
                    </button>
                  ) : (
                    <button onClick={() => startEdit(m)} className="p-1 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition">
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button onClick={() => removeMember(m?.id)} className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Role */}
              <div className="mt-3 flex items-center gap-2">
                <Briefcase className="w-3.5 h-3.5 text-gray-400" />
                {isEditing ? (
                  <input value={editData.role} onChange={e => setEditData({ ...editData, role: e.target.value })} className="px-2 py-0.5 rounded border text-xs w-full" />
                ) : (
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getRoleStyle(m?.role)}`}>
                    {m?.role ?? 'Miembro'}
                  </span>
                )}
              </div>

              {/* Dedication % + Cost */}
              <div className="mt-3 space-y-2">
                <div className="flex items-center gap-2">
                  <Percent className="w-3.5 h-3.5 text-blue-500" />
                  {isEditing ? (
                    <div className="flex items-center gap-1 flex-1">
                      <input type="number" min="0" max="100" value={editData.dedicationPct} onChange={e => setEditData({ ...editData, dedicationPct: e.target.value })} className="px-2 py-0.5 rounded border text-xs w-16" />
                      <span className="text-xs text-gray-500">% dedicación</span>
                    </div>
                  ) : (
                    <span className="text-xs text-gray-700">
                      <span className="font-semibold text-blue-700">{ded}%</span> dedicación
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <DollarSign className="w-3.5 h-3.5 text-green-500" />
                  {isEditing ? (
                    <div className="flex items-center gap-1 flex-1">
                      <input type="number" min="0" value={editData.monthlyCost} onChange={e => setEditData({ ...editData, monthlyCost: e.target.value })} className="px-2 py-0.5 rounded border text-xs w-24" placeholder={baseSalary > 0 ? `Auto: ${Math.round(baseSalary * (parseFloat(editData.dedicationPct) || 100) / 100)}` : 'Costo mensual'} />
                      <span className="text-xs text-gray-500">/mes</span>
                    </div>
                  ) : (
                    <span className="text-xs text-gray-700">
                      {effectiveCost > 0 ? (
                        <>
                          <span className="font-semibold text-green-700">{formatCurrency(effectiveCost)}</span>/mes
                          {baseSalary > 0 && !m.monthlyCost && (
                            <span className="text-gray-400 ml-1">(de RH: {formatCurrency(baseSalary)})</span>
                          )}
                        </>
                      ) : (
                        <span className="text-gray-400 italic">Sin salario en RH</span>
                      )}
                    </span>
                  )}
                </div>
              </div>

              {/* Dedication bar */}
              <div className="mt-2">
                <div className="w-full bg-gray-100 rounded-full h-1.5">
                  <div className="h-1.5 rounded-full bg-blue-500 transition-all" style={{ width: `${Math.min(ded, 100)}%` }} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {members.length === 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 text-center py-12">
          <Users className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-400">{tr('general.noData')}</p>
          <button onClick={() => setShowForm(true)} className="text-sm text-indigo-600 hover:underline mt-2">Agregar primer miembro →</button>
        </div>
      )}

      {/* Member Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b">
              <h2 className="text-lg font-semibold">Agregar Miembro</h2>
              <button onClick={() => setShowForm(false)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <form onSubmit={addMember} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Usuario *</label>
                <select required value={form.userId} onChange={e => setForm({ ...form, userId: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-sm">
                  <option value="">Seleccionar...</option>
                  {users.map((u: any) => <option key={u?.id} value={u?.id}>{u?.name} ({u?.email})</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Rol</label>
                <input value={form.role} onChange={e => setForm({ ...form, role: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-sm" placeholder="Ej: Coordinador, Consultor..." />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Dedicación %</label>
                  <input type="number" min="0" max="100" value={form.dedicationPct} onChange={e => setForm({ ...form, dedicationPct: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Costo mensual</label>
                  <input type="number" min="0" value={form.monthlyCost} onChange={e => setForm({ ...form, monthlyCost: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-sm" placeholder="Auto desde RH" />
                </div>
              </div>
              <p className="text-xs text-gray-400">Si no se define costo mensual, se calcula automáticamente del salario en RH × % dedicación.</p>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">{tr('general.cancel')}</button>
                <button type="submit" className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium">{tr('general.create')}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
