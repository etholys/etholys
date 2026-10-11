'use client';

import { useState, useEffect, useMemo } from 'react';
import { useApp } from '@/app/providers';
import InvoiceThemePanel from '@/components/atlas/InvoiceThemePanel';
import InvoiceIssueFields, { type InvoiceIssueForm } from '@/components/atlas/InvoiceIssueFields';
import {
  FileText, Plus, Trash2, Search, X, Send, CheckCircle2,
  AlertCircle, ArrowUpRight, ArrowDownRight, Download, Clock, Eye, Pencil,
  RotateCcw, FilePlus2, Copy, CalendarPlus
} from 'lucide-react';
import { dateOnlyIso } from '@/lib/atlas/date-only';
import { clientToInvoiceParty, convertAmount, INVOICE_CURRENCIES } from '@/lib/atlas/invoice-ops';

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

const EMPTY_FORM: InvoiceIssueForm = {
  companyId: '', type: 'RECEIVABLE', clientId: '', counterpartyName: '', contactEmail: '',
  contactPhone: '', contactAddress: '', contactExtra: '',
  number: '', numberMode: 'auto',
  issueDate: '', dueDate: '', currency: 'USD', altCurrency: '', exchangeRate: '',
  exchangeRateDate: '', exchangeRateSource: '',
  bankAccountId: '', signatureId: '', signatureImage: '',
  taxRate: '0', notes: '',
  relatedInvoiceId: '',
  items: [{ description: '', quantity: 1, unitPrice: 0 }]
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
  const [repeatFor, setRepeatFor] = useState<any>(null);
  const [repeatMonths, setRepeatMonths] = useState('1');
  const [duplicating, setDuplicating] = useState(false);
  const [clients, setClients] = useState<any[]>([]);
  const [banks, setBanks] = useState<any[]>([]);
  const [signatures, setSignatures] = useState<any[]>([]);
  const [previewNumber, setPreviewNumber] = useState('');
  const [numberingHint, setNumberingHint] = useState('');
  const [showNewClient, setShowNewClient] = useState(false);
  const [showNewBank, setShowNewBank] = useState(false);

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

  const loadCatalog = async (companyId: string, issueDate?: string) => {
    if (!companyId) return;
    try {
      const q = `companyId=${encodeURIComponent(companyId)}`;
      const [cl, bk, sg, nm] = await Promise.all([
        fetch(`/api/clients?${q}`).then((r) => r.json()),
        fetch(`/api/invoices/banks?${q}`).then((r) => r.json()),
        fetch(`/api/invoices/signatures?${q}`).then((r) => r.json()),
        fetch(`/api/invoices/numbering?${q}${issueDate ? `&date=${issueDate}` : ''}`).then((r) => r.json()),
      ]);
      setClients(cl?.clients ?? []);
      setBanks(bk?.banks ?? []);
      setSignatures(sg?.signatures ?? []);
      setPreviewNumber(nm?.preview || '');
      const n = nm?.numbering;
      setNumberingHint(n ? `${n.pattern} · ${n.prefix}` : '');
    } catch {}
  };

  useEffect(() => {
    const companyId = form.companyId || activeCompanyId;
    if (showForm && companyId) loadCatalog(companyId, form.issueDate);
  }, [showForm, form.companyId, form.issueDate, activeCompanyId]);

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

  const invoiceToForm = (inv: any, extras: Partial<InvoiceIssueForm> = {}): InvoiceIssueForm => ({
    ...EMPTY_FORM,
    companyId: inv.companyId || activeCompanyId || companies[0]?.id || '',
    type: inv.type || 'RECEIVABLE',
    clientId: inv.clientId || '',
    counterpartyName: inv.contactName || '',
    contactEmail: inv.contactEmail || '',
    contactPhone: inv.contactPhone || '',
    contactAddress: inv.contactAddress || '',
    contactExtra: inv.contactExtra || '',
    number: inv.number || '',
    numberMode: 'manual',
    issueDate: dateOnlyIso(inv.issueDate),
    dueDate: inv.dueDate ? dateOnlyIso(inv.dueDate) : '',
    currency: inv.currency || 'USD',
    altCurrency: inv.altCurrency || '',
    exchangeRate: inv.exchangeRate ? String(inv.exchangeRate) : '',
    exchangeRateDate: inv.exchangeRateDate ? dateOnlyIso(inv.exchangeRateDate) : '',
    exchangeRateSource: inv.exchangeRateSource || '',
    bankAccountId: inv.bankAccountId || '',
    signatureId: inv.signatureId || '',
    signatureImage: inv.signatureImage || '',
    taxRate: String(inv.taxRate ?? 0),
    notes: inv.notes || '',
    relatedInvoiceId: inv.relatedInvoiceId || '',
    items: (inv.items && inv.items.length > 0)
      ? inv.items.map((it: any) => ({ description: it.description || '', quantity: it.quantity || 1, unitPrice: it.unitPrice || 0 }))
      : [{ description: '', quantity: 1, unitPrice: 0 }],
    ...extras,
  });

  const openEdit = (inv: any) => {
    setEditingId(inv.id);
    setForm(invoiceToForm(inv, { numberMode: 'manual' }));
    setShowForm(true);
  };

  const openNote = (inv: any, noteType: 'CREDIT_NOTE' | 'DEBIT_NOTE') => {
    setEditingId(null);
    setForm(invoiceToForm(inv, {
      type: noteType,
      relatedInvoiceId: inv.id,
      number: '',
      numberMode: 'auto',
    }));
    setShowForm(true);
  };

  const createClient = async (draft: { name: string; email: string; phone: string; address: string; extra: string }) => {
    const companyId = form.companyId || activeCompanyId;
    if (!companyId || !draft.name.trim()) return;
    const res = await fetch('/api/clients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyId, ...draft }),
    });
    const d = await res.json();
    if (!d?.client) return;
    const party = clientToInvoiceParty(d.client);
    setClients((prev) => [...prev, d.client].sort((a, b) => String(a.name).localeCompare(String(b.name))));
    setForm({
      ...form,
      clientId: d.client.id,
      counterpartyName: party.contactName,
      contactEmail: party.contactEmail,
      contactPhone: party.contactPhone,
      contactAddress: party.contactAddress,
      contactExtra: party.contactExtra,
    });
  };

  const createBank = async (draft: { label: string; bankName: string; bankAddress: string; accountNumber: string; routingNumber: string }) => {
    const companyId = form.companyId || activeCompanyId;
    if (!companyId || !draft.bankName.trim()) return;
    const res = await fetch('/api/invoices/banks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyId, ...draft }),
    });
    const d = await res.json();
    if (!d?.bank) return;
    setBanks((prev) => [...prev, d.bank]);
    setForm({ ...form, bankAccountId: d.bank.id });
  };

  const createSignature = async () => {
    const companyId = form.companyId || activeCompanyId;
    if (!companyId || !form.signatureImage) return;
    const res = await fetch('/api/invoices/signatures', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        companyId,
        name: form.counterpartyName ? `Firma` : 'Firma',
        imageUrl: form.signatureImage,
      }),
    });
    const d = await res.json();
    if (!d?.signature) return;
    setSignatures((prev) => [...prev, d.signature]);
    setForm({ ...form, signatureId: d.signature.id, signatureImage: d.signature.imageUrl || form.signatureImage });
  };

  const handleSubmit = async () => {
    const compId = form.companyId || activeCompanyId || companies[0]?.id;
    if (!compId) return;
    const numberMode = editingId ? 'manual' : form.numberMode;
    const payload: any = {
      ...form,
      companyId: compId,
      numberMode,
      number: numberMode === 'auto' ? (previewNumber || form.number) : form.number,
      taxRate: parseFloat(form.taxRate) || 0,
      altCurrency: form.altCurrency || null,
      exchangeRate: parseFloat(form.exchangeRate) || null,
      exchangeRateDate: form.exchangeRateDate || null,
      exchangeRateSource: form.exchangeRateSource || null,
      clientId: form.clientId || null,
      bankAccountId: form.bankAccountId || null,
      signatureId: form.signatureId || null,
      signatureImage: form.signatureImage || null,
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

  const duplicateInvoice = async (inv: any, months = 1) => {
    setDuplicating(true);
    try {
      const res = await fetch('/api/invoices/duplicate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: inv.id, months }),
      });
      if (!res.ok) throw new Error('dup');
      setRepeatFor(null);
      setDetailInvoice(null);
      await fetchData();
    } catch {
      alert(L(ml('Could not duplicate', 'No se pudo duplicar', 'Não foi possível duplicar')));
    } finally {
      setDuplicating(false);
    }
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
        {activeCompanyId ? <InvoiceThemePanel companyId={activeCompanyId} locale={locale} /> : null}
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
                    <td className="px-4 py-3 text-right font-bold">
                      {formatMoney(inv.total, inv.currency)}
                      {inv.altCurrency && Number(inv.exchangeRate) > 0 ? (
                        <span className="block text-xs font-medium text-gray-500">{formatMoney(convertAmount(inv.total, inv.exchangeRate), inv.altCurrency)}</span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3"><span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${st.bg} ${st.color}`}>{st.label}</span></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => setDetailInvoice(inv)} className="p-1.5 rounded hover:bg-gray-100" title="Ver detalle"><Eye className="w-4 h-4" /></button>
                        <button onClick={() => openEdit(inv)} className="p-1.5 rounded hover:bg-teal-50 text-teal-600" title="Editar"><Pencil className="w-4 h-4" /></button>
                        <button onClick={() => duplicateInvoice(inv, 1)} disabled={duplicating} className="p-1.5 rounded hover:bg-indigo-50 text-indigo-600" title={L(ml('Duplicate next month','Duplicar al mes siguiente','Duplicar para o mês seguinte'))}><Copy className="w-4 h-4" /></button>
                        <button onClick={() => { setRepeatMonths('3'); setRepeatFor(inv); }} className="p-1.5 rounded hover:bg-indigo-50 text-indigo-600" title={L(ml('Repeat monthly','Repetir mensualmente','Repetir mensalmente'))}><CalendarPlus className="w-4 h-4" /></button>
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
                {detailInvoice.altCurrency && Number(detailInvoice.exchangeRate) > 0 ? (
                  <div className="text-xs text-gray-500">
                    {detailInvoice.altCurrency}: <b>{formatMoney(convertAmount(detailInvoice.total, detailInvoice.exchangeRate), detailInvoice.altCurrency)}</b>
                    <span className="ml-1">(1 {detailInvoice.currency} = {detailInvoice.exchangeRate} {detailInvoice.altCurrency})</span>
                  </div>
                ) : null}
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
              <button onClick={() => duplicateInvoice(detailInvoice, 1)} disabled={duplicating} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm flex items-center gap-2">
                <Copy className="w-4 h-4" /> {L(ml('Duplicate','Duplicar','Duplicar'))}
              </button>
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
          <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6">
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
                  {INVOICE_CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <InvoiceIssueFields
                form={form}
                setForm={setForm}
                locale={locale}
                clients={clients}
                banks={banks}
                signatures={signatures}
                previewNumber={previewNumber}
                numberingHint={numberingHint}
                onCreateClient={createClient}
                onCreateBank={createBank}
                onCreateSignature={createSignature}
                showNewClient={showNewClient}
                setShowNewClient={setShowNewClient}
                showNewBank={showNewBank}
                setShowNewBank={setShowNewBank}
              />
              {form.altCurrency && parseFloat(form.exchangeRate) > 0 ? (
                <p className="text-xs text-teal-700">{L(ml('The PDF will include two documents, one per currency.','El PDF incluirá dos documentos, uno por moneda.','O PDF incluirá dois documentos, um por moeda.'))}</p>
              ) : null}
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

      {repeatFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 dark:bg-gray-900">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-bold">{L(ml('Repeat monthly','Repetir mensualmente','Repetir mensalmente'))}</h3>
              <button type="button" onClick={() => setRepeatFor(null)}><X className="h-5 w-5" /></button>
            </div>
            <p className="mb-3 text-sm text-gray-600">
              {L(ml(
                `Create drafts from ${repeatFor.number}. Same amounts; dates and month names move forward.`,
                `Crea borradores a partir de ${repeatFor.number}. Mismos montos; fechas y meses avanzan.`,
                `Cria rascunhos a partir de ${repeatFor.number}. Os mesmos valores; datas e meses avançam.`,
              ))}
            </p>
            <label className="block text-xs text-gray-500 mb-1">{L(ml('How many extra months?','¿Cuántos meses extra?','Quantos meses extra?'))}</label>
            <input className="mb-4 w-full rounded-lg border px-3 py-2 text-sm" type="number" min="1" max="24" value={repeatMonths} onChange={(e) => setRepeatMonths(e.target.value)} />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setRepeatFor(null)} className="rounded-lg border px-4 py-2 text-sm">{L(ml('Cancel','Cancelar','Cancelar'))}</button>
              <button
                type="button"
                disabled={duplicating}
                onClick={() => duplicateInvoice(repeatFor, parseInt(repeatMonths, 10) || 1)}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white"
              >
                {duplicating ? '…' : L(ml('Create drafts','Crear borradores','Criar rascunhos'))}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
