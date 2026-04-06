'use client';

import { useState, useEffect, useMemo, Fragment } from 'react';
import { useApp } from '@/app/providers';
import {
  UserCog, Plus, Trash2, Search, X, Briefcase, DollarSign, Users,
  CalendarDays, Clock, CheckCircle2, XCircle, AlertCircle, GitBranch, Pencil
} from 'lucide-react';

const TYPE_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  FULL_TIME: { label: 'Tiempo completo', color: 'text-emerald-600', bg: 'bg-emerald-50' },
  PART_TIME: { label: 'Medio tiempo', color: 'text-blue-600', bg: 'bg-blue-50' },
  CONTRACTOR: { label: 'Contratista', color: 'text-purple-600', bg: 'bg-purple-50' },
  INTERN: { label: 'Pasante', color: 'text-amber-600', bg: 'bg-amber-50' },
};

const LEAVE_TYPES: Record<string, { label: string; color: string; bg: string }> = {
  vacation: { label: 'Vacaciones', color: 'text-blue-600', bg: 'bg-blue-50' },
  sick: { label: 'Enfermedad', color: 'text-red-600', bg: 'bg-red-50' },
  personal: { label: 'Personal', color: 'text-purple-600', bg: 'bg-purple-50' },
  maternity: { label: 'Maternidad/Paternidad', color: 'text-pink-600', bg: 'bg-pink-50' },
  other: { label: 'Otro', color: 'text-gray-600', bg: 'bg-gray-50' },
};

const LEAVE_STATUS: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  pending: { label: 'Pendiente', color: 'text-amber-600', bg: 'bg-amber-50', icon: Clock },
  approved: { label: 'Aprobada', color: 'text-emerald-600', bg: 'bg-emerald-50', icon: CheckCircle2 },
  rejected: { label: 'Rechazada', color: 'text-red-600', bg: 'bg-red-50', icon: XCircle },
};

function formatMoney(amount: number, currency: string = 'USD') {
  return new Intl.NumberFormat('es-UY', { style: 'currency', currency, minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(amount);
}

function toInputDate(d: string | Date | null | undefined) {
  if (!d) return '';
  const x = new Date(d);
  if (Number.isNaN(x.getTime())) return '';
  const y = x.getFullYear();
  const m = String(x.getMonth() + 1).padStart(2, '0');
  const day = String(x.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function contractTypeToForm(t: string | undefined) {
  const u = (t || 'full_time').toLowerCase().replace(/-/g, '_');
  const m: Record<string, string> = {
    full_time: 'FULL_TIME',
    part_time: 'PART_TIME',
    contractor: 'CONTRACTOR',
    intern: 'INTERN',
  };
  return m[u] || 'FULL_TIME';
}

const INITIAL_CONTRACT_FORM = {
  userId: '',
  companyId: '',
  type: 'FULL_TIME',
  position: '',
  department: '',
  salary: '',
  currency: 'USD',
  hoursPerWeek: '40',
  startDate: '',
  endDate: '',
  socialSecurity: '',
  healthInsurance: '',
  otherDeductions: '',
  bonuses: '',
  notes: '',
};


type ML = { es: string; pt: string; en: string };
const ml = (en: string, es: string, pt: string): ML => ({ en, es, pt });
export default function HRPage() {
  const {activeCompanyId, locale } = useApp();
  const L = (m: ML) => m[locale] || m.en;
  const [tab, setTab] = useState<'contracts' | 'leaves' | 'payroll' | 'allocations'>('contracts');
  const [allocations, setAllocations] = useState<any[]>([]);
  const [allocLoading, setAllocLoading] = useState(false);
  const [contracts, setContracts] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingContractId, setEditingContractId] = useState<string | null>(null);
  const [searchText, setSearchText] = useState('');
  const [filterType, setFilterType] = useState('');
  const [form, setForm] = useState(() => ({ ...INITIAL_CONTRACT_FORM }));
  // Leaves state
  const [leaves, setLeaves] = useState<any[]>([]);
  const [showLeaveForm, setShowLeaveForm] = useState(false);
  const [leaveForm, setLeaveForm] = useState({
    userId: '', companyId: '', type: 'vacation', startDate: '', endDate: '', reason: ''
  });

  // Inline member creation state
  const [showInlineCreate, setShowInlineCreate] = useState(false);
  const [inlineForm, setInlineForm] = useState({ name: '', email: '', password: '' });
  const [inlineLoading, setInlineLoading] = useState(false);
  const [inlineError, setInlineError] = useState('');

  const fetchData = async () => {
    setLoading(true);
    try {
      const [ctRes, compRes, lvRes, usrRes] = await Promise.all([
        fetch(`/api/hr/contracts${activeCompanyId ? `?companyId=${activeCompanyId}` : ''}`),
        fetch('/api/companies'),
        fetch(`/api/leave-requests${activeCompanyId ? `?companyId=${activeCompanyId}` : ''}`),
        fetch('/api/users'),
      ]);
      const ctData = await ctRes.json();
      const compData = await compRes.json();
      const lvData = await lvRes.json();
      const usrData = await usrRes.json();
      setContracts(ctData?.contracts ?? []);
      setCompanies(compData?.companies ?? []);
      setLeaves(lvData?.leaves ?? []);
      setUsers(usrData?.users ?? []);
    } catch {} finally { setLoading(false); }
  };

  const handleInlineCreate = async () => {
    if (!inlineForm.name || !inlineForm.email) { setInlineError('Nombre y email son obligatorios'); return; }
    setInlineLoading(true);
    setInlineError('');
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: inlineForm.name,
          email: inlineForm.email,
          password: inlineForm.password || 'temp1234',
          companyId: activeCompanyId || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al crear');
      const newUser = data.user || data;
      // Refresh user list and auto-select the new user
      const usrRes = await fetch('/api/users');
      const usrData = await usrRes.json();
      setUsers(usrData?.users ?? []);
      setForm(f => ({ ...f, userId: newUser.id }));
      setShowInlineCreate(false);
      setInlineForm({ name: '', email: '', password: '' });
    } catch (err: any) {
      setInlineError(err.message);
    } finally {
      setInlineLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [activeCompanyId]);

  // Fetch allocation summary when tab is selected
  useEffect(() => {
    if (tab !== 'allocations' || !activeCompanyId) return;
    setAllocLoading(true);
    fetch(`/api/sync-project-budget?companyId=${activeCompanyId}`)
      .then(r => r.json())
      .then(d => setAllocations(d?.summary ?? []))
      .catch(() => {})
      .finally(() => setAllocLoading(false));
  }, [tab, activeCompanyId]);

  const filtered = useMemo(() => {
    return contracts.filter(c => {
      if (filterType && c.type !== filterType) return false;
      if (searchText) {
        const q = searchText.toLowerCase();
        const mName = c.user?.name?.toLowerCase() || '';
        if (!mName.includes(q) && !c.position?.toLowerCase().includes(q) && !c.department?.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [contracts, filterType, searchText]);

  const stats = useMemo(() => {
    const activeContracts = contracts.filter(c => !c.endDate || new Date(c.endDate) >= new Date());
    const active = activeContracts.length;
    const salaryByCurrency = new Map<string, number>();
    for (const c of activeContracts) {
      const cur = c.currency || 'USD';
      salaryByCurrency.set(cur, (salaryByCurrency.get(cur) || 0) + (c.salary || 0));
    }
    const payrollByCurrency = [...salaryByCurrency.entries()].sort(([a], [b]) => a.localeCompare(b));
    const pendingLeaves = leaves.filter(l => l.status === 'pending').length;
    const approvedLeaves = leaves.filter(l => l.status === 'approved').length;
    return { active, payrollByCurrency, pendingLeaves, approvedLeaves };
  }, [contracts, leaves]);

  const closeContractModal = () => {
    setShowForm(false);
    setEditingContractId(null);
    setForm({ ...INITIAL_CONTRACT_FORM });
  };

  const openNewContract = () => {
    setEditingContractId(null);
    setForm({ ...INITIAL_CONTRACT_FORM });
    setShowForm(true);
  };

  const openEditContract = (c: any) => {
    setEditingContractId(c.id);
    setForm({
      userId: c.userId || '',
      companyId: c.companyId || '',
      type: contractTypeToForm(c.type),
      position: c.position || '',
      department: c.department || '',
      salary: c.salary != null && c.salary !== '' ? String(c.salary) : '',
      currency: c.currency || 'USD',
      hoursPerWeek: c.hoursPerWeek != null && c.hoursPerWeek !== '' ? String(c.hoursPerWeek) : '40',
      startDate: toInputDate(c.startDate),
      endDate: toInputDate(c.endDate),
      socialSecurity: c.socialSecurity != null ? String(c.socialSecurity) : '',
      healthInsurance: c.healthInsurance != null ? String(c.healthInsurance) : '',
      otherDeductions: c.otherDeductions != null ? String(c.otherDeductions) : '',
      bonuses: c.bonuses != null ? String(c.bonuses) : '',
      notes: c.notes || '',
    });
    setShowForm(true);
  };

  const handleSubmit = async () => {
    const base = {
      type: form.type,
      position: form.position || undefined,
      department: form.department || undefined,
      salary: form.salary !== '' ? Number(form.salary) : undefined,
      currency: form.currency,
      hoursPerWeek: form.hoursPerWeek !== '' ? Number(form.hoursPerWeek) : undefined,
      startDate: form.startDate || undefined,
      endDate: form.endDate,
      socialSecurity: form.socialSecurity !== '' ? Number(form.socialSecurity) : 0,
      healthInsurance: form.healthInsurance !== '' ? Number(form.healthInsurance) : 0,
      otherDeductions: form.otherDeductions !== '' ? Number(form.otherDeductions) : 0,
      bonuses: form.bonuses !== '' ? Number(form.bonuses) : 0,
      notes: form.notes || undefined,
    };

    if (editingContractId) {
      const res = await fetch('/api/hr/contracts', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editingContractId, ...base }),
      });
      if (res.ok) {
        closeContractModal();
        fetchData();
      }
      return;
    }

    const body = {
      memberId: form.userId,
      companyId: form.companyId || activeCompanyId,
      ...base,
    };
    const res = await fetch('/api/hr/contracts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (res.ok) {
      closeContractModal();
      fetchData();
    }
  };

  const deleteContract = async (id: string) => {
    if (!confirm('¿Eliminar este contrato?')) return;
    await fetch(`/api/hr/contracts?id=${id}`, { method: 'DELETE' });
    fetchData();
  };

  const handleLeaveSubmit = async () => {
    const compId = leaveForm.companyId || activeCompanyId || companies[0]?.id;
    if (!compId || !leaveForm.startDate || !leaveForm.endDate) return;
    await fetch('/api/leave-requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...leaveForm, companyId: compId }),
    });
    setShowLeaveForm(false);
    setLeaveForm({ userId: '', companyId: '', type: 'vacation', startDate: '', endDate: '', reason: '' });
    fetchData();
  };

  const updateLeaveStatus = async (id: string, status: string) => {
    await fetch('/api/leave-requests', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status }),
    });
    fetchData();
  };

  const deleteLeave = async (id: string) => {
    if (!confirm('¿Eliminar esta solicitud?')) return;
    await fetch(`/api/leave-requests?id=${id}`, { method: 'DELETE' });
    fetchData();
  };

  const getUserName = (userId: string) => {
    const u = users.find(u => u.id === userId);
    return u?.name || u?.email || L(ml('User','Usuario','Usuário'));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{L(ml("Human Resources","Recursos Humanos","Recursos Humanos"))}</h1>
          <p className="text-sm text-gray-500 mt-1">Contratos laborales y solicitudes de licencia</p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-900 rounded-xl border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-teal-50"><Users className="w-5 h-5 text-teal-600" /></div>
            <div><p className="text-xs text-gray-500">Contratos activos</p><p className="text-xl font-bold">{stats.active}</p></div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-xl border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-50"><DollarSign className="w-5 h-5 text-emerald-600" /></div>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-gray-500">Nómina mensual (por moneda)</p>
              {stats.payrollByCurrency.length === 0 ? (
                <p className="text-xl font-bold text-gray-400">—</p>
              ) : (
                <div className="space-y-0.5 mt-0.5">
                  {stats.payrollByCurrency.map(([cur, amt]) => (
                    <p key={cur} className="text-lg font-bold leading-tight">{formatMoney(amt, cur)}</p>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-xl border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-50"><Clock className="w-5 h-5 text-amber-600" /></div>
            <div><p className="text-xs text-gray-500">Licencias pendientes</p><p className="text-xl font-bold">{stats.pendingLeaves}</p></div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-xl border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-50"><CalendarDays className="w-5 h-5 text-blue-600" /></div>
            <div><p className="text-xs text-gray-500">Licencias aprobadas</p><p className="text-xl font-bold">{stats.approvedLeaves}</p></div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b">
        <button onClick={() => setTab('contracts')} className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition ${tab === 'contracts' ? 'border-teal-600 text-teal-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
          <Briefcase className="w-4 h-4 inline mr-1.5" />Contratos
        </button>
        <button onClick={() => setTab('leaves')} className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition ${tab === 'leaves' ? 'border-teal-600 text-teal-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
          <CalendarDays className="w-4 h-4 inline mr-1.5" />Licencias / Vacaciones
          {stats.pendingLeaves > 0 && <span className="ml-1.5 bg-amber-100 text-amber-700 text-xs px-1.5 py-0.5 rounded-full">{stats.pendingLeaves}</span>}
        </button>
        <button onClick={() => setTab('payroll')} className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition ${tab === 'payroll' ? 'border-teal-600 text-teal-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
          <DollarSign className="w-4 h-4 inline mr-1.5" />Nómina / Folha
        </button>
        <button onClick={() => setTab('allocations')} className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition ${tab === 'allocations' ? 'border-teal-600 text-teal-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
          <GitBranch className="w-4 h-4 inline mr-1.5" />Asignaciones / Alocações
        </button>
      </div>

      {/* CONTRACTS TAB */}
      {tab === 'contracts' && (
        <>
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input value={searchText} onChange={e => setSearchText(e.target.value)} placeholder="Buscar por nombre, cargo o departamento..." className="w-full pl-10 pr-4 py-2 rounded-lg border text-sm" />
            </div>
            <select value={filterType} onChange={e => setFilterType(e.target.value)} className="px-3 py-2 rounded-lg border text-sm">
              <option value="">{L(ml('All types','Todos los tipos','Todos os tipos'))}</option>
              {Object.entries(TYPE_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
            <button onClick={openNewContract} className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 text-sm">
              <Plus className="w-4 h-4" /> Contrato
            </button>
          </div>

          <div className="bg-white dark:bg-gray-900 rounded-xl border overflow-hidden">
            {loading ? (
              <div className="p-12 text-center"><div className="w-8 h-8 border-3 border-teal-600/30 border-t-teal-600 rounded-full animate-spin mx-auto" /></div>
            ) : filtered.length === 0 ? (
              <div className="p-12 text-center text-gray-400"><UserCog className="w-12 h-12 mx-auto mb-3 opacity-50" /><p>No hay contratos registrados</p></div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-800 border-b">
                    <tr>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Empleado</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Tipo</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Cargo</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">{L(ml("Department","Departamento","Departamento"))}</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">{L(ml("Salary","Salario","Salário"))}</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Hs/Sem</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Inicio</th>
                      <th className="text-right px-4 py-3 font-medium text-gray-600">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filtered.map(c => {
                      const typeConf = TYPE_CONFIG[c.type] || TYPE_CONFIG.FULL_TIME;
                      const isActive = !c.endDate || new Date(c.endDate) >= new Date();
                      return (
                        <tr key={c.id} className={`hover:bg-gray-50 dark:hover:bg-gray-800 transition ${!isActive ? 'opacity-50' : ''}`}>
                          <td className="px-4 py-3">
                            <p className="font-medium">{c.user?.name || 'Sin nombre'}</p>
                            <p className="text-xs text-gray-400">{c.user?.email || ''}</p>
                          </td>
                          <td className="px-4 py-3"><span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${typeConf.bg} ${typeConf.color}`}>{typeConf.label}</span></td>
                          <td className="px-4 py-3">{c.position || '-'}</td>
                          <td className="px-4 py-3 text-gray-500">{c.department || '-'}</td>
                          <td className="px-4 py-3 font-semibold">{c.salary ? formatMoney(c.salary, c.currency) : '-'}</td>
                          <td className="px-4 py-3 text-gray-500">{c.hoursPerWeek || '-'}</td>
                          <td className="px-4 py-3 text-gray-500">{c.startDate ? new Date(c.startDate).toLocaleDateString('es-UY') : '-'}</td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-0.5">
                              <button type="button" onClick={() => openEditContract(c)} className="p-1.5 rounded hover:bg-teal-50 text-teal-600" title="Editar">
                                <Pencil className="w-4 h-4" />
                              </button>
                              <button type="button" onClick={() => deleteContract(c.id)} className="p-1.5 rounded hover:bg-red-50 text-red-400" title="Eliminar">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* LEAVES TAB */}
      {tab === 'leaves' && (
        <>
          <div className="flex justify-end">
            <button onClick={() => setShowLeaveForm(true)} className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 text-sm">
              <Plus className="w-4 h-4" /> Solicitar licencia
            </button>
          </div>

          <div className="bg-white dark:bg-gray-900 rounded-xl border overflow-hidden">
            {leaves.length === 0 ? (
              <div className="p-12 text-center text-gray-400"><CalendarDays className="w-12 h-12 mx-auto mb-3 opacity-50" /><p>No hay solicitudes de licencia</p></div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-800 border-b">
                    <tr>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Empleado</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Tipo</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Desde</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Hasta</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">{L(ml("Days","Días","Dias"))}</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">{L(ml("Reason","Motivo","Motivo"))}</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Estado</th>
                      <th className="text-right px-4 py-3 font-medium text-gray-600">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {leaves.map(l => {
                      const lType = LEAVE_TYPES[l.type] || LEAVE_TYPES.other;
                      const lStatus = LEAVE_STATUS[l.status] || LEAVE_STATUS.pending;
                      const StatusIcon = lStatus.icon;
                      return (
                        <tr key={l.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                          <td className="px-4 py-3 font-medium">{getUserName(l.userId)}</td>
                          <td className="px-4 py-3"><span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${lType.bg} ${lType.color}`}>{lType.label}</span></td>
                          <td className="px-4 py-3 text-gray-500">{new Date(l.startDate).toLocaleDateString('es-UY')}</td>
                          <td className="px-4 py-3 text-gray-500">{new Date(l.endDate).toLocaleDateString('es-UY')}</td>
                          <td className="px-4 py-3 font-semibold">{l.days}</td>
                          <td className="px-4 py-3 text-gray-500 max-w-[200px] truncate">{l.reason || '-'}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${lStatus.bg} ${lStatus.color}`}>
                              <StatusIcon className="w-3 h-3" /> {lStatus.label}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-1">
                              {l.status === 'pending' && (
                                <>
                                  <button onClick={() => updateLeaveStatus(l.id, 'approved')} className="p-1.5 rounded hover:bg-emerald-50 text-emerald-600" title="Aprobar">
                                    <CheckCircle2 className="w-4 h-4" />
                                  </button>
                                  <button onClick={() => updateLeaveStatus(l.id, 'rejected')} className="p-1.5 rounded hover:bg-red-50 text-red-500" title="Rechazar">
                                    <XCircle className="w-4 h-4" />
                                  </button>
                                </>
                              )}
                              <button onClick={() => deleteLeave(l.id)} className="p-1.5 rounded hover:bg-red-50 text-red-400" title="Eliminar">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* PAYROLL TAB */}
      {tab === 'payroll' && (() => {
        const activeContracts = contracts.filter(c => !c.endDate || new Date(c.endDate) >= new Date());
        const rowFor = (c: any) => {
          const gross = c.salary || 0;
          const ss = c.socialSecurity || 0;
          const hi = c.healthInsurance || 0;
          const other = c.otherDeductions || 0;
          const bonus = c.bonuses || 0;
          const totalDeductions = ss + hi + other;
          const net = gross - totalDeductions + bonus;
          return { ...c, gross, ss, hi, other, bonus, totalDeductions, net };
        };
        const currencies = [...new Set(activeContracts.map(c => c.currency || 'USD'))].sort();
        const payrollByCurrency = currencies.map(cur => {
          const rows = activeContracts.filter(c => (c.currency || 'USD') === cur).map(rowFor);
          const totGross = rows.reduce((s, r) => s + r.gross, 0);
          const totDeductions = rows.reduce((s, r) => s + r.totalDeductions, 0);
          const totBonus = rows.reduce((s, r) => s + r.bonus, 0);
          const totNet = rows.reduce((s, r) => s + r.net, 0);
          const totSs = rows.reduce((s, r) => s + r.ss, 0);
          const totHi = rows.reduce((s, r) => s + r.hi, 0);
          const totOther = rows.reduce((s, r) => s + r.other, 0);
          return { cur, rows, totGross, totDeductions, totBonus, totNet, totSs, totHi, totOther };
        });
        const allRows = activeContracts.map(rowFor);

        return (
          <div className="space-y-6">
            {payrollByCurrency.length > 1 && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-900">
                <p className="font-medium flex items-center gap-1.5"><AlertCircle className="w-4 h-4 shrink-0" /> Varios tipos de moneda</p>
                <p className="text-xs text-amber-800 mt-1">Los totales se muestran por moneda; no se convierten ni suman entre USD, BRL, etc.</p>
              </div>
            )}

            <div className="space-y-4">
              {payrollByCurrency.map(({ cur, rows, totGross, totDeductions, totBonus, totNet }) => (
                <Fragment key={cur}>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="bg-white dark:bg-gray-900 rounded-xl border p-4">
                      <p className="text-xs text-gray-500">Bruto total ({cur})</p>
                      <p className="text-xl font-bold text-gray-900 mt-1">{formatMoney(totGross, cur)}</p>
                    </div>
                    <div className="bg-white dark:bg-gray-900 rounded-xl border p-4">
                      <p className="text-xs text-gray-500">Deducciones ({cur})</p>
                      <p className="text-xl font-bold text-red-500 mt-1">-{formatMoney(totDeductions, cur)}</p>
                    </div>
                    <div className="bg-white dark:bg-gray-900 rounded-xl border p-4">
                      <p className="text-xs text-gray-500">Bonificaciones ({cur})</p>
                      <p className="text-xl font-bold text-emerald-600 mt-1">+{formatMoney(totBonus, cur)}</p>
                    </div>
                    <div className="bg-white dark:bg-gray-900 rounded-xl border p-4">
                      <p className="text-xs text-gray-500">Neto ({cur})</p>
                      <p className="text-xl font-bold text-teal-600 mt-1">{formatMoney(totNet, cur)}</p>
                    </div>
                  </div>
                </Fragment>
              ))}
            </div>

            <div className="bg-white dark:bg-gray-900 rounded-xl border overflow-hidden">
              <div className="px-5 py-4 border-b bg-gray-50 dark:bg-gray-800">
                <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-teal-600" />
                  {'N\u00f3mina Mensual / Folha de Pagamento'}
                </h3>
                <p className="text-xs text-gray-500 mt-1">{activeContracts.length} contrato(s) activo(s)</p>
              </div>
              {allRows.length === 0 ? (
                <div className="p-12 text-center text-gray-400">
                  <DollarSign className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No hay contratos activos para calcular n{String.fromCharCode(243)}mina</p>
                  <p className="text-xs mt-1">Crea contratos en la pesta{String.fromCharCode(241)}a Contratos primero.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 dark:bg-gray-800 border-b">
                      <tr>
                        <th className="text-left px-4 py-3 font-medium text-gray-600">Empleado</th>
                        <th className="text-left px-4 py-3 font-medium text-gray-600">Cargo</th>
                        <th className="text-left px-4 py-3 font-medium text-gray-500">Mon.</th>
                        <th className="text-right px-4 py-3 font-medium text-gray-600">Bruto</th>
                        <th className="text-right px-4 py-3 font-medium text-red-500">Seg. Social</th>
                        <th className="text-right px-4 py-3 font-medium text-red-500">Salud</th>
                        <th className="text-right px-4 py-3 font-medium text-red-500">Otras ded.</th>
                        <th className="text-right px-4 py-3 font-medium text-emerald-600">Bonific.</th>
                        <th className="text-right px-4 py-3 font-medium text-teal-600">Neto</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {payrollByCurrency.map(({ cur, rows, totGross, totBonus, totNet, totSs, totHi, totOther }) => (
                        <Fragment key={`b-${cur}`}>
                          {rows.map(r => (
                            <tr key={r.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                              <td className="px-4 py-3">
                                <p className="font-medium">{r.user?.name || 'Sin nombre'}</p>
                                <p className="text-xs text-gray-400">{r.department || '-'}</p>
                              </td>
                              <td className="px-4 py-3 text-gray-500">{r.position || '-'}</td>
                              <td className="px-4 py-3 text-gray-500 font-mono text-xs">{cur}</td>
                              <td className="px-4 py-3 text-right font-mono">{formatMoney(r.gross, r.currency)}</td>
                              <td className="px-4 py-3 text-right font-mono text-red-500">{r.ss > 0 ? `-${formatMoney(r.ss, r.currency)}` : '-'}</td>
                              <td className="px-4 py-3 text-right font-mono text-red-500">{r.hi > 0 ? `-${formatMoney(r.hi, r.currency)}` : '-'}</td>
                              <td className="px-4 py-3 text-right font-mono text-red-500">{r.other > 0 ? `-${formatMoney(r.other, r.currency)}` : '-'}</td>
                              <td className="px-4 py-3 text-right font-mono text-emerald-600">{r.bonus > 0 ? `+${formatMoney(r.bonus, r.currency)}` : '-'}</td>
                              <td className="px-4 py-3 text-right font-mono font-semibold text-teal-600">{formatMoney(r.net, r.currency)}</td>
                            </tr>
                          ))}
                          <tr className="bg-gray-50 dark:bg-gray-800 border-t font-semibold">
                            <td className="px-4 py-3 text-gray-900" colSpan={3}>Total {cur}</td>
                            <td className="px-4 py-3 text-right font-mono">{formatMoney(totGross, cur)}</td>
                            <td className="px-4 py-3 text-right font-mono text-red-500">-{formatMoney(totSs, cur)}</td>
                            <td className="px-4 py-3 text-right font-mono text-red-500">-{formatMoney(totHi, cur)}</td>
                            <td className="px-4 py-3 text-right font-mono text-red-500">-{formatMoney(totOther, cur)}</td>
                            <td className="px-4 py-3 text-right font-mono text-emerald-600">+{formatMoney(totBonus, cur)}</td>
                            <td className="px-4 py-3 text-right font-mono font-bold text-teal-600">{formatMoney(totNet, cur)}</td>
                          </tr>
                        </Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
              <p className="font-medium flex items-center gap-1.5"><AlertCircle className="w-4 h-4" /> Nota sobre la n{String.fromCharCode(243)}mina</p>
              <p className="mt-1 text-xs text-amber-700">Los valores de seguridad social, salud, otras deducciones y bonificaciones se configuran en cada contrato. Use el lápiz en Contratos para editarlos.</p>
            </div>
          </div>
        );
      })()}

      {/* Contract Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-lg font-bold">{editingContractId ? 'Editar contrato' : 'Nuevo Contrato'}</h2>
              <button type="button" onClick={closeContractModal} aria-label="Cerrar"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Miembro del equipo *</label>
                <div className="flex gap-2">
                  <select
                    value={form.userId}
                    onChange={e => setForm(f => ({ ...f, userId: e.target.value }))}
                    disabled={!!editingContractId}
                    className="flex-1 px-3 py-2 rounded-lg border text-sm disabled:bg-gray-100 disabled:text-gray-500 dark:disabled:bg-gray-800"
                  >
                    <option value="">{L(ml('Select...','Seleccionar...','Selecionar...'))}</option>
                    {users.map(u => <option key={u.id} value={u.id}>{u.name || u.email}</option>)}
                  </select>
                  <button
                    type="button"
                    onClick={() => setShowInlineCreate(!showInlineCreate)}
                    className="px-3 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition text-sm font-bold"
                    title={L(ml('Create new member','Crear nuevo miembro','Criar novo membro'))}
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                {/* Inline member creation popup */}
                {showInlineCreate && (
                  <div className="mt-2 p-4 bg-teal-50 border border-teal-200 rounded-xl space-y-3 animate-in fade-in">
                    <p className="text-xs font-semibold text-teal-800">{L(ml('Quick create team member','Crear miembro rápido','Criar membro rápido'))}</p>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        value={inlineForm.name}
                        onChange={e => setInlineForm(f => ({ ...f, name: e.target.value }))}
                        className="px-3 py-1.5 rounded-lg border text-sm"
                        placeholder={L(ml('Full name *','Nombre completo *','Nome completo *'))}
                      />
                      <input
                        value={inlineForm.email}
                        onChange={e => setInlineForm(f => ({ ...f, email: e.target.value }))}
                        className="px-3 py-1.5 rounded-lg border text-sm"
                        placeholder="Email *"
                        type="email"
                      />
                    </div>
                    <input
                      value={inlineForm.password}
                      onChange={e => setInlineForm(f => ({ ...f, password: e.target.value }))}
                      className="w-full px-3 py-1.5 rounded-lg border text-sm"
                      placeholder={L(ml('Password (default: temp1234)','Contraseña (default: temp1234)','Senha (padrão: temp1234)'))}
                      type="password"
                    />
                    {inlineError && <p className="text-xs text-red-600">{inlineError}</p>}
                    <div className="flex justify-end gap-2">
                      <button type="button" onClick={() => { setShowInlineCreate(false); setInlineError(''); }} className="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded-lg">
                        {L(ml('Cancel','Cancelar','Cancelar'))}
                      </button>
                      <button
                        type="button"
                        onClick={handleInlineCreate}
                        disabled={inlineLoading}
                        className="px-4 py-1.5 bg-teal-600 text-white rounded-lg text-xs font-medium hover:bg-teal-700 disabled:opacity-50"
                      >
                        {inlineLoading ? '...' : L(ml('Create & Select','Crear y seleccionar','Criar e selecionar'))}
                      </button>
                    </div>
                  </div>
                )}
              </div>
              {!activeCompanyId && companies.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">{L(ml("Company","Empresa","Empresa"))}</label>
                  <select value={form.companyId} onChange={e => setForm(f => ({ ...f, companyId: e.target.value }))} className="w-full px-3 py-2 rounded-lg border text-sm">
                    <option value="">Seleccionar...</option>
                    {companies.map(c => <option key={c.id} value={c.id}>{c.shortName || c.name}</option>)}
                  </select>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Tipo de contrato</label>
                  <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} className="w-full px-3 py-2 rounded-lg border text-sm">
                    {Object.entries(TYPE_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Cargo</label>
                  <input value={form.position} onChange={e => setForm(f => ({ ...f, position: e.target.value }))} className="w-full px-3 py-2 rounded-lg border text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Departamento</label>
                <input value={form.department} onChange={e => setForm(f => ({ ...f, department: e.target.value }))} className="w-full px-3 py-2 rounded-lg border text-sm" />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Salario</label>
                  <input type="number" value={form.salary} onChange={e => setForm(f => ({ ...f, salary: e.target.value }))} className="w-full px-3 py-2 rounded-lg border text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Moneda</label>
                  <select value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))} className="w-full px-3 py-2 rounded-lg border text-sm">
                    <option value="USD">USD</option><option value="UYU">UYU</option><option value="BRL">BRL</option><option value="EUR">EUR</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Hs/Semana</label>
                  <input type="number" value={form.hoursPerWeek} onChange={e => setForm(f => ({ ...f, hoursPerWeek: e.target.value }))} className="w-full px-3 py-2 rounded-lg border text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Fecha inicio</label>
                  <input type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} className="w-full px-3 py-2 rounded-lg border text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Fecha fin (opcional)</label>
                  <input type="date" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} className="w-full px-3 py-2 rounded-lg border text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Seg. social / mes</label>
                  <input type="number" step="any" value={form.socialSecurity} onChange={e => setForm(f => ({ ...f, socialSecurity: e.target.value }))} className="w-full px-3 py-2 rounded-lg border text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Salud / mes</label>
                  <input type="number" step="any" value={form.healthInsurance} onChange={e => setForm(f => ({ ...f, healthInsurance: e.target.value }))} className="w-full px-3 py-2 rounded-lg border text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Otras deducciones</label>
                  <input type="number" step="any" value={form.otherDeductions} onChange={e => setForm(f => ({ ...f, otherDeductions: e.target.value }))} className="w-full px-3 py-2 rounded-lg border text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Bonificaciones</label>
                  <input type="number" step="any" value={form.bonuses} onChange={e => setForm(f => ({ ...f, bonuses: e.target.value }))} className="w-full px-3 py-2 rounded-lg border text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Notas</label>
                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className="w-full px-3 py-2 rounded-lg border text-sm" rows={2} />
              </div>
            </div>
            <div className="flex justify-end gap-3 p-6 border-t">
              <button type="button" onClick={closeContractModal} className="px-4 py-2 text-sm border rounded-lg">{L(ml("Cancel","Cancelar","Cancelar"))}</button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!editingContractId && !form.userId}
                className="px-6 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 text-sm disabled:opacity-50"
              >
                {editingContractId ? 'Guardar' : 'Crear'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Leave Form Modal */}
      {showLeaveForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-lg font-bold">Solicitar Licencia</h2>
              <button onClick={() => setShowLeaveForm(false)}><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Empleado *</label>
                <select value={leaveForm.userId} onChange={e => setLeaveForm(f => ({ ...f, userId: e.target.value }))} className="w-full px-3 py-2 rounded-lg border text-sm">
                  <option value="">Seleccionar...</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.name || u.email}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Tipo de licencia</label>
                <select value={leaveForm.type} onChange={e => setLeaveForm(f => ({ ...f, type: e.target.value }))} className="w-full px-3 py-2 rounded-lg border text-sm">
                  {Object.entries(LEAVE_TYPES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Desde *</label>
                  <input type="date" value={leaveForm.startDate} onChange={e => setLeaveForm(f => ({ ...f, startDate: e.target.value }))} className="w-full px-3 py-2 rounded-lg border text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Hasta *</label>
                  <input type="date" value={leaveForm.endDate} onChange={e => setLeaveForm(f => ({ ...f, endDate: e.target.value }))} className="w-full px-3 py-2 rounded-lg border text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Motivo</label>
                <textarea value={leaveForm.reason} onChange={e => setLeaveForm(f => ({ ...f, reason: e.target.value }))} className="w-full px-3 py-2 rounded-lg border text-sm" rows={2} />
              </div>
            </div>
            <div className="flex justify-end gap-3 p-6 border-t">
              <button onClick={() => setShowLeaveForm(false)} className="px-4 py-2 text-sm border rounded-lg">Cancelar</button>
              <button onClick={handleLeaveSubmit} className="px-6 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 text-sm">Enviar solicitud</button>
            </div>
          </div>
        </div>
      )}

      {/* ALLOCATIONS TAB */}
      {tab === 'allocations' && (
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <p className="text-sm text-blue-800 font-medium">Asignación de personal a proyectos</p>
            <p className="text-xs text-blue-600 mt-1">Muestra cómo cada empleado está distribuido entre proyectos. El salario base viene de RH (Contratos) y la dedicación se define en cada proyecto (SIEP → Equipo).</p>
          </div>

          {allocLoading ? (
            <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-teal-500/30 border-t-teal-500 rounded-full animate-spin" /></div>
          ) : allocations.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-xl border">
              <Users className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-500">No hay contratos activos con asignaciones a proyectos.</p>
              <p className="text-xs text-gray-400 mt-1">Registre contratos en la pestaña &quot;Contratos&quot; y asigne miembros a proyectos en SIEP.</p>
            </div>
          ) : (
            <>
              {/* Summary KPIs */}
              {(() => {
                const totalBase = allocations.reduce((s, a) => s + a.baseSalary, 0);
                const totalProjectFunded = allocations.reduce((s, a) => s + a.projectFundedAmount, 0);
                const totalInternal = allocations.reduce((s, a) => s + a.internalCost, 0);
                const fullyFunded = allocations.filter(a => a.isFullyFunded).length;
                return (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="bg-white rounded-xl border p-4 text-center">
                      <p className="text-[10px] uppercase tracking-wide text-gray-500">Nómina total</p>
                      <p className="text-lg font-bold text-gray-900 mt-1">{formatMoney(totalBase)}</p>
                    </div>
                    <div className="bg-white rounded-xl border p-4 text-center">
                      <p className="text-[10px] uppercase tracking-wide text-gray-500">Financiado por proyectos</p>
                      <p className="text-lg font-bold text-green-700 mt-1">{formatMoney(totalProjectFunded)}</p>
                    </div>
                    <div className="bg-white rounded-xl border p-4 text-center">
                      <p className="text-[10px] uppercase tracking-wide text-gray-500">Costo interno</p>
                      <p className="text-lg font-bold text-amber-700 mt-1">{formatMoney(totalInternal)}</p>
                    </div>
                    <div className="bg-white rounded-xl border p-4 text-center">
                      <p className="text-[10px] uppercase tracking-wide text-gray-500">100% cubiertos</p>
                      <p className="text-lg font-bold text-teal-700 mt-1">{fullyFunded} / {allocations.length}</p>
                    </div>
                  </div>
                );
              })()}

              {/* Employee allocation cards */}
              <div className="space-y-3">
                {allocations.map((emp: any) => (
                  <div key={emp.userId} className={`bg-white rounded-xl border p-5 ${emp.isFullyFunded ? 'border-green-200 bg-green-50/30' : ''}`}>
                    <div className="flex items-center justify-between flex-wrap gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-teal-400 to-teal-600 text-white flex items-center justify-center text-sm font-bold">
                          {(emp.userName || '?').split(' ').map((w: string) => w[0]).join('').substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900">{emp.userName}</p>
                          <p className="text-xs text-gray-500">{emp.position} · Salario: {formatMoney(emp.baseSalary, emp.currency)}/mes</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {emp.isFullyFunded && (
                          <span className="px-2.5 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full">💰 100% cubierto</span>
                        )}
                        <span className="text-sm font-bold text-blue-700">{Math.round(emp.totalDedication)}% asignado</span>
                      </div>
                    </div>

                    {/* Dedication bar */}
                    <div className="mt-3">
                      <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden flex">
                        {emp.projects?.map((p: any, i: number) => {
                          const colors = ['bg-blue-500', 'bg-purple-500', 'bg-teal-500', 'bg-amber-500', 'bg-pink-500', 'bg-indigo-500'];
                          return (
                            <div
                              key={i}
                              className={`h-2.5 ${colors[i % colors.length]} transition-all`}
                              style={{ width: `${Math.min(p.dedicationPct, 100)}%` }}
                              title={`${p.name}: ${p.dedicationPct}%`}
                            />
                          );
                        })}
                        {emp.totalDedication < 100 && (
                          <div className="h-2.5 bg-gray-200" style={{ width: `${100 - Math.min(emp.totalDedication, 100)}%` }} />
                        )}
                      </div>
                    </div>

                    {/* Projects breakdown */}
                    {emp.projects?.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {emp.projects.map((p: any, i: number) => {
                          const colors = ['bg-blue-50 text-blue-700 border-blue-200', 'bg-purple-50 text-purple-700 border-purple-200', 'bg-teal-50 text-teal-700 border-teal-200', 'bg-amber-50 text-amber-700 border-amber-200'];
                          return (
                            <div key={i} className={`px-2.5 py-1.5 rounded-lg border text-xs ${colors[i % colors.length]}`}>
                              <span className="font-medium">{p.name}</span>
                              <span className="mx-1.5">·</span>
                              <span>{p.dedicationPct}%</span>
                              <span className="mx-1.5">·</span>
                              <span className="font-semibold">{formatMoney(p.monthlyCost)}/mes</span>
                            </div>
                          );
                        })}
                        {emp.totalDedication < 100 && (
                          <div className="px-2.5 py-1.5 rounded-lg border border-gray-200 bg-gray-50 text-gray-600 text-xs">
                            <span className="font-medium">Interno</span>
                            <span className="mx-1.5">·</span>
                            <span>{Math.round(100 - emp.totalDedication)}%</span>
                            <span className="mx-1.5">·</span>
                            <span className="font-semibold">{formatMoney(emp.internalCost)}/mes</span>
                          </div>
                        )}
                      </div>
                    )}

                    {emp.projects?.length === 0 && (
                      <p className="mt-2 text-xs text-gray-400 italic">Sin asignación a proyectos — 100% costo interno</p>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
