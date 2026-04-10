'use client';

import { useState, useEffect, useMemo } from 'react';
import { useApp } from '@/app/providers';
import {
  Users, Plus, Trash2, Search, X, Edit2, Star, Phone, Mail,
  MapPin, Building2, User, MessageSquare, Calendar, PhoneCall,
  Video, FileText, Sparkles
} from 'lucide-react';

const CLIENT_TYPES = [
  { value: 'company', label: 'Empresa', icon: Building2 },
  { value: 'individual', label: 'Persona', icon: User },
  { value: 'government', label: 'Gobierno', icon: Building2 },
  { value: 'ngo', label: 'ONG', icon: Sparkles },
];

const SEGMENTS = ['Premium', 'Estratégico', 'Regular', 'Nuevo', 'Inactivo'];

const INTERACTION_TYPES: Record<string, { label: string; icon: any; color: string }> = {
  call: { label: 'Llamada', icon: PhoneCall, color: 'text-blue-600' },
  email: { label: 'Email', icon: Mail, color: 'text-purple-600' },
  meeting: { label: 'Reunión', icon: Video, color: 'text-teal-600' },
  visit: { label: 'Visita', icon: MapPin, color: 'text-orange-600' },
  note: { label: 'Nota', icon: FileText, color: 'text-gray-600' },
};


type ML = { es: string; pt: string; en: string };
const ml = (en: string, es: string, pt: string): ML => ({ en, es, pt });
export default function ClientsPage() {
  const {activeCompanyId, locale } = useApp();
  const L = (m: ML) => m[locale] || m.en;
  const [clients, setClients] = useState<any[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [searchText, setSearchText] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterSegment, setFilterSegment] = useState('');
  // Interaction state
  const [selectedClient, setSelectedClient] = useState<any>(null);
  const [interactions, setInteractions] = useState<any[]>([]);
  const [showInteractions, setShowInteractions] = useState(false);
  const [showIntForm, setShowIntForm] = useState(false);
  const [intForm, setIntForm] = useState({ type: 'note', subject: '', description: '', contactName: '', date: '' });

  const [form, setForm] = useState({
    companyId: '', name: '', contactName: '', email: '', phone: '',
    address: '', city: '', country: '', taxId: '', type: 'company',
    segment: '', rating: 0, notes: ''
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [clRes, cRes] = await Promise.all([
        fetch(`/api/clients${activeCompanyId ? `?companyId=${activeCompanyId}` : ''}`),
        fetch('/api/companies'),
      ]);
      const clData = await clRes.json();
      const cData = await cRes.json();
      setClients(clData?.clients ?? []);
      setCompanies(cData?.companies ?? []);
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, [activeCompanyId]);

  const filtered = useMemo(() => {
    return clients.filter(c => {
      if (filterType && c.type !== filterType) return false;
      if (filterSegment && c.segment !== filterSegment) return false;
      if (searchText) {
        const q = searchText.toLowerCase();
        if (!c.name?.toLowerCase().includes(q) && !c.contactName?.toLowerCase().includes(q) && !c.email?.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [clients, filterType, filterSegment, searchText]);

  const stats = useMemo(() => {
    const byType: Record<string, number> = {};
    CLIENT_TYPES.forEach(t => { byType[t.value] = clients.filter(c => c.type === t.value).length; });
    const avgRating = clients.filter(c => c.rating).reduce((s, c) => s + c.rating, 0) / (clients.filter(c => c.rating).length || 1);
    return { total: clients.length, byType, avgRating };
  }, [clients]);

  const handleSave = async () => {
    const compId = form.companyId || activeCompanyId || companies[0]?.id;
    if (!compId || !form.name) return;
    const payload = { ...form, companyId: compId, id: editId || undefined };
    await fetch('/api/clients', {
      method: editId ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    setShowForm(false); setEditId(null);
    resetForm();
    fetchData();
  };

  const resetForm = () => setForm({
    companyId: '', name: '', contactName: '', email: '', phone: '',
    address: '', city: '', country: '', taxId: '', type: 'company',
    segment: '', rating: 0, notes: ''
  });

  const handleEdit = (c: any) => {
    setForm({
      companyId: c.companyId, name: c.name, contactName: c.contactName || '',
      email: c.email || '', phone: c.phone || '', address: c.address || '',
      city: c.city || '', country: c.country || '', taxId: c.taxId || '',
      type: c.type || 'company', segment: c.segment || '', rating: c.rating || 0, notes: c.notes || ''
    });
    setEditId(c.id); setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm(L(ml('Delete this client?', '{L(ml("Delete this client?","¿Eliminar este cliente?","Excluir este cliente?"))}', 'Excluir este cliente?')))) return;
    await fetch(`/api/clients?id=${id}`, { method: 'DELETE' });
    fetchData();
  };

  // Interactions
  const openInteractions = async (client: any) => {
    setSelectedClient(client);
    setShowInteractions(true);
    const res = await fetch(`/api/client-interactions?clientId=${client.id}`);
    const data = await res.json();
    setInteractions(data?.interactions ?? []);
  };

  const handleIntSave = async () => {
    if (!selectedClient || !intForm.subject) return;
    await fetch('/api/client-interactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId: selectedClient.id, ...intForm }),
    });
    setShowIntForm(false);
    setIntForm({ type: 'note', subject: '', description: '', contactName: '', date: '' });
    const res = await fetch(`/api/client-interactions?clientId=${selectedClient.id}`);
    const data = await res.json();
    setInteractions(data?.interactions ?? []);
  };

  const deleteInteraction = async (id: string) => {
    await fetch(`/api/client-interactions?id=${id}`, { method: 'DELETE' });
    const res = await fetch(`/api/client-interactions?clientId=${selectedClient.id}`);
    const data = await res.json();
    setInteractions(data?.interactions ?? []);
  };

  return (
    <div className="p-6 space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white dark:bg-gray-900 rounded-xl border p-4">
          <div className="text-xs text-gray-500 mb-1">{L(ml('Total clients','Total clientes','Total clientes'))}</div>
          <div className="text-2xl font-bold">{stats.total}</div>
        </div>
        {CLIENT_TYPES.map(t => (
          <div key={t.value} className="bg-white dark:bg-gray-900 rounded-xl border p-4">
            <div className="flex items-center gap-1 text-xs text-gray-500 mb-1"><t.icon className="w-3 h-3" /> {t.label}</div>
            <div className="text-2xl font-bold">{stats.byType[t.value] || 0}</div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm" placeholder={L(ml('Search client...','Buscar cliente...','Buscar cliente...'))} value={searchText} onChange={e => setSearchText(e.target.value)} />
        </div>
        <select className="border rounded-lg px-3 py-2 text-sm" value={filterType} onChange={e => setFilterType(e.target.value)}>
          <option value="">{L(ml('All types','Todos los tipos','Todos os tipos'))}</option>
          {CLIENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <select className="border rounded-lg px-3 py-2 text-sm" value={filterSegment} onChange={e => setFilterSegment(e.target.value)}>
          <option value="">{L(ml('All segments','Todos los segmentos','Todos os segmentos'))}</option>
          {SEGMENTS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <button onClick={() => { resetForm(); setEditId(null); setShowForm(true); }} className="bg-teal-600 text-white px-4 py-2 rounded-lg text-sm flex items-center gap-2 hover:bg-teal-700">
          <Plus className="w-4 h-4" /> Cliente
        </button>
      </div>

      {/* Client Cards */}
      {loading ? <div className="text-center py-12 text-gray-400">Cargando...</div> : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(c => {
            const typeInfo = CLIENT_TYPES.find(t => t.value === c.type) || CLIENT_TYPES[0];
            const Icon = typeInfo.icon;
            return (
              <div key={c.id} className="bg-white dark:bg-gray-900 rounded-xl border p-4 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 rounded-full bg-teal-50 dark:bg-teal-900/30 flex items-center justify-center">
                      <Icon className="w-5 h-5 text-teal-600" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-sm">{c.name}</h4>
                      {c.contactName && <p className="text-xs text-gray-500">{c.contactName}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-0.5">
                    {[1,2,3,4,5].map(i => <Star key={i} className={`w-3 h-3 ${i <= (c.rating || 0) ? 'fill-amber-400 text-amber-400' : 'text-gray-300'}`} />)}
                  </div>
                </div>
                <div className="space-y-1 text-xs text-gray-500 mb-3">
                  {c.email && <div className="flex items-center gap-1"><Mail className="w-3 h-3" />{c.email}</div>}
                  {c.phone && <div className="flex items-center gap-1"><Phone className="w-3 h-3" />{c.phone}</div>}
                  {(c.city || c.country) && <div className="flex items-center gap-1"><MapPin className="w-3 h-3" />{[c.city, c.country].filter(Boolean).join(', ')}</div>}
                </div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded text-xs">{typeInfo.label}</span>
                  {c.segment && <span className="bg-teal-50 dark:bg-teal-900/30 text-teal-700 px-2 py-0.5 rounded text-xs">{c.segment}</span>}
                </div>
                <div className="flex items-center justify-between border-t pt-3">
                  <button onClick={() => openInteractions(c)} className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                    <MessageSquare className="w-3 h-3" /> Historial
                  </button>
                  <div className="flex items-center gap-1">
                    <button onClick={() => handleEdit(c)} className="p-1.5 rounded hover:bg-gray-100"><Edit2 className="w-3.5 h-3.5" /></button>
                    <button onClick={() => handleDelete(c.id)} className="p-1.5 rounded hover:bg-red-50 text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && <div className="col-span-full text-center py-12 text-gray-400">{L(ml('No clients','No hay clientes','Nenhum cliente'))}</div>}
        </div>
      )}

      {/* Client Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">{editId ? L(ml('Edit client','Editar cliente','Editar cliente')) : L(ml('New client','Nuevo cliente','Novo cliente'))}</h3>
              <button onClick={() => setShowForm(false)}><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-3">
              {!activeCompanyId && companies.length > 1 && (
                <select className="w-full border rounded-lg px-3 py-2 text-sm" value={form.companyId} onChange={e => setForm({ ...form, companyId: e.target.value })}>
                  <option value="">Seleccionar empresa</option>
                  {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              )}
              <input className="w-full border rounded-lg px-3 py-2 text-sm" placeholder={L(ml('Name / Company name *','Nombre / Razón social *','Nome / Razão social *'))} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
              <div className="grid grid-cols-2 gap-3">
                <input className="border rounded-lg px-3 py-2 text-sm" placeholder="Contacto" value={form.contactName} onChange={e => setForm({ ...form, contactName: e.target.value })} />
                <select className="border rounded-lg px-3 py-2 text-sm" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
                  {CLIENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input className="border rounded-lg px-3 py-2 text-sm" placeholder="Email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
                <input className="border rounded-lg px-3 py-2 text-sm" placeholder={L(ml('Phone','Teléfono','Telefone'))} value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
              </div>
              <input className="w-full border rounded-lg px-3 py-2 text-sm" placeholder={L(ml('Address','Dirección','Endereço'))} value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} />
              <div className="grid grid-cols-3 gap-3">
                <input className="border rounded-lg px-3 py-2 text-sm" placeholder="Ciudad" value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} />
                <input className="border rounded-lg px-3 py-2 text-sm" placeholder="País" value={form.country} onChange={e => setForm({ ...form, country: e.target.value })} />
                <input className="border rounded-lg px-3 py-2 text-sm" placeholder="RUT / Tax ID" value={form.taxId} onChange={e => setForm({ ...form, taxId: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <select className="border rounded-lg px-3 py-2 text-sm" value={form.segment} onChange={e => setForm({ ...form, segment: e.target.value })}>
                  <option value="">Segmento</option>
                  {SEGMENTS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <div className="flex items-center gap-1 px-3">
                  <span className="text-sm text-gray-500 mr-2">Rating:</span>
                  {[1,2,3,4,5].map(i => (
                    <button key={i} onClick={() => setForm({ ...form, rating: i })}>
                      <Star className={`w-5 h-5 ${i <= form.rating ? 'fill-amber-400 text-amber-400' : 'text-gray-300'}`} />
                    </button>
                  ))}
                </div>
              </div>
              <textarea className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Notas" rows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 border rounded-lg text-sm">{L(ml("Cancel","Cancelar","Cancelar"))}</button>
              <button onClick={handleSave} className="px-4 py-2 bg-teal-600 text-white rounded-lg text-sm hover:bg-teal-700">{L(ml("Save","Guardar","Salvar"))}</button>
            </div>
          </div>
        </div>
      )}

      {/* Interactions Modal */}
      {showInteractions && selectedClient && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold">Historial de Interacciones</h3>
                <p className="text-sm text-gray-500">{selectedClient.name}</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setShowIntForm(true)} className="bg-teal-600 text-white px-3 py-1.5 rounded-lg text-sm flex items-center gap-1">
                  <Plus className="w-4 h-4" /> Interacción
                </button>
                <button onClick={() => { setShowInteractions(false); setSelectedClient(null); }}><X className="w-5 h-5" /></button>
              </div>
            </div>

            {showIntForm && (
              <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 mb-4 space-y-3">
                <div className="flex gap-2 flex-wrap">
                  {Object.entries(INTERACTION_TYPES).map(([key, cfg]) => (
                    <button key={key} onClick={() => setIntForm({ ...intForm, type: key })} className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm border ${intForm.type === key ? 'bg-teal-50 border-teal-300 text-teal-700' : ''}`}>
                      <cfg.icon className={`w-4 h-4 ${cfg.color}`} /> {cfg.label}
                    </button>
                  ))}
                </div>
                <input className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Asunto *" value={intForm.subject} onChange={e => setIntForm({ ...intForm, subject: e.target.value })} />
                <textarea className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Descripción" rows={2} value={intForm.description} onChange={e => setIntForm({ ...intForm, description: e.target.value })} />
                <div className="grid grid-cols-2 gap-3">
                  <input className="border rounded-lg px-3 py-2 text-sm" placeholder="Persona de contacto" value={intForm.contactName} onChange={e => setIntForm({ ...intForm, contactName: e.target.value })} />
                  <input className="border rounded-lg px-3 py-2 text-sm" type="date" value={intForm.date} onChange={e => setIntForm({ ...intForm, date: e.target.value })} />
                </div>
                <div className="flex justify-end gap-2">
                  <button onClick={() => setShowIntForm(false)} className="px-3 py-1.5 border rounded-lg text-sm">Cancelar</button>
                  <button onClick={handleIntSave} className="px-3 py-1.5 bg-teal-600 text-white rounded-lg text-sm">Guardar</button>
                </div>
              </div>
            )}

            <div className="space-y-2">
              {interactions.length === 0 ? (
                <p className="text-center py-6 text-gray-400">Sin interacciones registradas</p>
              ) : interactions.map(int => {
                const cfg = INTERACTION_TYPES[int.type] || INTERACTION_TYPES.note;
                const Icon = cfg.icon;
                return (
                  <div key={int.id} className="flex items-start gap-3 p-3 border rounded-lg">
                    <Icon className={`w-5 h-5 ${cfg.color} flex-shrink-0 mt-0.5`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{int.subject}</span>
                        <span className="text-xs bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded">{cfg.label}</span>
                      </div>
                      {int.description && <p className="text-xs text-gray-500 mt-1">{int.description}</p>}
                      {int.contactName && <p className="text-xs text-gray-400">Contacto: {int.contactName}</p>}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-xs text-gray-400">{new Date(int.date).toLocaleDateString('es-UY')}</span>
                      <button onClick={() => deleteInteraction(int.id)} className="p-1 rounded hover:bg-red-50 text-red-400"><Trash2 className="w-3 h-3" /></button>
                    </div>
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
