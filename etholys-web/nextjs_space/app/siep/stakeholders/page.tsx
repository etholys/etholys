'use client';

import { useState, useEffect, useMemo } from 'react';
import { useApp } from '@/app/providers';
import {
  Handshake, Plus, Trash2, Search, X, Edit2, Phone, Mail, MapPin,
  Globe, MessageSquare, PhoneCall, Video, FileText,
  Building2, Users, Landmark, GraduationCap, Factory, Heart,
  Eye, Link2
} from 'lucide-react';

const TYPES: Record<string, { label: string; icon: any; color: string }> = {
  ong: { label: 'ONG', icon: Heart, color: 'text-pink-600' },
  gobierno: { label: 'Gobierno', icon: Landmark, color: 'text-blue-600' },
  cooperacion: { label: 'Cooperaci\u00f3n', icon: Handshake, color: 'text-indigo-600' },
  academia: { label: 'Academia', icon: GraduationCap, color: 'text-purple-600' },
  empresa: { label: 'Empresa', icon: Factory, color: 'text-orange-600' },
  otro: { label: 'Otro', icon: Building2, color: 'text-gray-600' },
};

const ALLIANCE_TYPES = [
  { value: 'convenio', label: 'Convenio' },
  { value: 'acuerdo', label: 'Acuerdo Marco' },
  { value: 'memorandum', label: 'Memorandum' },
  { value: 'carta_intencion', label: 'Carta de Intenci\u00f3n' },
  { value: 'socio', label: 'Socio estrat\u00e9gico' },
  { value: 'financiador', label: 'Financiador / Donante' },
];

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  active: { label: 'Activo', color: 'text-emerald-600', bg: 'bg-emerald-50' },
  prospecting: { label: 'En prospecci\u00f3n', color: 'text-amber-600', bg: 'bg-amber-50' },
  inactive: { label: 'Inactivo', color: 'text-gray-500', bg: 'bg-gray-100' },
  suspended: { label: 'Suspendido', color: 'text-red-600', bg: 'bg-red-50' },
};

const SECTORS = ['Agro', 'Salud', 'Educaci\u00f3n', 'Tecnolog\u00eda', 'Medioambiente', 'Social', 'Otro'];

const INT_TYPES: Record<string, { label: string; icon: any; color: string }> = {
  meeting: { label: 'Reuni\u00f3n', icon: Video, color: 'text-indigo-600' },
  email: { label: 'Email', icon: Mail, color: 'text-purple-600' },
  call: { label: 'Llamada', icon: PhoneCall, color: 'text-blue-600' },
  visit: { label: 'Visita', icon: MapPin, color: 'text-orange-600' },
  agreement: { label: 'Acuerdo', icon: FileText, color: 'text-emerald-600' },
  report: { label: 'Informe', icon: FileText, color: 'text-gray-600' },
};

const EMPTY_FORM = {
  companyId: '', name: '', contactName: '', email: '', phone: '',
  address: '', city: '', country: '', taxId: '', type: 'ong',
  allianceType: '', status: 'active', startDate: '', endDate: '',
  website: '', sector: '', description: '', notes: ''
};


type ML = { es: string; pt: string; en: string };
const ml = (en: string, es: string, pt: string): ML => ({ en, es, pt });
export default function StakeholdersPage() {
  const {activeCompanyId, locale } = useApp();
  const L = (m: ML) => m[locale] || m.en;
  const [items, setItems] = useState<any[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [searchText, setSearchText] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [detail, setDetail] = useState<any>(null);
  const [interactions, setInteractions] = useState<any[]>([]);
  const [showIntForm, setShowIntForm] = useState(false);
  const [intForm, setIntForm] = useState({ type: 'meeting', subject: '', description: '', contactName: '', date: '' });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [r1, r2] = await Promise.all([
        fetch(`/api/stakeholders${activeCompanyId ? `?companyId=${activeCompanyId}` : ''}`),
        fetch('/api/companies'),
      ]);
      const d1 = await r1.json();
      const d2 = await r2.json();
      setItems(d1?.stakeholders ?? []);
      setCompanies(d2?.companies ?? []);
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, [activeCompanyId]);

  const filtered = useMemo(() => {
    return items.filter(s => {
      if (filterType && s.type !== filterType) return false;
      if (filterStatus && s.status !== filterStatus) return false;
      if (searchText) {
        const q = searchText.toLowerCase();
        if (!s.name?.toLowerCase().includes(q) && !s.contactName?.toLowerCase().includes(q) && !s.email?.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [items, filterType, filterStatus, searchText]);

  const resetForm = () => setForm({ ...EMPTY_FORM });

  const handleSave = async () => {
    const compId = form.companyId || activeCompanyId || companies[0]?.id;
    if (!compId || !form.name) return;
    await fetch('/api/stakeholders', {
      method: editId ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, companyId: compId, id: editId || undefined }),
    });
    setShowForm(false); setEditId(null); resetForm(); fetchData();
  };

  const handleEdit = (s: any) => {
    setForm({
      companyId: s.companyId, name: s.name, contactName: s.contactName || '',
      email: s.email || '', phone: s.phone || '', address: s.address || '',
      city: s.city || '', country: s.country || '', taxId: s.taxId || '',
      type: s.type || 'ong', allianceType: s.allianceType || '', status: s.status || 'active',
      startDate: s.startDate ? new Date(s.startDate).toISOString().slice(0, 10) : '',
      endDate: s.endDate ? new Date(s.endDate).toISOString().slice(0, 10) : '',
      website: s.website || '', sector: s.sector || '',
      description: s.description || '', notes: s.notes || '',
    });
    setEditId(s.id); setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('\u00bfEliminar este stakeholder?')) return;
    await fetch(`/api/stakeholders?id=${id}`, { method: 'DELETE' }); fetchData();
  };

  const openDetail = async (s: any) => {
    setDetail(s);
    const res = await fetch(`/api/stakeholder-interactions?stakeholderId=${s.id}`);
    const data = await res.json();
    setInteractions(data?.interactions ?? []);
  };

  const handleIntSave = async () => {
    if (!detail) return;
    await fetch('/api/stakeholder-interactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stakeholderId: detail.id, ...intForm }),
    });
    setShowIntForm(false);
    setIntForm({ type: 'meeting', subject: '', description: '', contactName: '', date: '' });
    const res = await fetch(`/api/stakeholder-interactions?stakeholderId=${detail.id}`);
    const data = await res.json();
    setInteractions(data?.interactions ?? []);
  };

  const stats = useMemo(() => {
    const active = items.filter(s => s.status === 'active').length;
    const prospecting = items.filter(s => s.status === 'prospecting').length;
    const byType: Record<string, number> = {};
    items.forEach(s => { byType[s.type] = (byType[s.type] || 0) + 1; });
    return { total: items.length, active, prospecting, byType };
  }, [items]);

  return (
    <div className="p-6 space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border p-4">
          <div className="flex items-center gap-2 mb-1"><Handshake className="w-4 h-4 text-indigo-600" /><span className="text-xs text-gray-500">Total Stakeholders</span></div>
          <div className="text-xl font-bold">{stats.total}</div>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <div className="flex items-center gap-2 mb-1"><Users className="w-4 h-4 text-emerald-600" /><span className="text-xs text-gray-500">Activos</span></div>
          <div className="text-xl font-bold text-emerald-600">{stats.active}</div>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <div className="flex items-center gap-2 mb-1"><Search className="w-4 h-4 text-amber-600" /><span className="text-xs text-gray-500">En prospecci&oacute;n</span></div>
          <div className="text-xl font-bold text-amber-600">{stats.prospecting}</div>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <div className="flex items-center gap-2 mb-1"><Link2 className="w-4 h-4 text-blue-600" /><span className="text-xs text-gray-500">Tipos distintos</span></div>
          <div className="text-xl font-bold text-blue-600">{Object.keys(stats.byType).length}</div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm" placeholder="Buscar stakeholder..." value={searchText} onChange={e => setSearchText(e.target.value)} />
        </div>
        <select className="border rounded-lg px-3 py-2 text-sm" value={filterType} onChange={e => setFilterType(e.target.value)}>
          <option value="">Todos los tipos</option>
          {Object.entries(TYPES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <select className="border rounded-lg px-3 py-2 text-sm" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="">Todos los estados</option>
          {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <button onClick={() => { resetForm(); setEditId(null); setShowForm(true); }} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm flex items-center gap-2 hover:bg-indigo-700">
          <Plus className="w-4 h-4" /> Stakeholder
        </button>
      </div>

      {/* Cards */}
      {loading ? <div className="text-center py-12 text-gray-400">Cargando...</div> : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(s => {
            const tp = TYPES[s.type] || TYPES.otro;
            const st = STATUS_CONFIG[s.status] || STATUS_CONFIG.active;
            const TpIcon = tp.icon;
            return (
              <div key={s.id} className="bg-white rounded-xl border p-4 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center">
                      <TpIcon className={`w-5 h-5 ${tp.color}`} />
                    </div>
                    <div>
                      <h4 className="font-semibold text-sm">{s.name}</h4>
                      {s.contactName && <p className="text-xs text-gray-500">{s.contactName}</p>}
                    </div>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${st.bg} ${st.color}`}>{st.label}</span>
                </div>
                <div className="space-y-1 text-xs text-gray-500 mb-3">
                  {s.allianceType && <div className="flex items-center gap-1"><FileText className="w-3 h-3" />{ALLIANCE_TYPES.find(a => a.value === s.allianceType)?.label || s.allianceType}</div>}
                  {s.sector && <div className="flex items-center gap-1"><Globe className="w-3 h-3" />{s.sector}</div>}
                  {s.email && <div className="flex items-center gap-1"><Mail className="w-3 h-3" />{s.email}</div>}
                  {s.phone && <div className="flex items-center gap-1"><Phone className="w-3 h-3" />{s.phone}</div>}
                  {(s.city || s.country) && <div className="flex items-center gap-1"><MapPin className="w-3 h-3" />{[s.city, s.country].filter(Boolean).join(', ')}</div>}
                  {s.website && <div className="flex items-center gap-1"><Globe className="w-3 h-3" /><a href={s.website.startsWith('http') ? s.website : `https://${s.website}`} target="_blank" rel="noreferrer" className="text-blue-500 hover:underline truncate">{s.website}</a></div>}
                </div>
                {s.description && <p className="text-xs text-gray-400 mb-3 line-clamp-2">{s.description}</p>}
                <div className="flex items-center justify-between border-t pt-3">
                  <button onClick={() => openDetail(s)} className="text-xs text-indigo-600 hover:underline flex items-center gap-1">
                    <Eye className="w-3 h-3" /> Detalle ({s._count?.interactions ?? 0})
                  </button>
                  <div className="flex items-center gap-1">
                    <button onClick={() => handleEdit(s)} className="p-1.5 rounded hover:bg-gray-100"><Edit2 className="w-3.5 h-3.5" /></button>
                    <button onClick={() => handleDelete(s.id)} className="p-1.5 rounded hover:bg-red-50 text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && <div className="col-span-full text-center py-12 text-gray-400">No hay stakeholders registrados</div>}
        </div>
      )}

      {/* Create/Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div onClick={e => e.stopPropagation()} className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">{editId ? 'Editar stakeholder' : 'Nuevo stakeholder'}</h3>
              <button onClick={() => setShowForm(false)}><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-3">
              {!activeCompanyId && companies.length > 1 && (
                <select className="w-full border rounded-lg px-3 py-2 text-sm" value={form.companyId} onChange={e => setForm({ ...form, companyId: e.target.value })}>
                  <option value="">Seleccionar empresa</option>
                  {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              )}
              <input className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Nombre / Raz\u00f3n social *" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
              <div className="grid grid-cols-2 gap-3">
                <select className="border rounded-lg px-3 py-2 text-sm" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
                  {Object.entries(TYPES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
                <select className="border rounded-lg px-3 py-2 text-sm" value={form.allianceType} onChange={e => setForm({ ...form, allianceType: e.target.value })}>
                  <option value="">Tipo de alianza</option>
                  {ALLIANCE_TYPES.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <select className="border rounded-lg px-3 py-2 text-sm" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                  {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
                <select className="border rounded-lg px-3 py-2 text-sm" value={form.sector} onChange={e => setForm({ ...form, sector: e.target.value })}>
                  <option value="">Sector</option>
                  {SECTORS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input className="border rounded-lg px-3 py-2 text-sm" placeholder="Contacto principal" value={form.contactName} onChange={e => setForm({ ...form, contactName: e.target.value })} />
                <input className="border rounded-lg px-3 py-2 text-sm" placeholder="Email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input className="border rounded-lg px-3 py-2 text-sm" placeholder="Tel\u00e9fono" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
                <input className="border rounded-lg px-3 py-2 text-sm" placeholder="Sitio web" value={form.website} onChange={e => setForm({ ...form, website: e.target.value })} />
              </div>
              <input className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Direcci\u00f3n" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} />
              <div className="grid grid-cols-3 gap-3">
                <input className="border rounded-lg px-3 py-2 text-sm" placeholder="Ciudad" value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} />
                <input className="border rounded-lg px-3 py-2 text-sm" placeholder="Pa\u00eds" value={form.country} onChange={e => setForm({ ...form, country: e.target.value })} />
                <input className="border rounded-lg px-3 py-2 text-sm" placeholder="RUT / Tax ID" value={form.taxId} onChange={e => setForm({ ...form, taxId: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs text-gray-500 mb-1">Inicio alianza</label>
                  <input type="date" className="w-full border rounded-lg px-3 py-2 text-sm" value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} />
                </div>
                <div><label className="block text-xs text-gray-500 mb-1">Fin alianza</label>
                  <input type="date" className="w-full border rounded-lg px-3 py-2 text-sm" value={form.endDate} onChange={e => setForm({ ...form, endDate: e.target.value })} />
                </div>
              </div>
              <textarea className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Descripci\u00f3n" rows={2} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
              <textarea className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Notas internas" rows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 border rounded-lg text-sm">Cancelar</button>
              <button onClick={handleSave} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700">Guardar</button>
            </div>
          </div>
        </div>
      )}

      {/* Detail / Interactions Modal */}
      {detail && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div onClick={e => e.stopPropagation()} className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold">{detail.name}</h3>
                <div className="flex items-center gap-2 mt-1">
                  {detail.type && <span className={`text-xs ${TYPES[detail.type]?.color || ''}`}>{TYPES[detail.type]?.label || detail.type}</span>}
                  {detail.allianceType && <span className="text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded">{ALLIANCE_TYPES.find(a => a.value === detail.allianceType)?.label || detail.allianceType}</span>}
                  {detail.status && <span className={`text-xs px-2 py-0.5 rounded ${STATUS_CONFIG[detail.status]?.bg} ${STATUS_CONFIG[detail.status]?.color}`}>{STATUS_CONFIG[detail.status]?.label}</span>}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setShowIntForm(true)} className="bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-sm flex items-center gap-1">
                  <Plus className="w-4 h-4" /> Interacci&oacute;n
                </button>
                <button onClick={() => { setDetail(null); setInteractions([]); }}><X className="w-5 h-5" /></button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm mb-4">
              {detail.contactName && <div><span className="text-gray-500">Contacto:</span> {detail.contactName}</div>}
              {detail.email && <div><span className="text-gray-500">Email:</span> {detail.email}</div>}
              {detail.phone && <div><span className="text-gray-500">Tel:</span> {detail.phone}</div>}
              {detail.sector && <div><span className="text-gray-500">Sector:</span> {detail.sector}</div>}
              {(detail.city || detail.country) && <div><span className="text-gray-500">Ubicaci&oacute;n:</span> {[detail.city, detail.country].filter(Boolean).join(', ')}</div>}
              {detail.website && <div><span className="text-gray-500">Web:</span> <a href={detail.website?.startsWith('http') ? detail.website : `https://${detail.website}`} target="_blank" rel="noreferrer" className="text-blue-500 hover:underline">{detail.website}</a></div>}
              {detail.startDate && <div><span className="text-gray-500">Inicio:</span> {new Date(detail.startDate).toLocaleDateString('es-UY')}</div>}
              {detail.endDate && <div><span className="text-gray-500">Fin:</span> {new Date(detail.endDate).toLocaleDateString('es-UY')}</div>}
            </div>
            {detail.description && <p className="text-sm text-gray-600 mb-4 bg-gray-50 rounded-lg p-3">{detail.description}</p>}

            {showIntForm && (
              <div className="bg-indigo-50 rounded-xl p-4 mb-4 space-y-3">
                <h4 className="font-semibold text-sm">Nueva Interacci&oacute;n</h4>
                <div className="grid grid-cols-3 gap-3">
                  <select className="border rounded-lg px-3 py-2 text-sm" value={intForm.type} onChange={e => setIntForm({ ...intForm, type: e.target.value })}>
                    {Object.entries(INT_TYPES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                  <input className="border rounded-lg px-3 py-2 text-sm" type="date" value={intForm.date} onChange={e => setIntForm({ ...intForm, date: e.target.value })} />
                  <input className="border rounded-lg px-3 py-2 text-sm" placeholder="Contacto" value={intForm.contactName} onChange={e => setIntForm({ ...intForm, contactName: e.target.value })} />
                </div>
                <input className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Asunto *" value={intForm.subject} onChange={e => setIntForm({ ...intForm, subject: e.target.value })} />
                <textarea className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Descripci&oacute;n" rows={2} value={intForm.description} onChange={e => setIntForm({ ...intForm, description: e.target.value })} />
                <div className="flex justify-end gap-2">
                  <button onClick={() => setShowIntForm(false)} className="px-3 py-1.5 border rounded-lg text-sm">Cancelar</button>
                  <button onClick={handleIntSave} className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-sm">Guardar</button>
                </div>
              </div>
            )}

            <div className="space-y-3">
              {interactions.length === 0 ? (
                <p className="text-center py-6 text-gray-400">Sin interacciones registradas</p>
              ) : interactions.map(int => {
                const it = INT_TYPES[int.type] || INT_TYPES.report;
                const ItIcon = it.icon;
                return (
                  <div key={int.id} className="border rounded-xl p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <ItIcon className={`w-4 h-4 ${it.color}`} />
                      <span className="text-sm font-medium">{int.subject}</span>
                      <span className="text-xs text-gray-400 ml-auto">{new Date(int.date).toLocaleDateString('es-UY')}</span>
                    </div>
                    {int.description && <p className="text-xs text-gray-500">{int.description}</p>}
                    {int.contactName && <p className="text-xs text-gray-400 mt-1">Contacto: {int.contactName}</p>}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
