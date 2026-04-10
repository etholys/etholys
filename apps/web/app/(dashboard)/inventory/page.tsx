'use client';

import { useState, useEffect, useMemo } from 'react';
import { useApp } from '@/app/providers';
import {
  Package, Plus, Trash2, Search, X, Edit2, AlertTriangle,
  ArrowUpCircle, ArrowDownCircle, RefreshCw, History, BarChart3
} from 'lucide-react';

const CATEGORIES = [
  'Materiales', 'Servicios', 'Tecnología', 'Logística', 'Equipamiento',
  'Insumos', 'Construcción', 'Alimentación', 'Oficina', 'Otro'
];

function fmtMoney(n: number, c: string = 'USD') {
  return new Intl.NumberFormat('es-UY', { style: 'currency', currency: c, minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(n);
}

const MOVE_TYPES: Record<string, { label: string; icon: any; color: string }> = {
  IN: { label: 'Entrada', icon: ArrowUpCircle, color: 'text-emerald-600' },
  OUT: { label: 'Salida', icon: ArrowDownCircle, color: 'text-red-500' },
  ADJUSTMENT: { label: 'Ajuste', icon: RefreshCw, color: 'text-blue-500' },
};


type ML = { es: string; pt: string; en: string };
const ml = (en: string, es: string, pt: string): ML => ({ en, es, pt });
export default function InventoryPage() {
  const {activeCompanyId, locale } = useApp();
  const L = (m: ML) => m[locale] || m.en;
  const [products, setProducts] = useState<any[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [searchText, setSearchText] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [showLowStock, setShowLowStock] = useState(false);
  // Movement state
  const [showMovements, setShowMovements] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [movements, setMovements] = useState<any[]>([]);
  const [showMoveForm, setShowMoveForm] = useState(false);
  const [moveForm, setMoveForm] = useState({ type: 'IN', quantity: '', reason: '', reference: '', notes: '' });

  const [form, setForm] = useState({
    companyId: '', name: '', sku: '', description: '', category: '',
    unit: 'unidad', costPrice: '', salePrice: '', currency: 'USD',
    stockQty: '0', minStock: '', location: ''
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [pRes, cRes] = await Promise.all([
        fetch(`/api/products${activeCompanyId ? `?companyId=${activeCompanyId}` : ''}`),
        fetch('/api/companies'),
      ]);
      const pData = await pRes.json();
      const cData = await cRes.json();
      setProducts(pData?.products ?? []);
      setCompanies(cData?.companies ?? []);
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, [activeCompanyId]);

  const filtered = useMemo(() => {
    return products.filter(p => {
      if (filterCategory && p.category !== filterCategory) return false;
      if (showLowStock && (!p.minStock || p.stockQty > p.minStock)) return false;
      if (searchText) {
        const q = searchText.toLowerCase();
        if (!p.name?.toLowerCase().includes(q) && !p.sku?.toLowerCase().includes(q) && !p.category?.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [products, filterCategory, showLowStock, searchText]);

  const stats = useMemo(() => {
    const totalValue = products.reduce((s, p) => s + (p.costPrice || 0) * (p.stockQty || 0), 0);
    const lowStockCount = products.filter(p => p.minStock && p.stockQty <= p.minStock).length;
    const categories = [...new Set(products.map(p => p.category).filter(Boolean))];
    return { total: products.length, totalValue, lowStockCount, categories: categories.length };
  }, [products]);

  const handleSave = async () => {
    const compId = form.companyId || activeCompanyId || companies[0]?.id;
    if (!compId || !form.name) return;
    const payload = {
      ...form, companyId: compId, id: editId || undefined,
      costPrice: parseFloat(form.costPrice) || 0,
      salePrice: parseFloat(form.salePrice) || 0,
      stockQty: parseFloat(form.stockQty) || 0,
      minStock: form.minStock ? parseFloat(form.minStock) : null,
    };
    await fetch('/api/products', {
      method: editId ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    setShowForm(false); setEditId(null);
    resetForm();
    fetchData();
  };

  const resetForm = () => setForm({
    companyId: '', name: '', sku: '', description: '', category: '',
    unit: 'unidad', costPrice: '', salePrice: '', currency: 'USD',
    stockQty: '0', minStock: '', location: ''
  });

  const handleEdit = (p: any) => {
    setForm({
      companyId: p.companyId, name: p.name, sku: p.sku || '', description: p.description || '',
      category: p.category || '', unit: p.unit || 'unidad', costPrice: String(p.costPrice || ''),
      salePrice: String(p.salePrice || ''), currency: p.currency || 'USD',
      stockQty: String(p.stockQty || 0), minStock: p.minStock ? String(p.minStock) : '', location: p.location || ''
    });
    setEditId(p.id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm(L(ml('Delete this product?', '{L(ml("Delete this product?","¿Eliminar este producto?","Excluir este produto?"))}', 'Excluir este produto?')))) return;
    await fetch(`/api/products?id=${id}`, { method: 'DELETE' });
    fetchData();
  };

  // Movements
  const openMovements = async (product: any) => {
    setSelectedProduct(product);
    setShowMovements(true);
    const res = await fetch(`/api/stock-movements?productId=${product.id}`);
    const data = await res.json();
    setMovements(data?.movements ?? []);
  };

  const handleMoveSave = async () => {
    if (!selectedProduct || !moveForm.quantity) return;
    await fetch('/api/stock-movements', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        productId: selectedProduct.id,
        type: moveForm.type,
        quantity: parseFloat(moveForm.quantity),
        reason: moveForm.reason,
        reference: moveForm.reference,
        notes: moveForm.notes,
      }),
    });
    setShowMoveForm(false);
    setMoveForm({ type: 'IN', quantity: '', reason: '', reference: '', notes: '' });
    // Refresh
    const res = await fetch(`/api/stock-movements?productId=${selectedProduct.id}`);
    const data = await res.json();
    setMovements(data?.movements ?? []);
    fetchData();
  };

  return (
    <div className="p-6 space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: L(ml('Total products','Total productos','Total produtos')), value: stats.total, icon: Package, color: 'text-teal-600' },
          { label: L(ml('Stock value','Valor del stock','Valor do estoque')), value: fmtMoney(stats.totalValue), icon: BarChart3, color: 'text-blue-600' },
          { label: 'L(ml("Low stock","Stock bajo","Estoque baixo"))', value: stats.lowStockCount, icon: AlertTriangle, color: 'text-red-500' },
          { label: L(ml('Categories','Categorías','Categorias')), value: stats.categories, icon: Package, color: 'text-purple-600' },
        ].map((kpi, i) => (
          <div key={i} className="bg-white dark:bg-gray-900 rounded-xl border p-4">
            <div className="flex items-center gap-2 mb-1">
              <kpi.icon className={`w-4 h-4 ${kpi.color}`} />
              <span className="text-xs text-gray-500">{kpi.label}</span>
            </div>
            <div className="text-xl font-bold">{kpi.value}</div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm" placeholder="Buscar producto, SKU..." value={searchText} onChange={e => setSearchText(e.target.value)} />
        </div>
        <select className="border rounded-lg px-3 py-2 text-sm" value={filterCategory} onChange={e => setFilterCategory(e.target.value)}>
          <option value="">{L(ml('All categories','Todas las categorías','Todas as categorias'))}</option>
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <button onClick={() => setShowLowStock(!showLowStock)} className={`px-3 py-2 rounded-lg text-sm border ${showLowStock ? 'bg-red-50 border-red-300 text-red-700' : ''}`}>
          <AlertTriangle className="w-4 h-4 inline mr-1" /> Stock bajo
        </button>
        <button onClick={() => { resetForm(); setEditId(null); setShowForm(true); }} className="bg-teal-600 text-white px-4 py-2 rounded-lg text-sm flex items-center gap-2 hover:bg-teal-700">
          <Plus className="w-4 h-4" /> Producto
        </button>
      </div>

      {/* Table */}
      {loading ? <div className="text-center py-12 text-gray-400">Cargando...</div> : (
        <div className="bg-white dark:bg-gray-900 rounded-xl border overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50 dark:bg-gray-800">
                <th className="px-4 py-3 text-left font-medium text-gray-500">Producto</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">{L(ml("SKU","SKU","SKU"))}</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">{L(ml("Category","Categoría","Categoria"))}</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">Costo</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">Precio venta</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">Stock</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Ubicación</th>
                <th className="px-4 py-3 text-center font-medium text-gray-500">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => {
                const isLow = p.minStock && p.stockQty <= p.minStock;
                return (
                  <tr key={p.id} className="border-b hover:bg-gray-50 dark:hover:bg-gray-800">
                    <td className="px-4 py-3 font-medium">{p.name}</td>
                    <td className="px-4 py-3 text-gray-500">{p.sku || '—'}</td>
                    <td className="px-4 py-3"><span className="bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded text-xs">{p.category || '—'}</span></td>
                    <td className="px-4 py-3 text-right">{p.costPrice ? fmtMoney(p.costPrice, p.currency) : '—'}</td>
                    <td className="px-4 py-3 text-right">{p.salePrice ? fmtMoney(p.salePrice, p.currency) : '—'}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={`font-semibold ${isLow ? 'text-red-600' : 'text-gray-900 dark:text-white'}`}>
                        {p.stockQty} {p.unit}
                      </span>
                      {isLow && <AlertTriangle className="w-3 h-3 text-red-500 inline ml-1" />}
                    </td>
                    <td className="px-4 py-3 text-gray-500">{p.location || '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => openMovements(p)} className="p-1.5 rounded hover:bg-blue-50 text-blue-600" title="Movimientos">
                          <History className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleEdit(p)} className="p-1.5 rounded hover:bg-gray-100" title="Editar">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDelete(p.id)} className="p-1.5 rounded hover:bg-red-50 text-red-500" title="Eliminar">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">{L(ml('No products','No hay productos','Nenhum produto'))}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Product Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">{editId ? 'Editar producto' : 'Nuevo producto'}</h3>
              <button onClick={() => setShowForm(false)}><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-3">
              {!activeCompanyId && companies.length > 1 && (
                <select className="w-full border rounded-lg px-3 py-2 text-sm" value={form.companyId} onChange={e => setForm({ ...form, companyId: e.target.value })}>
                  <option value="">{L(ml('Select company','Seleccionar empresa','Selecionar empresa'))}</option>
                  {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              )}
              <input className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Nombre *" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
              <div className="grid grid-cols-2 gap-3">
                <input className="border rounded-lg px-3 py-2 text-sm" placeholder="SKU" value={form.sku} onChange={e => setForm({ ...form, sku: e.target.value })} />
                <select className="border rounded-lg px-3 py-2 text-sm" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                  <option value="">{L(ml('Category','Categoría','Categoria'))}</option>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <input className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Descripción" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
              <div className="grid grid-cols-3 gap-3">
                <input className="border rounded-lg px-3 py-2 text-sm" placeholder="Unidad" value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })} />
                <input className="border rounded-lg px-3 py-2 text-sm" placeholder="Costo" type="number" value={form.costPrice} onChange={e => setForm({ ...form, costPrice: e.target.value })} />
                <input className="border rounded-lg px-3 py-2 text-sm" placeholder="Precio venta" type="number" value={form.salePrice} onChange={e => setForm({ ...form, salePrice: e.target.value })} />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <input className="border rounded-lg px-3 py-2 text-sm" placeholder="Stock actual" type="number" value={form.stockQty} onChange={e => setForm({ ...form, stockQty: e.target.value })} />
                <input className="border rounded-lg px-3 py-2 text-sm" placeholder="Stock mínimo" type="number" value={form.minStock} onChange={e => setForm({ ...form, minStock: e.target.value })} />
                <input className="border rounded-lg px-3 py-2 text-sm" placeholder="Ubicación" value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 border rounded-lg text-sm">{L(ml("Cancel","Cancelar","Cancelar"))}</button>
              <button onClick={handleSave} className="px-4 py-2 bg-teal-600 text-white rounded-lg text-sm hover:bg-teal-700">{L(ml("Save","Guardar","Salvar"))}</button>
            </div>
          </div>
        </div>
      )}

      {/* Stock Movements Modal */}
      {showMovements && selectedProduct && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold">Movimientos de Stock</h3>
                <p className="text-sm text-gray-500">{selectedProduct.name} — Stock actual: <b>{selectedProduct.stockQty} {selectedProduct.unit}</b></p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setShowMoveForm(true)} className="bg-teal-600 text-white px-3 py-1.5 rounded-lg text-sm flex items-center gap-1 hover:bg-teal-700">
                  <Plus className="w-4 h-4" /> Movimiento
                </button>
                <button onClick={() => { setShowMovements(false); setSelectedProduct(null); }}><X className="w-5 h-5" /></button>
              </div>
            </div>

            {/* Movement Form */}
            {showMoveForm && (
              <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 mb-4 space-y-3">
                <div className="flex gap-2">
                  {Object.entries(MOVE_TYPES).map(([key, cfg]) => (
                    <button key={key} onClick={() => setMoveForm({ ...moveForm, type: key })} className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm border ${moveForm.type === key ? 'bg-teal-50 border-teal-300 text-teal-700' : ''}`}>
                      <cfg.icon className={`w-4 h-4 ${cfg.color}`} /> {cfg.label}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <input className="border rounded-lg px-3 py-2 text-sm" placeholder={moveForm.type === 'ADJUSTMENT' ? 'Nuevo stock total' : 'Cantidad *'} type="number" value={moveForm.quantity} onChange={e => setMoveForm({ ...moveForm, quantity: e.target.value })} />
                  <input className="border rounded-lg px-3 py-2 text-sm" placeholder="Referencia (OC, factura...)" value={moveForm.reference} onChange={e => setMoveForm({ ...moveForm, reference: e.target.value })} />
                </div>
                <input className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Motivo" value={moveForm.reason} onChange={e => setMoveForm({ ...moveForm, reason: e.target.value })} />
                <div className="flex justify-end gap-2">
                  <button onClick={() => setShowMoveForm(false)} className="px-3 py-1.5 border rounded-lg text-sm">Cancelar</button>
                  <button onClick={handleMoveSave} className="px-3 py-1.5 bg-teal-600 text-white rounded-lg text-sm">Registrar</button>
                </div>
              </div>
            )}

            {/* Movement History */}
            <div className="space-y-2">
              {movements.length === 0 ? (
                <p className="text-center py-6 text-gray-400">Sin movimientos registrados</p>
              ) : movements.map(m => {
                const cfg = MOVE_TYPES[m.type] || MOVE_TYPES.IN;
                const Icon = cfg.icon;
                return (
                  <div key={m.id} className="flex items-center gap-3 p-3 border rounded-lg">
                    <Icon className={`w-5 h-5 ${cfg.color} flex-shrink-0`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{cfg.label}</span>
                        <span className="text-sm font-bold">{m.quantity} {selectedProduct.unit}</span>
                        {m.reference && <span className="text-xs bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded">{m.reference}</span>}
                      </div>
                      {m.reason && <p className="text-xs text-gray-500">{m.reason}</p>}
                    </div>
                    <span className="text-xs text-gray-400 flex-shrink-0">{new Date(m.createdAt).toLocaleDateString('es-UY')}</span>
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
