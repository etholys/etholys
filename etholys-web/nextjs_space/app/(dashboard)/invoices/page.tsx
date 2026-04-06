'use client';

import { useState, useEffect, useMemo } from 'react';
import { useApp } from '@/app/providers';
import {
  FileText, Plus, Trash2, Search, X, Send, CheckCircle2,
  AlertCircle, ArrowUpRight, ArrowDownRight, Download, Clock, Eye, Pencil,
  RotateCcw, FilePlus2
} from 'lucide-react';

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  DRAFT: { label: 'Borrador', color: 'text-gray-600', bg: 'bg-gray-100' },
  SENT: { label: 'Enviada', color: 'text-blue-600', bg: 'bg-blue-50' },
  PAID: { label: 'Pagada', color: 'text-emerald-600', bg: 'bg-emerald-50' },
  OVERDUE: { label: 'Vencida', color: 'text-red-600', bg: 'bg-red-50' },
  CANCELLED: { label: 'Cancelada', color: 'text-gray-400', bg: 'bg-gray-50' },
};

const TYPE_CONFIG: Record<string, { label: string; icon: any; color: string }> = {
  RECEIVABLE: { label: 'Por cobrar', icon: ArrowUpRight, color: 'text-emerald-600' },
  PAYABLE: { label: 'Por pagar', icon: ArrowDownRight, color: 'text-red-500' },
  CREDIT_NOTE: { label: 'Nota Cr\u00e9dito', icon: RotateCcw, color: 'text-purple-600' },
  DEBIT_NOTE: { label: 'Nota D\u00e9bito', icon: FilePlus2, color: 'text-orange-600' },
};

function formatMoney(amount: number, currency: string = 'USD') {
  return new Intl.NumberFormat('es-UY', { style: 'currency', currency, minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(amount);
}

const EMPTY_FORM = {
  companyId: '', type: 'RECEIVABLE', counterpartyName: '', contactEmail: '',
  issueDate: '', dueDate: '', currency: 'USD', taxRate: '0', notes: '',
  relatedInvoiceId: '',
  items: [{ description: '', quantity: 1, unitPrice: 0 }] as { description: string; quantity: number; unitPrice: number }[]
};


type ML = { es: string; pt: string; en: string };
const ml = (en: string, es: string, pt: string): ML => ({ en, es, pt });
export default function InvoicesPage() {
  const {activeCompanyId, locale } = useApp();
  const L = (m: ML) => m[locale] || m.en;
  const [invoices, setInvoices] = useState<any[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [searchText, setSearchText] = useState('');
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [detailInvoice, setDetailInvoice] = useState<any>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [invRes, compRes] = await Promise.all([
        fetch(`/api/invoices${activeCompanyId ? `?companyId=${activeCompanyId}` : ''}`),
        fetch('/api/companies'),
      ]);
      const invData = await invRes.json();
      const compData = await compRes.json();
      let invs = invData?.invoices ?? [];
      const now = new Date();
      for (const inv of invs) {
        if (inv.dueDate && inv.status !== 'PAID' && inv.status !== 'CANCELLED' && inv.status !== 'OVERDUE') {
          if (new Date(inv.dueDate) < now) {
            await fetch('/api/invoices', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ id: inv.id, status: 'OVERDUE' }),
            });
            inv.status = 'OVERDUE';
          }
        }
      }
      setInvoices(invs);
      setCompanies(compData?.companies ?? []);
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, [activeCompanyId]);

  const filtered = useMemo(() => {
    return invoices.filter(inv => {
      if (filterType && inv.type !== filterType) return false;
      if (filterStatus && inv.status !== filterStatus) return false;
      if (searchText) {
        const q = searchText.toLowerCase();
        if (!inv.number?.toLowerCase().includes(q) && !inv.contactName?.toLowerCase().includes(q) && !inv.description?.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [invoices, filterType, filterStatus, searchText]);

  const stats = useMemo(() => {
    const receivable = invoices.filter(i => i.type === 'RECEIVABLE' && i.status !== 'CANCELLED');
    const payable = invoices.filter(i => i.type === 'PAYABLE' && i.status !== 'CANCELLED');
    const totalReceivable = receivable.reduce((s, i) => s + i.total, 0);
    const totalPayable = payable.reduce((s, i) => s + i.total, 0);
    const overdue = invoices.filter(i => i.status === 'OVERDUE').length;
    const paid = invoices.filter(i => i.status === 'PAID').reduce((s, i) => s + i.total, 0);
    return { totalReceivable, totalPayable, overdue, paid, total: invoices.length };
  }, [invoices]);

  const openNew = () => {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, companyId: activeCompanyId || companies[0]?.id || '' });
    setShowForm(true);
  };

  const openEdit = (inv: any) => {
    setEditingId(inv.id);
    setForm({
      companyId: inv.companyId || '',
      type: inv.type || 'RECEIVABLE',
      counterpartyName: inv.contactName || '',
      contactEmail: inv.contactEmail || '',
      issueDate: inv.issueDate ? new Date(inv.issueDate).toISOString().slice(0, 10) : '',
      dueDate: inv.dueDate ? new Date(inv.dueDate).toISOString().slice(0, 10) : '',
      currency: inv.currency || 'USD',
      taxRate: String(inv.taxRate ?? 0),
      notes: inv.notes || '',
      relatedInvoiceId: inv.relatedInvoiceId || '',
      items: (inv.items && inv.items.length > 0)
        ? inv.items.map((it: any) => ({ description: it.description || '', quantity: it.quantity || 1, unitPrice: it.unitPrice || 0 }))
        : [{ description: '', quantity: 1, unitPrice: 0 }],
    });
    setShowForm(true);
  };

  // Open new credit/debit note referencing an existing invoice
  const openNote = (inv: any, noteType: 'CREDIT_NOTE' | 'DEBIT_NOTE') => {
    setEditingId(null);
    setForm({
      ...EMPTY_FORM,
      companyId: inv.companyId || activeCompanyId || companies[0]?.id || '',
      type: noteType,
      relatedInvoiceId: inv.id,
      counterpartyName: inv.contactName || '',
      contactEmail: inv.contactEmail || '',
      currency: inv.currency || 'USD',
      taxRate: String(inv.taxRate ?? 0),
      items: (inv.items && inv.items.length > 0)
        ? inv.items.map((it: any) => ({ description: it.description || '', quantity: it.quantity || 1, unitPrice: it.unitPrice || 0 }))
        : [{ description: '', quantity: 1, unitPrice: 0 }],
    });
    setShowForm(true);
  };

  const handleSubmit = async () => {
    const compId = form.companyId || activeCompanyId || companies[0]?.id;
    if (!compId) return;
    const payload: any = {
      ...form,
      companyId: compId,
      taxRate: parseFloat(form.taxRate) || 0,
      items: form.items.filter(i => i.description),
    };
    if (editingId) {
      payload.id = editingId;
      await fetch('/api/invoices', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } else {
      await fetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    }
    setShowForm(false);
    setEditingId(null);
    setForm({ ...EMPTY_FORM });
    fetchData();
  };

  const updateStatus = async (id: string, status: string) => {
    await fetch('/api/invoices', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status }),
    });
    fetchData();
  };

  const deleteInvoice = async (id: string) => {
    if (!confirm('\u00bfEliminar esta factura?')) return;
    await fetch(`/api/invoices?id=${id}`, { method: 'DELETE' });
    fetchData();
  };

  const downloadPDF = async (inv: any) => {
    setDownloadingId(inv.id);
    try {
      const res = await fetch(`/api/invoices/pdf?id=${inv.id}`);
      if (!res.ok) throw new Error(L(ml('Error generating PDF','Error generando PDF','Erro ao gerar PDF')));
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${inv.number}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert(L(ml('Error generating PDF','Error al generar PDF','Erro ao gerar PDF')));
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-900 rounded-xl border p-4">
          <div className="flex items-center gap-2 mb-1"><ArrowUpRight className="w-4 h-4 text-emerald-600" /><span className="text-xs text-gray-500">{L(ml("Receivable","Por cobrar","A receber"))}</span></div>
          <div className="text-xl font-bold text-emerald-600">{formatMoney(stats.totalReceivable)}</div>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-xl border p-4">
          <div className="flex items-center gap-2 mb-1"><ArrowDownRight className="w-4 h-4 text-red-500" /><span className="text-xs text-gray-500">{L(ml("Payable","Por pagar","A pagar"))}</span></div>
          <div className="text-xl font-bold text-red-500">{formatMoney(stats.totalPayable)}</div>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-xl border p-4">
          <div className="flex items-center gap-2 mb-1"><AlertCircle className="w-4 h-4 text-red-600" /><span className="text-xs text-gray-500">Vencidas</span></div>
          <div className="text-xl font-bold text-red-600">{stats.overdue}</div>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-xl border p-4">
          <div className="flex items-center gap-2 mb-1"><CheckCircle2 className="w-4 h-4 text-emerald-600" /><span className="text-xs text-gray-500">Cobrado</span></div>
          <div className="text-xl font-bold">{formatMoney(stats.paid)}</div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm" placeholder="Buscar factura..." value={searchText} onChange={e => setSearchText(e.target.value)} />
        </div>
        <select className="border rounded-lg px-3 py-2 text-sm" value={filterType} onChange={e => setFilterType(e.target.value)}>
          <option value="">{L(ml('All types','Todos los tipos','Todos os tipos'))}</option>
          <option value="RECEIVABLE">{L(ml('Receivable','Por cobrar','A receber'))}</option>
          <option value="PAYABLE">{L(ml('Payable','Por pagar','A pagar'))}</option>
          <option value="CREDIT_NOTE">{L(ml('Credit Note','Nota Crédito','Nota de Crédito'))}</option>
          <option value="DEBIT_NOTE">{L(ml('Debit Note','Nota Débito','Nota de Débito'))}</option>
        </select>
        <select className="border rounded-lg px-3 py-2 text-sm" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="">{L(ml('All statuses','Todos los estados','Todos os status'))}</option>
          {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <button onClick={openNew} className="bg-teal-600 text-white px-4 py-2 rounded-lg text-sm flex items-center gap-2 hover:bg-teal-700">
          <Plus className="w-4 h-4" /> Factura
        </button>
      </div>

      {/* Table */}
      {loading ? <div className="text-center py-12 text-gray-400">Cargando...</div> : (
        <div className="bg-white dark:bg-gray-900 rounded-xl border overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50 dark:bg-gray-800">
                <th className="px-4 py-3 text-left font-medium text-gray-500">N&uacute;mero</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Tipo</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Cliente/Proveedor</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Emisi&oacute;n</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Vencimiento</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">{L(ml('Total','Total','Total'))}</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Estado</th>
                <th className="px-4 py-3 text-center font-medium text-gray-500">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(inv => {
                const st = STATUS_CONFIG[inv.status] || STATUS_CONFIG.DRAFT;
                const tp = TYPE_CONFIG[inv.type] || TYPE_CONFIG.RECEIVABLE;
                const TypeIcon = tp.icon;
                return (
                  <tr key={inv.id} className="border-b hover:bg-gray-50 dark:hover:bg-gray-800">
                    <td className="px-4 py-3">
                      <span className="font-semibold">{inv.number}</span>
                      {inv.relatedInvoice && <span className="block text-xs text-gray-400">Ref: {inv.relatedInvoice.number}</span>}
                      {inv.creditDebitNotes?.length > 0 && <span className="block text-xs text-purple-500">{inv.creditDebitNotes.length} nota(s)</span>}
                    </td>
                    <td className="px-4 py-3"><span className={`flex items-center gap-1 ${tp.color}`}><TypeIcon className="w-4 h-4" /> {tp.label}</span></td>
                    <td className="px-4 py-3">{inv.contactName || inv.supplier?.name || '\u2014'}</td>
                    <td className="px-4 py-3 text-gray-500">{new Date(inv.issueDate).toLocaleDateString('es-UY')}</td>
                    <td className="px-4 py-3 text-gray-500">{inv.dueDate ? new Date(inv.dueDate).toLocaleDateString('es-UY') : '\u2014'}</td>
                    <td className="px-4 py-3 text-right font-bold">{formatMoney(inv.total, inv.currency)}</td>
                    <td className="px-4 py-3"><span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${st.bg} ${st.color}`}>{st.label}</span></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => setDetailInvoice(inv)} className="p-1.5 rounded hover:bg-gray-100" title="Ver detalle"><Eye className="w-4 h-4" /></button>
                        <button onClick={() => openEdit(inv)} className="p-1.5 rounded hover:bg-teal-50 text-teal-600" title="Editar"><Pencil className="w-4 h-4" /></button>
                        <button onClick={() => downloadPDF(inv)} disabled={downloadingId === inv.id} className="p-1.5 rounded hover:bg-blue-50 text-blue-600" title="Descargar PDF">
                          {downloadingId === inv.id ? <Clock className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                        </button>
                        {inv.status === 'DRAFT' && <button onClick={() => updateStatus(inv.id, 'SENT')} className="p-1.5 rounded hover:bg-blue-50 text-blue-600" title="Marcar enviada"><Send className="w-4 h-4" /></button>}
                        {(inv.status === 'SENT' || inv.status === 'OVERDUE') && <button onClick={() => updateStatus(inv.id, 'PAID')} className="p-1.5 rounded hover:bg-emerald-50 text-emerald-600" title="Marcar pagada"><CheckCircle2 className="w-4 h-4" /></button>}
                        {(inv.type === 'RECEIVABLE' || inv.type === 'PAYABLE') && (
                          <button onClick={() => openNote(inv, 'CREDIT_NOTE')} className="p-1.5 rounded hover:bg-purple-50 text-purple-600" title="Nota de cr&eacute;dito"><RotateCcw className="w-4 h-4" /></button>
                        )}
                        <button onClick={() => deleteInvoice(inv.id)} className="p-1.5 rounded hover:bg-red-50 text-red-500" title="Eliminar"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">{L(ml("No invoices","No hay facturas","Sem faturas"))}</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {/* Detail Modal - NO click-outside-close */}
      {detailInvoice && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">{detailInvoice.number}</h3>
              <button onClick={() => setDetailInvoice(null)}><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div><span className="text-gray-500">Tipo:</span> {TYPE_CONFIG[detailInvoice.type]?.label}</div>
                <div><span className="text-gray-500">Estado:</span> <span className={`${STATUS_CONFIG[detailInvoice.status]?.color}`}>{STATUS_CONFIG[detailInvoice.status]?.label}</span></div>
                <div><span className="text-gray-500">Cliente/Proveedor:</span> {detailInvoice.contactName || '\u2014'}</div>
                <div><span className="text-gray-500">Email:</span> {detailInvoice.contactEmail || '\u2014'}</div>
                <div><span className="text-gray-500">Emisi&oacute;n:</span> {new Date(detailInvoice.issueDate).toLocaleDateString('es-UY')}</div>
                <div><span className="text-gray-500">Vencimiento:</span> {detailInvoice.dueDate ? new Date(detailInvoice.dueDate).toLocaleDateString('es-UY') : '\u2014'}</div>
              </div>
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 dark:bg-gray-800">
                    <tr><th className="px-3 py-2 text-left">Descripci&oacute;n</th><th className="px-3 py-2 text-right">Cant.</th><th className="px-3 py-2 text-right">P. Unit.</th><th className="px-3 py-2 text-right">Total</th></tr>
                  </thead>
                  <tbody>
                    {(detailInvoice.items || []).map((item: any, i: number) => (
                      <tr key={i} className="border-t"><td className="px-3 py-2">{item.description}</td><td className="px-3 py-2 text-right">{item.quantity}</td><td className="px-3 py-2 text-right">{formatMoney(item.unitPrice, detailInvoice.currency)}</td><td className="px-3 py-2 text-right">{formatMoney(item.total, detailInvoice.currency)}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="text-right space-y-1">
                <div>{L(ml('Subtotal','Subtotal','Subtotal'))}: <b>{formatMoney(detailInvoice.subtotal, detailInvoice.currency)}</b></div>
                {detailInvoice.taxRate > 0 && (
                  <div>IVA ({detailInvoice.taxRate}%): <b>{formatMoney(detailInvoice.taxAmount, detailInvoice.currency)}</b></div>
                )}
                <div className="text-lg">Total: <b>{formatMoney(detailInvoice.total, detailInvoice.currency)}</b></div>
              </div>
              {detailInvoice.relatedInvoice && (
                <div className="bg-purple-50 rounded-lg p-3 text-xs flex items-center gap-2">
                  <RotateCcw className="w-4 h-4 text-purple-600" />
                  <span>{L(ml('Original invoice reference','Referencia factura original','Referência fatura original'))}:  <b>{detailInvoice.relatedInvoice.number}</b></span>
                </div>
              )}
              {detailInvoice.creditDebitNotes?.length > 0 && (
                <div className="bg-purple-50 rounded-lg p-3 text-xs space-y-1">
                  <b>{L(ml('Associated credit/debit notes','Notas de crédito/débito asociadas','Notas de crédito/débito associadas'))}:</b>
                  {detailInvoice.creditDebitNotes.map((n: any) => (
                    <div key={n.id} className="flex justify-between">
                      <span>{n.number} ({TYPE_CONFIG[n.type]?.label})</span>
                      <span className="font-mono">{formatMoney(n.total, detailInvoice.currency)}</span>
                    </div>
                  ))}
                </div>
              )}
              {detailInvoice.notes && <div className="bg-amber-50 rounded-lg p-3 text-xs"><b>Notas:</b> {detailInvoice.notes}</div>}
            </div>
            <div className="flex justify-end gap-2 mt-4 flex-wrap">
              {(detailInvoice.type === 'RECEIVABLE' || detailInvoice.type === 'PAYABLE') && (
                <button onClick={() => { setDetailInvoice(null); openNote(detailInvoice, 'CREDIT_NOTE'); }} className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm flex items-center gap-2">
                  <RotateCcw className="w-4 h-4" /> Nota Cr&eacute;dito
                </button>
              )}
              <button onClick={() => { setDetailInvoice(null); openEdit(detailInvoice); }} className="px-4 py-2 bg-teal-600 text-white rounded-lg text-sm flex items-center gap-2">
                <Pencil className="w-4 h-4" /> Editar
              </button>
              <button onClick={() => downloadPDF(detailInvoice)} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm flex items-center gap-2">
                <Download className="w-4 h-4" /> Descargar PDF
              </button>
              <button onClick={() => setDetailInvoice(null)} className="px-4 py-2 border rounded-lg text-sm">Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {/* Create / Edit Form Modal - NO click-outside-close */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">{editingId ? 'Editar Factura' : L(ml('New Invoice', 'Nueva Factura', 'Nova Fatura'))}</h3>
              <button onClick={() => { setShowForm(false); setEditingId(null); }}><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-3">
              {!activeCompanyId && companies.length > 1 && (
                <select className="w-full border rounded-lg px-3 py-2 text-sm" value={form.companyId} onChange={e => setForm({ ...form, companyId: e.target.value })}>
                  <option value="">{L(ml('Select company','Seleccionar empresa','Selecionar empresa'))}</option>
                  {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              )}
              {form.relatedInvoiceId && (
                <div className="bg-purple-50 rounded-lg p-3 text-xs flex items-center gap-2">
                  <RotateCcw className="w-4 h-4 text-purple-600" />
                  <span>Referenciando factura: <b>{invoices.find(i => i.id === form.relatedInvoiceId)?.number || form.relatedInvoiceId}</b></span>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <select className="border rounded-lg px-3 py-2 text-sm" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
                  <option value="RECEIVABLE">Por cobrar</option>
                  <option value="PAYABLE">Por pagar</option>
                  <option value="CREDIT_NOTE">Nota Cr&eacute;dito</option>
                  <option value="DEBIT_NOTE">Nota D&eacute;bito</option>
                </select>
                <select className="border rounded-lg px-3 py-2 text-sm" value={form.currency} onChange={e => setForm({ ...form, currency: e.target.value })}>
                  <option value="USD">USD</option><option value="UYU">UYU</option><option value="BRL">BRL</option><option value="EUR">EUR</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input className="border rounded-lg px-3 py-2 text-sm" placeholder="Cliente/Proveedor" value={form.counterpartyName} onChange={e => setForm({ ...form, counterpartyName: e.target.value })} />
                <input className="border rounded-lg px-3 py-2 text-sm" placeholder="Email contacto" value={form.contactEmail} onChange={e => setForm({ ...form, contactEmail: e.target.value })} />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Emisi&oacute;n</label>
                  <input className="w-full border rounded-lg px-3 py-2 text-sm" type="date" value={form.issueDate} onChange={e => setForm({ ...form, issueDate: e.target.value })} />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Vencimiento</label>
                  <input className="w-full border rounded-lg px-3 py-2 text-sm" type="date" value={form.dueDate} onChange={e => setForm({ ...form, dueDate: e.target.value })} />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">IVA % (opcional, default 0)</label>
                  <input className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="0" type="number" min="0" max="100" value={form.taxRate} onChange={e => setForm({ ...form, taxRate: e.target.value })} />
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-xs font-medium text-gray-500">&Iacute;tems</p>
                {form.items.map((item, idx) => (
                  <div key={idx} className="flex gap-2">
                    <input className="flex-1 border rounded-lg px-3 py-1.5 text-sm" placeholder="Descripci&oacute;n" value={item.description} onChange={e => { const items = [...form.items]; items[idx] = { ...items[idx], description: e.target.value }; setForm({ ...form, items }); }} />
                    <input className="w-20 border rounded-lg px-3 py-1.5 text-sm" placeholder="Cant." type="number" value={item.quantity} onChange={e => { const items = [...form.items]; items[idx] = { ...items[idx], quantity: parseFloat(e.target.value) || 0 }; setForm({ ...form, items }); }} />
                    <input className="w-28 border rounded-lg px-3 py-1.5 text-sm" placeholder="Precio" type="number" value={item.unitPrice} onChange={e => { const items = [...form.items]; items[idx] = { ...items[idx], unitPrice: parseFloat(e.target.value) || 0 }; setForm({ ...form, items }); }} />
                    {form.items.length > 1 && <button onClick={() => setForm({ ...form, items: form.items.filter((_, i) => i !== idx) })} className="text-red-400"><X className="w-4 h-4" /></button>}
                  </div>
                ))}
                <button onClick={() => setForm({ ...form, items: [...form.items, { description: '', quantity: 1, unitPrice: 0 }] })} className="text-xs text-teal-600 hover:underline">+ Agregar &iacute;tem</button>
              </div>
              <textarea className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Notas" rows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => { setShowForm(false); setEditingId(null); }} className="px-4 py-2 border rounded-lg text-sm">{L(ml("Cancel","Cancelar","Cancelar"))}</button>
              <button onClick={handleSubmit} className="px-4 py-2 bg-teal-600 text-white rounded-lg text-sm hover:bg-teal-700 flex items-center gap-1.5">
                {editingId ? <><Pencil className="w-3.5 h-3.5" />Guardar cambios</> : <><Plus className="w-3.5 h-3.5" />Crear</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
