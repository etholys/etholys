'use client';

import { useState, useEffect, useMemo } from 'react';
import { useApp } from '@/app/providers';
import {
  Truck, Plus, Trash2, Search, X, Star, Edit2, Phone, Mail, MapPin,
  Tag, ShoppingCart, FileText, CheckCircle2, Clock, Send, PackageCheck,
  ClipboardCheck, BarChart3
} from 'lucide-react';

const CATEGORIES = [
  'Materiales', 'Servicios', 'Tecnología', 'Logística', 'Consultoría',
  'Equipamiento', 'Insumos', 'Construcción', 'Alimentación', 'Otro'
];

const PO_STATUS: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  draft: { label: 'Borrador', color: 'text-gray-600', bg: 'bg-gray-100', icon: FileText },
  sent: { label: 'Enviada', color: 'text-blue-600', bg: 'bg-blue-50', icon: Send },
  confirmed: { label: 'Confirmada', color: 'text-teal-600', bg: 'bg-teal-50', icon: CheckCircle2 },
  received: { label: 'Recibida', color: 'text-emerald-600', bg: 'bg-emerald-50', icon: PackageCheck },
  cancelled: { label: 'Cancelada', color: 'text-red-600', bg: 'bg-red-50', icon: X },
};

function fmtMoney(n: number, c: string = 'USD') {
  return new Intl.NumberFormat('es-UY', { style: 'currency', currency: c, minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(n);
}


type ML = { es: string; pt: string; en: string };
const ml = (en: string, es: string, pt: string): ML => ({ en, es, pt });
export default function SuppliersPage() {
  const {activeCompanyId, locale } = useApp();
  const L = (m: ML) => m[locale] || m.en;
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [searchText, setSearchText] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [form, setForm] = useState({
    companyId: '', name: '', tradeName: '', email: '', phone: '',
    address: '', city: '', country: '', taxId: '', category: '', rating: 0, notes: ''
  });
  // PO state
  const [orders, setOrders] = useState<any[]>([]);
  const [selectedSupplier, setSelectedSupplier] = useState<any>(null);
  const [showOrders, setShowOrders] = useState(false);
  const [showPOForm, setShowPOForm] = useState(false);
  const [poForm, setPOForm] = useState({
    currency: 'USD', taxRate: '0', expectedDate: '', notes: '',
    items: [{ description: '', quantity: 1, unitPrice: 0 }] as { description: string; quantity: number; unitPrice: number }[]
  });

  // Evaluation state
  const [showEvalModal, setShowEvalModal] = useState(false);
  const [evalSupplier, setEvalSupplier] = useState<any>(null);
  const [evaluations, setEvaluations] = useState<any[]>([]);
  const [evalAverages, setEvalAverages] = useState<any>(null);
  const [showEvalForm, setShowEvalForm] = useState(false);
  const EVAL_EMPTY = { quality: 3, delivery: 3, price: 3, communication: 3, compliance: 3, comment: '' };
  const [evalForm, setEvalForm] = useState({ ...EVAL_EMPTY });

  const EVAL_CRITERIA = [
    { key: 'quality', label: 'Calidad', emoji: '\u2728' },
    { key: 'delivery', label: 'Entrega', emoji: '\ud83d\udce6' },
    { key: 'price', label: L(ml('Price', 'Precio', 'Preço')), emoji: '\ud83d\udcb0' },
    { key: 'communication', label: 'Comunicaci\u00f3n', emoji: '\ud83d\udcac' },
    { key: 'compliance', label: 'Cumplimiento', emoji: '\u2705' },
  ];

  const fetchData = async () => {
    setLoading(true);
    try {
      const [supRes, compRes] = await Promise.all([
        fetch(`/api/suppliers${activeCompanyId ? `?companyId=${activeCompanyId}` : ''}`),
        fetch('/api/companies'),
      ]);
      const supData = await supRes.json();
      const compData = await compRes.json();
      setSuppliers(supData?.suppliers ?? []);
      setCompanies(compData?.companies ?? []);
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, [activeCompanyId]);

  const filtered = useMemo(() => {
    return suppliers.filter(s => {
      if (filterCategory && s.category !== filterCategory) return false;
      if (searchText) {
        const q = searchText.toLowerCase();
        if (!s.name?.toLowerCase().includes(q) && !s.tradeName?.toLowerCase().includes(q) && !s.email?.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [suppliers, filterCategory, searchText]);

  const resetForm = () => setForm({
    companyId: '', name: '', tradeName: '', email: '', phone: '',
    address: '', city: '', country: '', taxId: '', category: '', rating: 0, notes: ''
  });

  const handleSave = async () => {
    const compId = form.companyId || activeCompanyId || companies[0]?.id;
    if (!compId || !form.name) return;
    await fetch('/api/suppliers', {
      method: editId ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, companyId: compId, id: editId || undefined }),
    });
    setShowForm(false); setEditId(null); resetForm(); fetchData();
  };

  const handleEdit = (s: any) => {
    setForm({
      companyId: s.companyId, name: s.name, tradeName: s.tradeName || '',
      email: s.email || '', phone: s.phone || '', address: s.address || '',
      city: s.city || '', country: s.country || '', taxId: s.taxId || '',
      category: s.category || '', rating: s.rating || 0, notes: s.notes || ''
    });
    setEditId(s.id); setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm(L(ml('Delete this supplier?', '{L(ml("Delete this supplier?","¿Eliminar este proveedor?","Excluir este fornecedor?"))}', 'Excluir este fornecedor?')))) return;
    await fetch(`/api/suppliers?id=${id}`, { method: 'DELETE' }); fetchData();
  };

  // Purchase Orders
  const openOrders = async (supplier: any) => {
    setSelectedSupplier(supplier);
    setShowOrders(true);
    const res = await fetch(`/api/purchase-orders?supplierId=${supplier.id}`);
    const data = await res.json();
    setOrders(data?.orders ?? []);
  };

  const handlePOSave = async () => {
    if (!selectedSupplier) return;
    const compId = selectedSupplier.companyId;
    await fetch('/api/purchase-orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        companyId: compId,
        supplierId: selectedSupplier.id,
        currency: poForm.currency,
        taxRate: parseFloat(poForm.taxRate) || 0,
        expectedDate: poForm.expectedDate || null,
        notes: poForm.notes,
        items: poForm.items.filter(i => i.description),
      }),
    });
    setShowPOForm(false);
    setPOForm({ currency: 'USD', taxRate: '0', expectedDate: '', notes: '', items: [{ description: '', quantity: 1, unitPrice: 0 }] });
    const res = await fetch(`/api/purchase-orders?supplierId=${selectedSupplier.id}`);
    const data = await res.json();
    setOrders(data?.orders ?? []);
  };

  const updatePOStatus = async (id: string, status: string) => {
    await fetch('/api/purchase-orders', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status }),
    });
    const res = await fetch(`/api/purchase-orders?supplierId=${selectedSupplier.id}`);
    const data = await res.json();
    setOrders(data?.orders ?? []);
  };

  const openEvaluations = async (supplier: any) => {
    setEvalSupplier(supplier);
    setShowEvalModal(true);
    setShowEvalForm(false);
    setEvalForm({ ...EVAL_EMPTY });
    const res = await fetch(`/api/supplier-evaluations?supplierId=${supplier.id}`);
    const data = await res.json();
    setEvaluations(data?.evaluations ?? []);
    setEvalAverages(data?.averages ?? null);
  };

  const handleEvalSave = async () => {
    if (!evalSupplier) return;
    await fetch('/api/supplier-evaluations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ supplierId: evalSupplier.id, ...evalForm }),
    });
    setShowEvalForm(false);
    setEvalForm({ ...EVAL_EMPTY });
    // Refresh
    const res = await fetch(`/api/supplier-evaluations?supplierId=${evalSupplier.id}`);
    const data = await res.json();
    setEvaluations(data?.evaluations ?? []);
    setEvalAverages(data?.averages ?? null);
    fetchData(); // refresh supplier rating
  };

  const deleteEval = async (id: string) => {
    if (!evalSupplier) return;
    await fetch(`/api/supplier-evaluations?id=${id}`, { method: 'DELETE' });
    const res = await fetch(`/api/supplier-evaluations?supplierId=${evalSupplier.id}`);
    const data = await res.json();
    setEvaluations(data?.evaluations ?? []);
    setEvalAverages(data?.averages ?? null);
    fetchData();
  };

  return (
    <div className="p-6 space-y-6">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm" placeholder="Buscar proveedor..." value={searchText} onChange={e => setSearchText(e.target.value)} />
        </div>
        <select className="border rounded-lg px-3 py-2 text-sm" value={filterCategory} onChange={e => setFilterCategory(e.target.value)}>
          <option value="">{L(ml('All categories','Todas las categorías','Todas as categorias'))}</option>
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <button onClick={() => { resetForm(); setEditId(null); setShowForm(true); }} className="bg-teal-600 text-white px-4 py-2 rounded-lg text-sm flex items-center gap-2 hover:bg-teal-700">
          <Plus className="w-4 h-4" /> Proveedor
        </button>
      </div>

      {/* Supplier Cards */}
      {loading ? <div className="text-center py-12 text-gray-400">Cargando...</div> : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(s => (
            <div key={s.id} className="bg-white dark:bg-gray-900 rounded-xl border p-4 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-full bg-orange-50 dark:bg-orange-900/30 flex items-center justify-center">
                    <Truck className="w-5 h-5 text-orange-600" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-sm">{s.name}</h4>
                    {s.tradeName && <p className="text-xs text-gray-500">{s.tradeName}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-0.5">
                  {[1,2,3,4,5].map(i => <Star key={i} className={`w-3 h-3 ${i <= (s.rating || 0) ? 'fill-amber-400 text-amber-400' : 'text-gray-300'}`} />)}
                </div>
              </div>
              <div className="space-y-1 text-xs text-gray-500 mb-3">
                {s.email && <div className="flex items-center gap-1"><Mail className="w-3 h-3" />{s.email}</div>}
                {s.phone && <div className="flex items-center gap-1"><Phone className="w-3 h-3" />{s.phone}</div>}
                {(s.city || s.country) && <div className="flex items-center gap-1"><MapPin className="w-3 h-3" />{[s.city, s.country].filter(Boolean).join(', ')}</div>}
              </div>
              <div className="flex items-center gap-2 mb-3">
                {s.category && <span className="bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded text-xs">{s.category}</span>}
                {s.taxId && <span className="text-xs text-gray-400">RUT: {s.taxId}</span>}
              </div>
              <div className="flex items-center justify-between border-t pt-3">
                <div className="flex items-center gap-3">
                  <button onClick={() => openOrders(s)} className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                    <ShoppingCart className="w-3 h-3" /> &Oacute;rdenes ({s._count?.invoices ?? 0})
                  </button>
                  <button onClick={() => openEvaluations(s)} className="text-xs text-teal-600 hover:underline flex items-center gap-1">
                    <ClipboardCheck className="w-3 h-3" /> Evaluar
                  </button>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => handleEdit(s)} className="p-1.5 rounded hover:bg-gray-100"><Edit2 className="w-3.5 h-3.5" /></button>
                  <button onClick={() => handleDelete(s.id)} className="p-1.5 rounded hover:bg-red-50 text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>
            </div>
          ))}
          {filtered.length === 0 && <div className="col-span-full text-center py-12 text-gray-400">{L(ml('No suppliers','No hay proveedores','Nenhum fornecedor'))}</div>}
        </div>
      )}

      {/* Supplier Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">{editId ? 'Editar proveedor' : 'Nuevo proveedor'}</h3>
              <button onClick={() => setShowForm(false)}><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-3">
              {!activeCompanyId && companies.length > 1 && (
                <select className="w-full border rounded-lg px-3 py-2 text-sm" value={form.companyId} onChange={e => setForm({ ...form, companyId: e.target.value })}>
                  <option value="">{L(ml('Select company','Seleccionar empresa','Selecionar empresa'))}</option>
                  {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              )}
              <input className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Nombre / Razón social *" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
              <div className="grid grid-cols-2 gap-3">
                <input className="border rounded-lg px-3 py-2 text-sm" placeholder="Nombre comercial" value={form.tradeName} onChange={e => setForm({ ...form, tradeName: e.target.value })} />
                <input className="border rounded-lg px-3 py-2 text-sm" placeholder="RUT / Tax ID" value={form.taxId} onChange={e => setForm({ ...form, taxId: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input className="border rounded-lg px-3 py-2 text-sm" placeholder="Email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
                <input className="border rounded-lg px-3 py-2 text-sm" placeholder="Teléfono" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
              </div>
              <input className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Dirección" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} />
              <div className="grid grid-cols-3 gap-3">
                <input className="border rounded-lg px-3 py-2 text-sm" placeholder="Ciudad" value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} />
                <input className="border rounded-lg px-3 py-2 text-sm" placeholder="País" value={form.country} onChange={e => setForm({ ...form, country: e.target.value })} />
                <select className="border rounded-lg px-3 py-2 text-sm" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                  <option value="">{L(ml('Category','Categoría','Categoria'))}</option>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-1 px-1">
                <span className="text-sm text-gray-500 mr-2">Rating:</span>
                {[1,2,3,4,5].map(i => (
                  <button key={i} onClick={() => setForm({ ...form, rating: i })}>
                    <Star className={`w-5 h-5 ${i <= form.rating ? 'fill-amber-400 text-amber-400' : 'text-gray-300'}`} />
                  </button>
                ))}
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

      {/* Purchase Orders Modal */}
      {showOrders && selectedSupplier && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold">Órdenes de Compra</h3>
                <p className="text-sm text-gray-500">{selectedSupplier.name}</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setShowPOForm(true)} className="bg-teal-600 text-white px-3 py-1.5 rounded-lg text-sm flex items-center gap-1">
                  <Plus className="w-4 h-4" /> Nueva OC
                </button>
                <button onClick={() => { setShowOrders(false); setSelectedSupplier(null); }}><X className="w-5 h-5" /></button>
              </div>
            </div>

            {/* PO Create Form */}
            {showPOForm && (
              <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 mb-4 space-y-3">
                <h4 className="font-semibold text-sm">Nueva Orden de Compra</h4>
                <div className="grid grid-cols-3 gap-3">
                  <select className="border rounded-lg px-3 py-2 text-sm" value={poForm.currency} onChange={e => setPOForm({ ...poForm, currency: e.target.value })}>
                    <option value="USD">USD</option><option value="UYU">UYU</option><option value="BRL">BRL</option><option value="EUR">EUR</option>
                  </select>
                  <input className="border rounded-lg px-3 py-2 text-sm" placeholder="IVA %" type="number" value={poForm.taxRate} onChange={e => setPOForm({ ...poForm, taxRate: e.target.value })} />
                  <input className="border rounded-lg px-3 py-2 text-sm" type="date" placeholder="Entrega esperada" value={poForm.expectedDate} onChange={e => setPOForm({ ...poForm, expectedDate: e.target.value })} />
                </div>
                {/* Items */}
                <div className="space-y-2">
                  <p className="text-xs font-medium text-gray-500">Ítems</p>
                  {poForm.items.map((item, idx) => (
                    <div key={idx} className="flex gap-2">
                      <input className="flex-1 border rounded-lg px-3 py-1.5 text-sm" placeholder="Descripción" value={item.description} onChange={e => { const items = [...poForm.items]; items[idx].description = e.target.value; setPOForm({ ...poForm, items }); }} />
                      <input className="w-20 border rounded-lg px-3 py-1.5 text-sm" placeholder="Cant." type="number" value={item.quantity} onChange={e => { const items = [...poForm.items]; items[idx].quantity = parseFloat(e.target.value) || 0; setPOForm({ ...poForm, items }); }} />
                      <input className="w-28 border rounded-lg px-3 py-1.5 text-sm" placeholder="Precio" type="number" value={item.unitPrice} onChange={e => { const items = [...poForm.items]; items[idx].unitPrice = parseFloat(e.target.value) || 0; setPOForm({ ...poForm, items }); }} />
                      {poForm.items.length > 1 && <button onClick={() => { const items = poForm.items.filter((_, i) => i !== idx); setPOForm({ ...poForm, items }); }} className="text-red-400"><X className="w-4 h-4" /></button>}
                    </div>
                  ))}
                  <button onClick={() => setPOForm({ ...poForm, items: [...poForm.items, { description: '', quantity: 1, unitPrice: 0 }] })} className="text-xs text-teal-600 hover:underline">+ Agregar ítem</button>
                </div>
                <div className="flex justify-end gap-2">
                  <button onClick={() => setShowPOForm(false)} className="px-3 py-1.5 border rounded-lg text-sm">Cancelar</button>
                  <button onClick={handlePOSave} className="px-3 py-1.5 bg-teal-600 text-white rounded-lg text-sm">Crear OC</button>
                </div>
              </div>
            )}

            {/* Orders List */}
            <div className="space-y-3">
              {orders.length === 0 ? (
                <p className="text-center py-6 text-gray-400">Sin órdenes de compra</p>
              ) : orders.map(o => {
                const st = PO_STATUS[o.status] || PO_STATUS.draft;
                const StIcon = st.icon;
                return (
                  <div key={o.id} className="border rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-sm">{o.number}</span>
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${st.bg} ${st.color}`}>
                          <StIcon className="w-3 h-3" /> {st.label}
                        </span>
                      </div>
                      <span className="font-bold text-lg">{fmtMoney(o.total, o.currency)}</span>
                    </div>
                    <div className="text-xs text-gray-500 mb-2">
                      Fecha: {new Date(o.orderDate).toLocaleDateString('es-UY')}
                      {o.expectedDate && ` — Entrega: ${new Date(o.expectedDate).toLocaleDateString('es-UY')}`}
                    </div>
                    {o.items?.length > 0 && (
                      <div className="text-xs text-gray-500 mb-2">
                        {o.items.map((i: any) => `${i.description} (x${i.quantity})`).join(', ')}
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      {o.status === 'draft' && <button onClick={() => updatePOStatus(o.id, 'sent')} className="text-xs px-2 py-1 rounded bg-blue-50 text-blue-600 hover:bg-blue-100">Enviar</button>}
                      {o.status === 'sent' && <button onClick={() => updatePOStatus(o.id, 'confirmed')} className="text-xs px-2 py-1 rounded bg-teal-50 text-teal-600 hover:bg-teal-100">Confirmar</button>}
                      {o.status === 'confirmed' && <button onClick={() => updatePOStatus(o.id, 'received')} className="text-xs px-2 py-1 rounded bg-emerald-50 text-emerald-600 hover:bg-emerald-100">Recibida</button>}
                      {(o.status === 'draft' || o.status === 'sent') && <button onClick={() => updatePOStatus(o.id, 'cancelled')} className="text-xs px-2 py-1 rounded bg-red-50 text-red-600 hover:bg-red-100">Cancelar</button>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
      {/* Evaluation Modal */}
      {showEvalModal && evalSupplier && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div onClick={e => e.stopPropagation()} className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-teal-600" /> Evaluaci&oacute;n de Proveedor
                </h3>
                <p className="text-sm text-gray-500">{evalSupplier.name}</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setShowEvalForm(true)} className="bg-teal-600 text-white px-3 py-1.5 rounded-lg text-sm flex items-center gap-1">
                  <Plus className="w-4 h-4" /> Nueva Evaluaci&oacute;n
                </button>
                <button onClick={() => { setShowEvalModal(false); setEvalSupplier(null); }}><X className="w-5 h-5" /></button>
              </div>
            </div>

            {/* Averages Radar */}
            {evalAverages && (
              <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 mb-4">
                <h4 className="text-sm font-semibold mb-3 text-gray-700">Promedios ({evaluations.length} evaluaci&oacute;n{evaluations.length !== 1 ? 'es' : ''})</h4>
                <div className="grid grid-cols-5 gap-3">
                  {EVAL_CRITERIA.map(c => {
                    const val = evalAverages[c.key] || 0;
                    return (
                      <div key={c.key} className="text-center">
                        <div className="text-lg mb-1">{c.emoji}</div>
                        <div className="text-2xl font-bold text-teal-600">{val.toFixed(1)}</div>
                        <div className="text-xs text-gray-500">{c.label}</div>
                        <div className="mt-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                          <div className="h-full bg-teal-500 rounded-full" style={{ width: `${(val / 5) * 100}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-3 text-center border-t pt-3">
                  <span className="text-sm text-gray-500">Score general:</span>
                  <span className="ml-2 text-xl font-bold text-teal-700">{evalAverages.overall.toFixed(1)} / 5</span>
                </div>
              </div>
            )}

            {/* New Evaluation Form */}
            {showEvalForm && (
              <div className="bg-teal-50 dark:bg-teal-900/20 rounded-xl p-4 mb-4 space-y-3">
                <h4 className="font-semibold text-sm">Nueva Evaluaci&oacute;n</h4>
                <div className="grid grid-cols-5 gap-3">
                  {EVAL_CRITERIA.map(c => (
                    <div key={c.key} className="text-center">
                      <div className="text-sm mb-1">{c.emoji} {c.label}</div>
                      <div className="flex items-center justify-center gap-0.5">
                        {[1,2,3,4,5].map(i => (
                          <button key={i} onClick={() => setEvalForm({ ...evalForm, [c.key]: i })}>
                            <Star className={`w-4 h-4 ${i <= (evalForm as any)[c.key] ? 'fill-amber-400 text-amber-400' : 'text-gray-300'}`} />
                          </button>
                        ))}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">{(evalForm as any)[c.key]}/5</div>
                    </div>
                  ))}
                </div>
                <textarea className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Comentario (opcional)" rows={2}
                  value={evalForm.comment} onChange={e => setEvalForm({ ...evalForm, comment: e.target.value })} />
                <div className="flex justify-end gap-2">
                  <button onClick={() => setShowEvalForm(false)} className="px-3 py-1.5 border rounded-lg text-sm">Cancelar</button>
                  <button onClick={handleEvalSave} className="px-3 py-1.5 bg-teal-600 text-white rounded-lg text-sm">Guardar</button>
                </div>
              </div>
            )}

            {/* Evaluations List */}
            <div className="space-y-3">
              {evaluations.length === 0 ? (
                <p className="text-center py-6 text-gray-400">Sin evaluaciones a&uacute;n</p>
              ) : evaluations.map(ev => (
                <div key={ev.id} className="border rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-gray-500">{new Date(ev.evaluationDate).toLocaleDateString('es-UY')}</span>
                    <button onClick={() => deleteEval(ev.id)} className="text-red-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                  <div className="flex items-center gap-4 flex-wrap">
                    {EVAL_CRITERIA.map(c => (
                      <div key={c.key} className="flex items-center gap-1 text-xs">
                        <span>{c.emoji}</span>
                        <span className="text-gray-600">{c.label}:</span>
                        <span className="font-bold">{(ev as any)[c.key]}/5</span>
                      </div>
                    ))}
                  </div>
                  {ev.comment && <p className="text-xs text-gray-500 mt-2 italic">{ev.comment}</p>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
