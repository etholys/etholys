'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useApp } from '@/app/providers';
import { useSession, signOut } from 'next-auth/react';
import {
  Globe,
  Building2,
  Save,
  Plus,
  X,
  Edit2,
  Trash2,
  Layers,
  Shield,
  Mail,
  Copy,
  Check,
  UserPlus,
  User,
  AlertTriangle,
  LayoutGrid,
  ArrowRight,
} from 'lucide-react';

export type SettingsSection =
  | 'profile'
  | 'language'
  | 'companies'
  | 'invitations'
  | 'departments'
  | 'roles'
  | 'systems'
  | 'danger';

type Props = {
  sections: SettingsSection[];
  title: string;
  subtitle?: string;
  accent?: 'teal' | 'slate';
};

export function EtholysSettingsContent({
  sections,
  title,
  subtitle,
  accent = 'teal',
}: Props) {
  const { tr, locale, setLocale } = useApp();
  const { data: session } = useSession() || {};
  const btn = accent === 'slate' ? 'bg-slate-800 hover:bg-slate-900' : 'bg-teal-600 hover:bg-teal-700';
  const btnSoft = accent === 'slate' ? 'bg-slate-100 text-slate-800 hover:bg-slate-200' : 'bg-teal-50 text-teal-600 hover:bg-teal-100';
  const icon = accent === 'slate' ? 'text-slate-700' : 'text-teal-600';

  const show = (s: SettingsSection) => sections.includes(s);

  const [companies, setCompanies] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [invitations, setInvitations] = useState<any[]>([]);
  const [showAddCompany, setShowAddCompany] = useState(false);
  const [editCompany, setEditCompany] = useState<any>(null);
  const [companyForm, setCompanyForm] = useState({
    name: '',
    shortName: '',
    description: '',
    color: '#0D9488',
    currency: 'USD',
  });
  const [showDeptForm, setShowDeptForm] = useState(false);
  const [editDept, setEditDept] = useState<any>(null);
  const [deptForm, setDeptForm] = useState({ companyId: '', name: '', code: '' });
  const [showRoleForm, setShowRoleForm] = useState(false);
  const [editRole, setEditRole] = useState<any>(null);
  const [roleForm, setRoleForm] = useState({
    name: '',
    description: '',
    code: '',
    color: '#6b7280',
    level: 0,
    permissions: '',
  });
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteForm, setInviteForm] = useState({ companyId: '', email: '', role: 'COLLABORATOR' });
  const [copiedCode, setCopiedCode] = useState('');
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState({ name: '', phone: '', currentPassword: '', newPassword: '' });
  const [profileMsg, setProfileMsg] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteText, setDeleteText] = useState('');
  const [deleting, setDeleting] = useState(false);

  const fetchData = () => {
    if (show('companies') || show('invitations') || show('departments')) {
      fetch('/api/companies')
        .then((r) => r.json())
        .then((d) => setCompanies(d?.companies ?? []))
        .catch(() => {});
    }
    if (show('departments')) {
      fetch('/api/departments')
        .then((r) => r.json())
        .then((d) => setDepartments(d?.departments ?? []))
        .catch(() => {});
    }
    if (show('roles')) {
      fetch('/api/roles')
        .then((r) => r.json())
        .then((d) => setRoles(d?.roles ?? []))
        .catch(() => {});
    }
    if (show('invitations')) {
      fetch('/api/invitations')
        .then((r) => r.json())
        .then((d) => setInvitations(d?.invitations ?? []))
        .catch(() => {});
    }
    if (show('profile')) {
      fetch('/api/account')
        .then((r) => r.json())
        .then((d) => {
          if (d?.user) setProfile((p) => ({ ...p, name: d.user.name || '', phone: d.user.phone || '' }));
        })
        .catch(() => {});
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setProfileMsg('');
    const body: Record<string, string> = { name: profile.name, phone: profile.phone };
    if (profile.newPassword && profile.currentPassword) {
      body.currentPassword = profile.currentPassword;
      body.newPassword = profile.newPassword;
    }
    const res = await fetch('/api/account', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (res.ok) {
      setProfileMsg('Perfil actualizado');
      setProfile((p) => ({ ...p, currentPassword: '', newPassword: '' }));
    } else {
      setProfileMsg(data?.error || 'Error al actualizar');
    }
    setSaving(false);
  };

  const handleDeleteAccount = async () => {
    if (deleteText !== 'ELIMINAR') return;
    setDeleting(true);
    const res = await fetch('/api/account', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirm: 'ELIMINAR' }),
    });
    if (res.ok) signOut({ callbackUrl: '/login' });
    else {
      const data = await res.json().catch(() => ({}));
      alert(data?.error || 'Error al eliminar cuenta');
    }
    setDeleting(false);
  };

  const openEditCompany = (c: any) => {
    setEditCompany(c);
    setCompanyForm({
      name: c.name,
      shortName: c.shortName,
      description: c.description || '',
      color: c.color || '#0D9488',
      currency: c.currency || 'USD',
    });
    setShowAddCompany(true);
  };

  const handleSaveCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    if (editCompany) {
      await fetch('/api/companies', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editCompany.id, ...companyForm }),
      });
    } else {
      await fetch('/api/companies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(companyForm),
      });
    }
    setShowAddCompany(false);
    setEditCompany(null);
    setCompanyForm({ name: '', shortName: '', description: '', color: '#0D9488', currency: 'USD' });
    fetchData();
    setSaving(false);
  };

  const handleDeleteCompany = async (id: string, name: string) => {
    if (!confirm(`¿Eliminar empresa "${name}"?`)) return;
    await fetch(`/api/companies?id=${id}`, { method: 'DELETE' });
    fetchData();
  };

  const openCreateDept = (companyId?: string) => {
    setEditDept(null);
    setDeptForm({ companyId: companyId || '', name: '', code: '' });
    setShowDeptForm(true);
  };
  const openEditDept = (d: any) => {
    setEditDept(d);
    setDeptForm({ companyId: d.companyId, name: d.name, code: d.code || '' });
    setShowDeptForm(true);
  };
  const handleSaveDept = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    if (editDept) {
      await fetch('/api/departments', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editDept.id, ...deptForm }),
      });
    } else {
      await fetch('/api/departments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(deptForm),
      });
    }
    setShowDeptForm(false);
    setEditDept(null);
    setDeptForm({ companyId: '', name: '', code: '' });
    fetchData();
    setSaving(false);
  };
  const handleDeleteDept = async (id: string, name: string) => {
    if (!confirm(`¿Eliminar departamento "${name}"?`)) return;
    await fetch(`/api/departments?id=${id}`, { method: 'DELETE' });
    fetchData();
  };

  const openCreateRole = () => {
    setEditRole(null);
    setRoleForm({ name: '', description: '', code: '', color: '#6b7280', level: 0, permissions: '' });
    setShowRoleForm(true);
  };
  const openEditRole = (r: any) => {
    setEditRole(r);
    setRoleForm({
      name: r.name,
      description: r.description || '',
      code: r.code || '',
      color: r.color || '#6b7280',
      level: r.level || 0,
      permissions: r.permissions || '',
    });
    setShowRoleForm(true);
  };
  const handleSaveRole = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    if (editRole) {
      await fetch('/api/roles', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editRole.id, ...roleForm, level: parseInt(String(roleForm.level)) || 0 }),
      });
    } else {
      await fetch('/api/roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...roleForm, level: parseInt(String(roleForm.level)) || 0 }),
      });
    }
    setShowRoleForm(false);
    setEditRole(null);
    setRoleForm({ name: '', description: '', code: '', color: '#6b7280', level: 0, permissions: '' });
    fetchData();
    setSaving(false);
  };
  const handleDeleteRole = async (id: string, name: string) => {
    if (!confirm(`¿Eliminar rol "${name}"?`)) return;
    await fetch(`/api/roles?id=${id}`, { method: 'DELETE' });
    fetchData();
  };

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const res = await fetch('/api/invitations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(inviteForm),
    });
    if (res.ok) {
      setShowInviteForm(false);
      setInviteForm({ companyId: '', email: '', role: 'COLLABORATOR' });
      fetchData();
    } else {
      const data = await res.json().catch(() => ({}));
      alert(data?.error || 'Error al enviar invitación');
    }
    setSaving(false);
  };
  const handleRevokeInvite = async (id: string) => {
    if (!confirm('¿Revocar esta invitación?')) return;
    await fetch(`/api/invitations?id=${id}`, { method: 'DELETE' });
    fetchData();
  };
  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code).catch(() => {});
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(''), 2000);
  };

  const statusColors: Record<string, string> = {
    pending: 'bg-amber-100 text-amber-700',
    accepted: 'bg-green-100 text-green-700',
    revoked: 'bg-red-100 text-red-700',
    expired: 'bg-gray-100 text-gray-500',
  };
  const statusLabels: Record<string, string> = {
    pending: 'Pendiente',
    accepted: 'Aceptada',
    revoked: 'Revocada',
    expired: 'Expirada',
  };

  const systemsCopy =
    locale === 'pt'
      ? {
          title: 'Sistemas e acesso',
          body: 'Defina quais módulos Etholys (ATLAS, SIEP, NEXUS, etc.) cada utilizador pode abrir e permissões SIEP detalhadas.',
          cta: 'Gerir equipa e licenças',
        }
      : locale === 'es'
        ? {
            title: 'Sistemas y acceso',
            body: 'Define qué módulos Etholys (ATLAS, SIEP, NEXUS, etc.) puede abrir cada usuario y permisos SIEP.',
            cta: 'Gestionar equipo y licencias',
          }
        : {
            title: 'Systems & access',
            body: 'Choose which Etholys modules each user can open and fine-grained SIEP permissions.',
            cta: 'Manage team & licenses',
          };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
        {subtitle && <p className="text-gray-500 text-sm mt-1">{subtitle}</p>}
        {session?.user?.email && (
          <p className="text-xs text-gray-400 mt-1">{session.user.email}</p>
        )}
      </div>

      {show('profile') && (
        <div className="bg-white rounded-xl p-5 shadow-sm">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <User className={`w-4 h-4 ${icon}`} />
            Mi Perfil
          </h3>
          <form onSubmit={handleSaveProfile} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Nombre</label>
                <input
                  value={profile.name}
                  onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Teléfono</label>
                <input
                  value={profile.phone}
                  onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border text-sm"
                  placeholder="+598..."
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Contraseña actual</label>
                <input
                  type="password"
                  value={profile.currentPassword}
                  onChange={(e) => setProfile({ ...profile, currentPassword: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border text-sm"
                  placeholder="Solo si deseas cambiar"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Nueva contraseña</label>
                <input
                  type="password"
                  value={profile.newPassword}
                  onChange={(e) => setProfile({ ...profile, newPassword: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border text-sm"
                  placeholder="Mínimo 6 caracteres"
                />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={saving}
                className={`px-4 py-2 text-sm text-white rounded-lg flex items-center gap-1.5 transition disabled:opacity-50 ${btn}`}
              >
                <Save className="w-3.5 h-3.5" />
                Guardar perfil
              </button>
              {profileMsg && <span className="text-sm text-teal-600">{profileMsg}</span>}
            </div>
          </form>
        </div>
      )}

      {show('language') && (
        <div className="bg-white rounded-xl p-5 shadow-sm">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Globe className={`w-4 h-4 ${icon}`} />
            Idioma
          </h3>
          <div className="flex gap-3">
            {(['es', 'pt', 'en'] as const).map((loc) => (
              <button
                key={loc}
                type="button"
                onClick={() => setLocale(loc)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                  locale === loc ? `${btn} text-white` : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {loc === 'es' ? '🇪🇸 Español' : loc === 'pt' ? '🇧🇷 Português' : '🇺🇸 English'}
              </button>
            ))}
          </div>
        </div>
      )}

      {show('systems') && (
        <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200">
          <h3 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
            <LayoutGrid className={`w-4 h-4 ${icon}`} />
            {systemsCopy.title}
          </h3>
          <p className="text-sm text-gray-600 mb-4">{systemsCopy.body}</p>
          <Link
            href="/hub/workspace/team"
            className={`inline-flex items-center gap-2 px-4 py-2 text-sm text-white rounded-lg ${btn}`}
          >
            {systemsCopy.cta}
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      )}

      {show('companies') && (
        <div className="bg-white rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <Building2 className={`w-4 h-4 ${icon}`} />
              {tr('nav.companies')}
            </h3>
            <button
              type="button"
              onClick={() => {
                setEditCompany(null);
                setCompanyForm({ name: '', shortName: '', description: '', color: '#0D9488', currency: 'USD' });
                setShowAddCompany(true);
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg transition ${btnSoft}`}
            >
              <Plus className="w-3.5 h-3.5" />
              {tr('company.new')}
            </button>
          </div>
          <div className="space-y-3">
            {(companies ?? []).map((c: any) => (
              <div key={c?.id} className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 group">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                  style={{ backgroundColor: c?.color ?? '#0D9488' }}
                >
                  {c?.shortName?.slice(0, 2) ?? ''}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900">{c?.name ?? ''}</p>
                  <p className="text-xs text-gray-500">
                    {c?.description ?? ''} · {c?.currency ?? 'USD'} · {c?._count?.companyUsers ?? 0} miembros
                  </p>
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
                  <button type="button" onClick={() => openEditCompany(c)} className="p-1.5 rounded-lg hover:bg-white text-gray-400 hover:text-teal-600">
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button type="button" onClick={() => handleDeleteCompany(c.id, c.name)} className="p-1.5 rounded-lg hover:bg-white text-gray-400 hover:text-red-600">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
            {companies.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-4">No tienes empresas aún.</p>
            )}
          </div>
          {showAddCompany && (
            <form onSubmit={handleSaveCompany} className="mt-4 p-4 border rounded-lg space-y-3">
              <p className="text-sm font-medium text-gray-700">{editCompany ? 'Editar empresa' : 'Nueva empresa'}</p>
              <div className="grid grid-cols-2 gap-3">
                <input required placeholder="Nombre" value={companyForm.name} onChange={(e) => setCompanyForm({ ...companyForm, name: e.target.value })} className="px-3 py-2 rounded-lg border text-sm" />
                <input required placeholder="Abreviación" value={companyForm.shortName} onChange={(e) => setCompanyForm({ ...companyForm, shortName: e.target.value })} className="px-3 py-2 rounded-lg border text-sm" />
              </div>
              <input placeholder="Descripción" value={companyForm.description} onChange={(e) => setCompanyForm({ ...companyForm, description: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-sm" />
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center gap-2">
                  <label className="text-sm text-gray-600">Color:</label>
                  <input type="color" value={companyForm.color} onChange={(e) => setCompanyForm({ ...companyForm, color: e.target.value })} className="w-8 h-8 rounded border-0" />
                </div>
                <select value={companyForm.currency} onChange={(e) => setCompanyForm({ ...companyForm, currency: e.target.value })} className="px-3 py-2 rounded-lg border text-sm">
                  <option value="USD">USD</option>
                  <option value="BRL">BRL</option>
                  <option value="EUR">EUR</option>
                  <option value="CLP">CLP</option>
                  <option value="UYU">UYU</option>
                </select>
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => { setShowAddCompany(false); setEditCompany(null); }} className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">
                  {tr('general.cancel')}
                </button>
                <button type="submit" disabled={saving} className={`px-3 py-1.5 text-sm text-white rounded-lg flex items-center gap-1.5 ${btn}`}>
                  <Save className="w-3.5 h-3.5" />
                  {tr('general.save')}
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {show('invitations') && companies.length > 0 && (
        <div className="bg-white rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <UserPlus className={`w-4 h-4 ${icon}`} />
              Invitaciones
            </h3>
            <button
              type="button"
              onClick={() => {
                setShowInviteForm(true);
                setInviteForm({ companyId: companies[0]?.id || '', email: '', role: 'COLLABORATOR' });
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg transition ${btnSoft}`}
            >
              <Mail className="w-3.5 h-3.5" />
              Invitar miembro
            </button>
          </div>
          {showInviteForm && (
            <form onSubmit={handleSendInvite} className="mb-4 p-4 border rounded-lg space-y-3">
              <select required value={inviteForm.companyId} onChange={(e) => setInviteForm({ ...inviteForm, companyId: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-sm">
                <option value="">Seleccionar empresa...</option>
                {companies.map((c: any) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <input required type="email" placeholder="Email" value={inviteForm.email} onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-sm" />
              <select value={inviteForm.role} onChange={(e) => setInviteForm({ ...inviteForm, role: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-sm">
                <option value="COLLABORATOR">Colaborador</option>
                <option value="TECHNICIAN">Técnico</option>
                <option value="PROJECT_MANAGER">Gerente de Proyecto</option>
                <option value="ADMIN">Administrador</option>
              </select>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setShowInviteForm(false)} className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">
                  {tr('general.cancel')}
                </button>
                <button type="submit" disabled={saving} className={`px-3 py-1.5 text-sm text-white rounded-lg ${btn}`}>
                  Enviar
                </button>
              </div>
            </form>
          )}
          <div className="space-y-2">
            {invitations.map((inv: any) => (
              <div key={inv.id} className="flex items-center gap-3 p-3 rounded-lg bg-gray-50">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 text-sm">{inv.email}</p>
                  <p className="text-xs text-gray-500">
                    {inv.company?.shortName} · <span className="font-mono">{inv.code}</span>
                  </p>
                </div>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${statusColors[inv.status] || ''}`}>
                  {statusLabels[inv.status] || inv.status}
                </span>
                {inv.status === 'pending' && (
                  <button type="button" onClick={() => copyCode(inv.code)} className="p-1.5 text-gray-400 hover:text-teal-600">
                    {copiedCode === inv.code ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                )}
                {inv.status === 'pending' && (
                  <button type="button" onClick={() => handleRevokeInvite(inv.id)} className="p-1.5 text-gray-400 hover:text-red-600">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {show('departments') && companies.length > 0 && (
        <div className="bg-white rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <Layers className={`w-4 h-4 ${icon}`} />
              Departamentos / Sectores
            </h3>
            <button type="button" onClick={() => openCreateDept()} className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg ${btnSoft}`}>
              <Plus className="w-3.5 h-3.5" />
              Nuevo sector
            </button>
          </div>
          {companies.map((c: any) => {
            const depts = departments.filter((d: any) => d.companyId === c.id);
            if (depts.length === 0 && companies.length > 1) return null;
            return (
              <div key={c.id} className="mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: c.color || '#0D9488' }} />
                  <span className="text-sm font-medium text-gray-700">{c.shortName}</span>
                </div>
                <div className="space-y-1 ml-5">
                  {depts.map((d: any) => (
                    <div key={d.id} className="flex items-center gap-2 p-2 rounded bg-gray-50 text-sm group">
                      <span className="flex-1">{d.name}</span>
                      <button type="button" onClick={() => openEditDept(d)} className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-teal-600">
                        <Edit2 className="w-3 h-3" />
                      </button>
                      <button type="button" onClick={() => handleDeleteDept(d.id, d.name)} className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-600">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
          {showDeptForm && (
            <form onSubmit={handleSaveDept} className="mt-4 p-4 border rounded-lg space-y-3">
              <select required value={deptForm.companyId} onChange={(e) => setDeptForm({ ...deptForm, companyId: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-sm">
                <option value="">Empresa...</option>
                {companies.map((c: any) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <input required placeholder="Nombre" value={deptForm.name} onChange={(e) => setDeptForm({ ...deptForm, name: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-sm" />
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setShowDeptForm(false)} className="px-3 py-1.5 text-sm text-gray-600">
                  Cancelar
                </button>
                <button type="submit" className={`px-3 py-1.5 text-sm text-white rounded-lg ${btn}`}>
                  Guardar
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {show('roles') && (
        <div className="bg-white rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <Shield className={`w-4 h-4 ${icon}`} />
              Roles y Permisos (ATLAS)
            </h3>
            <button type="button" onClick={openCreateRole} className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg ${btnSoft}`}>
              <Plus className="w-3.5 h-3.5" />
              Nuevo rol
            </button>
          </div>
          <div className="space-y-2">
            {roles.map((r: any) => (
              <div key={r.id} className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 group">
                <div className="flex-1">
                  <p className="font-medium text-gray-900 text-sm">{r.name}</p>
                  <p className="text-xs text-gray-500">{r.description || ''}</p>
                </div>
                {!r.isSystem && (
                  <button type="button" onClick={() => openEditRole(r)} className="opacity-0 group-hover:opacity-100 p-1.5 text-gray-400 hover:text-teal-600">
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
          {showRoleForm && (
            <form onSubmit={handleSaveRole} className="mt-4 p-4 border rounded-lg space-y-3">
              <input required placeholder="Nombre" value={roleForm.name} onChange={(e) => setRoleForm({ ...roleForm, name: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-sm" />
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setShowRoleForm(false)} className="px-3 py-1.5 text-sm text-gray-600">
                  Cancelar
                </button>
                <button type="submit" className={`px-3 py-1.5 text-sm text-white rounded-lg ${btn}`}>
                  Guardar
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {show('danger') && (
        <div className="bg-white rounded-xl p-5 shadow-sm border-2 border-red-100">
          <h3 className="font-semibold text-red-600 mb-2 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            Zona de peligro
          </h3>
          {!showDeleteConfirm ? (
            <button type="button" onClick={() => setShowDeleteConfirm(true)} className="px-4 py-2 text-sm bg-red-50 text-red-600 rounded-lg hover:bg-red-100 flex items-center gap-2">
              <Trash2 className="w-4 h-4" />
              Eliminar mi cuenta
            </button>
          ) : (
            <div className="space-y-3">
              <input value={deleteText} onChange={(e) => setDeleteText(e.target.value)} placeholder="ELIMINAR" className="w-full px-3 py-2 rounded-lg border border-red-300 text-sm font-mono" />
              <button type="button" onClick={handleDeleteAccount} disabled={deleteText !== 'ELIMINAR' || deleting} className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg disabled:opacity-50">
                {deleting ? 'Eliminando...' : 'Confirmar'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
