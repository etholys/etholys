'use client';

import { useState, useEffect } from 'react';
import { useApp } from '@/app/providers';
import { getInitials } from '@/lib/utils';
import { Users, Mail, Building2, Shield, Plus, X, Edit2, Trash2, Phone, Save } from 'lucide-react';

const SYSTEM_ROLES = ['ADMIN', 'PROJECT_MANAGER', 'TECHNICIAN', 'COLLABORATOR'];


type ML = { es: string; pt: string; en: string };
const ml = (en: string, es: string, pt: string): ML => ({ en, es, pt });
export default function TeamPage() {
  const {tr, activeCompanyId, locale } = useApp();
  const L = (m: ML) => m[locale] || m.en;
  const [users, setUsers] = useState<any[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [customRoles, setCustomRoles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editUser, setEditUser] = useState<any>(null);
  const [form, setForm] = useState({ name: '', email: '', phone: '', role: 'COLLABORATOR', password: '', companyIds: [] as string[], departmentId: '' });
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');

  const fetchUsers = () => {
    fetch('/api/users').then(r => r.json()).then(d => { setUsers(d?.users ?? []); setLoading(false); }).catch(() => setLoading(false));
  };

  useEffect(() => {
    fetchUsers();
    fetch('/api/companies').then(r => r.json()).then(d => setCompanies(d?.companies ?? [])).catch(() => {});
    fetch('/api/departments').then(r => r.json()).then(d => setDepartments(d?.departments ?? [])).catch(() => {});
    fetch('/api/roles').then(r => r.json()).then(d => setCustomRoles(d?.roles ?? [])).catch(() => {});
  }, []);

  const getRoleInfo = (userRole: string) => {
    const cr = customRoles.find(r => r.code === userRole || r.name.toUpperCase().replace(/\s+/g, '_') === userRole);
    if (cr) return { name: cr.name, color: cr.color || '#6b7280' };
    return { name: tr(`role.${userRole.toLowerCase()}`), color: userRole === 'ADMIN' ? '#ef4444' : userRole === 'PROJECT_MANAGER' ? '#7c3aed' : userRole === 'TECHNICIAN' ? '#f59e0b' : '#22c55e' };
  };

  const openCreate = () => {
    setEditUser(null);
    setForm({ name: '', email: '', phone: '', role: 'COLLABORATOR', password: '', companyIds: activeCompanyId ? [activeCompanyId] : [], departmentId: '' });
    setShowForm(true);
  };

  const openEdit = (u: any) => {
    setEditUser(u);
    setForm({
      name: u.name || '', email: u.email || '', phone: u.phone || '', role: u.role || 'COLLABORATOR', password: '',
      companyIds: (u.companyUsers ?? []).map((cu: any) => cu?.company?.id).filter(Boolean),
      departmentId: u.departmentUsers?.[0]?.department?.id || '',
    });
    setShowForm(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const body: any = {
      name: form.name, email: form.email, phone: form.phone || null, role: form.role,
      companyIds: form.companyIds, departmentId: form.departmentId || null,
    };
    if (form.password) body.password = form.password;
    if (editUser) {
      body.id = editUser.id;
      await fetch('/api/users', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    } else {
      if (!form.password) body.password = 'temp1234';
      await fetch('/api/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    }
    setShowForm(false);
    fetchUsers();
    setSaving(false);
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`${L(ml("Delete","¿Eliminar a","Excluir"))} ${name}?`)) return;
    await fetch(`/api/users?id=${id}`, { method: 'DELETE' });
    fetchUsers();
  };

  const toggleCompany = (companyId: string) => {
    setForm(prev => ({
      ...prev,
      companyIds: prev.companyIds.includes(companyId)
        ? prev.companyIds.filter(id => id !== companyId)
        : [...prev.companyIds, companyId],
      departmentId: '',
    }));
  };

  const filtered = users.filter(u => {
    if (search && !(u?.name ?? '').toLowerCase().includes(search.toLowerCase()) && !(u?.email ?? '').toLowerCase().includes(search.toLowerCase())) return false;
    if (activeCompanyId && !(u?.companyUsers ?? []).some((cu: any) => cu?.company?.id === activeCompanyId)) return false;
    return true;
  });

  const companyDepts = departments.filter((d: any) => form.companyIds.length === 0 || form.companyIds.includes(d.companyId));

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-3 border-teal-600/30 border-t-teal-600 rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{tr('nav.team')}</h1>
          <p className="text-gray-500 text-sm">{filtered.length} {L(ml('members','miembros','membros'))}</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2.5 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition font-medium text-sm">
          <Plus className="w-4 h-4" />{L(ml("New member","Nuevo miembro","Novo membro"))}
        </button>
      </div>

      <div className="relative">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder={L(ml('Search by name or email...','Buscar por nombre o email...','Buscar por nome ou email...'))}  className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-200 focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none text-sm" />
        <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filtered.map((u: any) => {
          const roleInfo = getRoleInfo(u?.role ?? '');
          return (
            <div key={u?.id} className="bg-white rounded-xl p-5 shadow-sm hover:shadow-md transition group">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center font-bold">{getInitials(u?.name)}</div>
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 truncate">{u?.name ?? ''}</p>
                    <p className="text-xs text-gray-500 flex items-center gap-1 truncate"><Mail className="w-3 h-3 flex-shrink-0" />{u?.email ?? ''}</p>
                  </div>
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
                  <button onClick={() => openEdit(u)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-teal-600"><Edit2 className="w-3.5 h-3.5" /></button>
                  <button onClick={() => handleDelete(u.id, u.name)} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>
              {u?.phone && <p className="text-xs text-gray-500 flex items-center gap-1 mb-2"><Phone className="w-3 h-3" />{u.phone}</p>}
              <div className="flex items-center gap-2 mb-3">
                <Shield className="w-3.5 h-3.5" style={{ color: roleInfo.color }} />
                <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor: roleInfo.color + '15', color: roleInfo.color }}>
                  {roleInfo.name}
                </span>
              </div>
              <div className="flex flex-wrap gap-1">
                {(u?.companyUsers ?? []).map((cu: any) => (
                  <span key={cu?.id} className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 flex items-center gap-1">
                    <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: cu?.company?.color ?? '#0D9488' }} />
                    {cu?.company?.shortName ?? ''}
                  </span>
                ))}
                {(u?.departmentUsers ?? []).map((du: any) => (
                  <span key={du?.id} className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-600">{du?.department?.name ?? ''}</span>
                ))}
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && <div className="col-span-full text-center py-12 text-gray-400">{tr('general.noData')}</div>}
      </div>

      {/* Create/Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b">
              <h2 className="text-lg font-semibold">{editUser ? L(ml('Edit member','Editar miembro','Editar membro')) : L(ml('New member','Nuevo miembro','Novo membro'))}</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSave} className="p-5 space-y-4">
              <div><label className="block text-sm font-medium text-gray-700 mb-1">{L(ml("Name *","Nombre *","Nome *"))}</label>
                <input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-sm focus:ring-2 focus:ring-teal-500 outline-none" /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">{L(ml("Email *","Email *","E-mail *"))}</label>
                <input required type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-sm focus:ring-2 focus:ring-teal-500 outline-none" /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">{L(ml("Phone","Teléfono","Telefone"))}</label>
                <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-sm focus:ring-2 focus:ring-teal-500 outline-none" /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">{editUser ? 'Nueva contraseña (vacío = sin cambio)' : L(ml('Password', 'Contraseña', 'Senha'))}</label>
                <input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder={editUser ? '••••••' : 'temp1234'} className="w-full px-3 py-2 rounded-lg border text-sm focus:ring-2 focus:ring-teal-500 outline-none" /></div>
              
              {/* Role - from custom roles */}
              <div><label className="block text-sm font-medium text-gray-700 mb-1">{L(ml("Role","Rol","Função"))}</label>
                <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-sm focus:ring-2 focus:ring-teal-500 outline-none">
                  {SYSTEM_ROLES.map(r => <option key={r} value={r}>{tr(`role.${r.toLowerCase()}`)}</option>)}
                </select>
                {customRoles.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {customRoles.filter(r => !r.isSystem).map((r: any) => (
                      <span key={r.id} className="text-[10px] px-2 py-1 rounded-full border" style={{ borderColor: r.color, color: r.color }}>
                        {r.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Multi-company selection */}
              <div><label className="block text-sm font-medium text-gray-700 mb-1">{L(ml("Companies","Empresas","Empresas"))}</label>
                <div className="space-y-1">
                  {companies.map((c: any) => (
                    <label key={c.id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 cursor-pointer text-sm">
                      <input type="checkbox" checked={form.companyIds.includes(c.id)} onChange={() => toggleCompany(c.id)} className="rounded text-teal-600 focus:ring-teal-500" />
                      <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: c.color || '#0D9488' }} />
                      <span>{c.name} ({c.shortName})</span>
                    </label>
                  ))}
                </div>
              </div>

              {form.companyIds.length > 0 && companyDepts.length > 0 && (
                <div><label className="block text-sm font-medium text-gray-700 mb-1">{L(ml("Department / Sector","Departamento / Sector","Departamento / Setor"))}</label>
                  <select value={form.departmentId} onChange={e => setForm({ ...form, departmentId: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-sm focus:ring-2 focus:ring-teal-500 outline-none">
                    <option value="">{L(ml("Unassigned","Sin asignar","Sem atribuição"))}</option>
                    {companyDepts.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select></div>
              )}
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">{tr('general.cancel')}</button>
                <button type="submit" disabled={saving} className="px-4 py-2 text-sm bg-teal-600 text-white rounded-lg hover:bg-teal-700 flex items-center gap-1.5 font-medium"><Save className="w-3.5 h-3.5" />{tr('general.save')}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}