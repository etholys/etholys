'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import dynamic from 'next/dynamic';
import { useApp } from '@/app/providers';
import {
  DollarSign, TrendingUp, TrendingDown, Plus, Trash2,
  ArrowUpRight, ArrowDownRight, RefreshCw, PieChart, BarChart3,
  Building2, FolderKanban, Tag, Download, X, Search,
  Pencil, CheckSquare, Square, CalendarClock, Repeat, Eye, EyeOff,
  Clock, CheckCircle2, PlusCircle, Upload, FileText, Loader2, Wallet
} from 'lucide-react';

const BudgetPlanning = dynamic(() => import('@/components/finance/BudgetPlanning'), { ssr: false, loading: () => <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-teal-600" /></div> });

type ML = { es: string; pt: string; en: string };
const ml = (en: string, es: string, pt: string): ML => ({ en, es, pt });

const TYPE_CONFIG: Record<string, { labels: ML; icon: any; color: string; bg: string }> = {
  INCOME: { labels: ml('Income', 'Ingreso', 'Receita'), icon: ArrowUpRight, color: 'text-emerald-600', bg: 'bg-emerald-50' },
  EXPENSE: { labels: ml('Expense', 'Gasto', 'Despesa'), icon: ArrowDownRight, color: 'text-red-500', bg: 'bg-red-50' },
  TRANSFER_IN: { labels: ml('Transfer in', 'Transferencia entrada', 'Transferência entrada'), icon: RefreshCw, color: 'text-blue-500', bg: 'bg-blue-50' },
  TRANSFER_OUT: { labels: ml('Transfer out', 'Transferencia salida', 'Transferência saída'), icon: RefreshCw, color: 'text-amber-600', bg: 'bg-amber-50' },
};

const EXEC_STATUS: Record<string, { labels: ML; icon: any; color: string; bg: string }> = {
  FORECAST: { labels: ml('Forecast', 'Previsto', 'Previsto'), icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50' },
  EXECUTED: { labels: ml('Executed', 'Ejecutado', 'Executado'), icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50' },
};

function formatMoney(amount: number, currency: string = 'USD') {
  return new Intl.NumberFormat('es-UY', { style: 'currency', currency, minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(amount);
}

const EMPTY_FORM = {
  companyId: '', projectId: '', type: 'EXPENSE' as string,
  amount: '', currency: 'USD', title: '', description: '', category: '',
  date: '', accrualDate: '', isRecurring: false, recurrenceMonths: '1', recurrenceCount: '1',
  note: '', receiptUrl: '', allocationPct: '100',
  /** false = EXECUTED (default on Execution tab); true = FORECAST only */
  forecastOnly: false,
};


export default function FinancePage() {
  const { activeCompanyId, locale } = useApp();
  const L = (m: ML) => m[locale] || m.en;
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const budgetItemIdFromUrl = searchParams.get('budgetItemId');
  const initialTab =
    budgetItemIdFromUrl ? 'execution' : searchParams.get('tab') === 'planning' ? 'planning' : 'execution';
  const [activeTab, setActiveTab] = useState<'execution' | 'planning'>(initialTab);
  const [filterBudgetItemId, setFilterBudgetItemId] = useState<string | null>(budgetItemIdFromUrl);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  /** Snapshot when opening edit — only send executionStatus on PUT if user toggled forecast */
  const editOpenedForecastOnly = useRef<boolean | null>(null);
  const [filterType, setFilterType] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterCompany, setFilterCompany] = useState('');
  const [filterExecStatus, setFilterExecStatus] = useState('');
  const [searchText, setSearchText] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [view, setView] = useState<'list' | 'summary' | 'dre' | 'cashflow'>('list');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [batchCat, setBatchCat] = useState('');

  const [filterOrigin, setFilterOrigin] = useState('');
  const [filterCurrency, setFilterCurrency] = useState('');
  /** When false (default), rows with scope PROJECT_ONLY stay hidden — not shown in the filter bar (SIEP-only). */
  const [showProjectOnlyTx, setShowProjectOnlyTx] = useState(false);
  const [cfCurrency, setCfCurrency] = useState('ALL'); // multi-currency cashflow filter

  // Payment modal state
  const [paymentModal, setPaymentModal] = useState<{ id: string; title: string } | null>(null);
  const [paymentDate, setPaymentDate] = useState('');

  // Import modal state
  const [showImport, setShowImport] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [importPreview, setImportPreview] = useState<any[] | null>(null);
  const [importSummary, setImportSummary] = useState('');
  const [importFileName, setImportFileName] = useState('');

  // Dynamic categories
  const [customCategories, setCustomCategories] = useState<any[]>([]);
  const [defaultCategories, setDefaultCategories] = useState<string[]>([]);
  const [newCatName, setNewCatName] = useState('');
  const [showNewCat, setShowNewCat] = useState(false);

  const allCategories = useMemo(() => {
    const custom = customCategories.map(c => c.name);
    const merged = [...new Set([...defaultCategories, ...custom])];
    return merged.sort();
  }, [customCategories, defaultCategories]);

  const projectOnlyHiddenCount = useMemo(
    () => transactions.filter((tx: any) => tx.scope === 'PROJECT_ONLY').length,
    [transactions]
  );

  const txCurrencies = useMemo(() => {
    const codes = new Set<string>();
    transactions.forEach((tx: any) => {
      codes.add(tx.currency || 'USD');
    });
    return Array.from(codes).sort((a, b) => a.localeCompare(b));
  }, [transactions]);

  const fetchCategories = useCallback(async () => {
    try {
      const res = await fetch(`/api/transaction-categories${activeCompanyId ? `?companyId=${activeCompanyId}` : ''}`);
      const data = await res.json();
      setCustomCategories(data?.categories ?? []);
      setDefaultCategories(data?.defaults ?? []);
    } catch {}
  }, [activeCompanyId]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const txParams = new URLSearchParams();
      if (activeCompanyId) txParams.set('companyId', activeCompanyId);
      if (filterBudgetItemId) txParams.set('companyBudgetItemId', filterBudgetItemId);
      const txQuery = txParams.toString();
      const [txRes, compRes, projRes] = await Promise.all([
        fetch(`/api/transactions${txQuery ? `?${txQuery}` : ''}`),
        fetch('/api/companies'),
        fetch('/api/projects'),
      ]);
      const txData = await txRes.json();
      const compData = await compRes.json();
      const projData = await projRes.json();
      setTransactions(txData?.transactions ?? []);
      setCompanies(compData?.companies ?? []);
      setProjects(projData?.projects ?? []);
    } catch { /* ignore */ }
    setLoading(false);
  }, [activeCompanyId, filterBudgetItemId]);

  const lastBudgetItemParam = useRef<string | null>(null);

  useEffect(() => {
    const b = searchParams.get('budgetItemId');
    setFilterBudgetItemId(b);
    if (b && lastBudgetItemParam.current !== b) setActiveTab('execution');
    lastBudgetItemParam.current = b;
  }, [searchParams]);

  useEffect(() => { fetchData(); fetchCategories(); }, [activeCompanyId, fetchData, fetchCategories]);

  const addCategory = async () => {
    if (!newCatName.trim()) return;
    const compId = activeCompanyId || companies[0]?.id;
    if (!compId) return;
    await fetch('/api/transaction-categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyId: compId, name: newCatName.trim() }),
    });
    setNewCatName('');
    setShowNewCat(false);
    fetchCategories();
  };

  const clearBudgetItemFilter = useCallback(() => {
    setFilterBudgetItemId(null);
    const p = new URLSearchParams(searchParams.toString());
    p.delete('budgetItemId');
    const q = p.toString();
    router.replace(q ? `${pathname}?${q}` : pathname);
  }, [pathname, router, searchParams]);

  const filtered = useMemo(() => {
    return transactions.filter(tx => {
      if (!showProjectOnlyTx && tx.scope === 'PROJECT_ONLY') return false;
      if (filterBudgetItemId && tx.companyBudgetItemId !== filterBudgetItemId) return false;
      if (filterType && tx.type !== filterType) return false;
      if (filterCategory && tx.category !== filterCategory) return false;
      if (filterCompany && tx.companyId !== filterCompany) return false;
      if (filterExecStatus && tx.executionStatus !== filterExecStatus) return false;
      if (filterOrigin === 'INTERNAL' && tx.projectId) return false;
      if (filterOrigin === 'PROJECT' && !tx.projectId) return false;
      if (filterCurrency && (tx.currency || 'USD') !== filterCurrency) return false;
      if (searchText) {
        const q = searchText.toLowerCase();
        const matchTitle = tx.title?.toLowerCase().includes(q);
        const matchDesc = tx.description?.toLowerCase().includes(q);
        if (!matchTitle && !matchDesc) return false;
      }
      if (dateFrom && new Date(tx.date) < new Date(dateFrom)) return false;
      if (dateTo && new Date(tx.date) > new Date(dateTo + 'T23:59:59')) return false;
      return true;
    });
  }, [transactions, showProjectOnlyTx, filterBudgetItemId, filterType, filterCategory, filterCompany, filterExecStatus, filterOrigin, filterCurrency, searchText, dateFrom, dateTo]);

  // Group totals by currency so multi-currency transactions are not mixed
  const totalsByCurrency = useMemo(() => {
    const map: Record<string, { income: number; expense: number; fIncome: number; fExpense: number }> = {};
    filtered.forEach(t => {
      const cur = t.currency || 'USD';
      if (!map[cur]) map[cur] = { income: 0, expense: 0, fIncome: 0, fExpense: 0 };
      const isIncome = t.type === 'INCOME' || t.type === 'TRANSFER_IN';
      const isForecast = t.executionStatus === 'FORECAST';
      if (isIncome) {
        map[cur].income += t.amount;
        if (isForecast) map[cur].fIncome += t.amount;
      } else {
        map[cur].expense += t.amount;
        if (isForecast) map[cur].fExpense += t.amount;
      }
    });
    return Object.entries(map).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered]);

  // Legacy single-value totals for charts/summaries (sum all currencies naively)
  const totals = useMemo(() => {
    const income = filtered.filter(t => t.type === 'INCOME' || t.type === 'TRANSFER_IN').reduce((s, t) => s + t.amount, 0);
    const expense = filtered.filter(t => t.type === 'EXPENSE' || t.type === 'TRANSFER_OUT').reduce((s, t) => s + t.amount, 0);
    return { income, expense, balance: income - expense };
  }, [filtered]);

  // Forecast vs executed totals
  const forecastTotals = useMemo(() => {
    const forecast = filtered.filter(t => t.executionStatus === 'FORECAST');
    const executed = filtered.filter(t => t.executionStatus !== 'FORECAST');
    const fIncome = forecast.filter(t => t.type === 'INCOME' || t.type === 'TRANSFER_IN').reduce((s, t) => s + t.amount, 0);
    const fExpense = forecast.filter(t => t.type === 'EXPENSE' || t.type === 'TRANSFER_OUT').reduce((s, t) => s + t.amount, 0);
    const eIncome = executed.filter(t => t.type === 'INCOME' || t.type === 'TRANSFER_IN').reduce((s, t) => s + t.amount, 0);
    const eExpense = executed.filter(t => t.type === 'EXPENSE' || t.type === 'TRANSFER_OUT').reduce((s, t) => s + t.amount, 0);
    return { fIncome, fExpense, eIncome, eExpense };
  }, [filtered]);

  const categoryBreakdown = useMemo(() => {
    const map: Record<string, number> = {};
    filtered.filter(t => t.type === 'EXPENSE' || t.type === 'TRANSFER_OUT').forEach(t => {
      const cat = t.category || 'Sin categoría';
      map[cat] = (map[cat] || 0) + t.amount;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [filtered]);

  const monthlyData = useMemo(() => {
    const map: Record<string, { income: number; expense: number }> = {};
    filtered.forEach(t => {
      const month = new Date(t.date).toISOString().slice(0, 7);
      if (!map[month]) map[month] = { income: 0, expense: 0 };
      if (t.type === 'INCOME' || t.type === 'TRANSFER_IN') map[month].income += t.amount;
      else map[month].expense += t.amount;
    });
    return Object.entries(map).sort((a, b) => a[0].localeCompare(b[0])).slice(-12);
  }, [filtered]);

  /* ---- form helpers ---- */
  const openNew = () => {
    setEditingId(null);
    editOpenedForecastOnly.current = null;
    setForm({ ...EMPTY_FORM, companyId: activeCompanyId || companies[0]?.id || '', forecastOnly: false });
    setShowForm(true);
  };

  const openEdit = (tx: any) => {
    setEditingId(tx.id);
    editOpenedForecastOnly.current = tx.executionStatus === 'FORECAST';
    setForm({
      companyId: tx.companyId || '',
      projectId: tx.projectId || '',
      type: tx.type,
      amount: String(tx.amount),
      currency: tx.currency || 'USD',
      title: tx.title || '',
      description: tx.description || '',
      category: tx.category || '',
      date: tx.date ? new Date(tx.date).toISOString().slice(0, 10) : '',
      accrualDate: tx.accrualDate ? new Date(tx.accrualDate).toISOString().slice(0, 10) : '',
      isRecurring: tx.isRecurring || false,
      recurrenceMonths: tx.recurrenceMonths ? String(tx.recurrenceMonths) : '1',
      recurrenceCount: '1',
      note: tx.note || '',
      receiptUrl: tx.receiptUrl || '',
      allocationPct: tx.allocationPct != null ? String(tx.allocationPct) : '100',
      forecastOnly: tx.executionStatus === 'FORECAST',
    });
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent, keepOpen = false) => {
    e.preventDefault();
    const compId = form.companyId || companies[0]?.id;
    const amt = parseFloat(String(form.amount));
    if (!compId) {
      alert(L(ml('Select a company.', 'Selecciona una empresa.', 'Selecione uma empresa.')));
      return;
    }
    if (form.amount === '' || Number.isNaN(amt) || amt < 0) {
      alert(L(ml('Enter a valid amount.', 'Introduce un monto válido.', 'Informe um valor válido.')));
      return;
    }
    const payload: any = {
      companyId: compId,
      projectId: form.projectId || null,
      type: form.type,
      amount: amt,
      currency: form.currency,
      title: form.title || null,
      description: form.description || null,
      category: form.category || null,
      date: form.date || new Date().toISOString(),
      accrualDate: form.accrualDate || null,
      note: form.note || null,
      receiptUrl: form.receiptUrl || null,
      origin: form.projectId ? 'PROJECT' : 'INTERNAL',
      allocationPct: form.projectId ? (parseInt(form.allocationPct) || 100) : 100,
      isRecurring: form.isRecurring,
      recurrenceMonths: form.isRecurring ? parseInt(form.recurrenceMonths) || 1 : null,
      recurrenceCount: form.isRecurring ? parseInt(form.recurrenceCount) || 1 : null,
    };
    if (editingId) {
      payload.id = editingId;
      const opened = editOpenedForecastOnly.current;
      if (opened !== null && form.forecastOnly !== opened) {
        payload.executionStatus = form.forecastOnly ? 'FORECAST' : 'EXECUTED';
      }
    } else {
      payload.registerAsExecuted = !form.forecastOnly;
    }
    const res = await fetch('/api/transactions', {
      method: editingId ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    let data: any = {};
    try { data = await res.json(); } catch { /* ignore */ }
    if (!res.ok) {
      alert(data.error || L(ml('Could not save.', 'No se pudo guardar.', 'Não foi possível salvar.')));
      return;
    }
    if (keepOpen && !editingId) {
      setForm({
        ...EMPTY_FORM,
        companyId: compId,
        currency: form.currency,
        category: form.category,
        date: form.date,
        projectId: form.projectId,
        allocationPct: form.allocationPct,
        forecastOnly: form.forecastOnly,
      });
    } else {
      setShowForm(false);
      setEditingId(null);
      editOpenedForecastOnly.current = null;
      setForm({ ...EMPTY_FORM });
    }
    fetchData();
  };

  // Import handlers
  const handleImportFile = async (file: File) => {
    setImportLoading(true);
    setImportPreview(null);
    setImportSummary('');
    setImportFileName(file.name);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/transactions/import', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Import failed');
      setImportPreview(data.transactions || []);
      setImportSummary(data.summary || '');
    } catch (err: any) {
      alert(err.message || 'Error importing file');
    }
    setImportLoading(false);
  };

  const confirmImport = async () => {
    if (!importPreview || importPreview.length === 0) return;
    const compId = activeCompanyId || companies[0]?.id;
    if (!compId) { alert('No hay empresa seleccionada. Selecciona una empresa primero.'); return; }
    setImportLoading(true);
    try {
      const items = importPreview.map(t => ({
        companyId: compId,
        type: t.type,
        amount: t.amount,
        currency: t.currency,
        title: t.title,
        description: t.description,
        category: t.category,
        date: t.date ? new Date(t.date).toISOString() : new Date().toISOString(),
        registerAsExecuted: true,
      }));
      const res = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al importar');
      const count = data.created?.length ?? data.transaction ? 1 : items.length;
      setShowImport(false);
      setImportPreview(null);
      setImportSummary('');
      setImportFileName('');
      fetchData();
    } catch (err: any) {
      alert(err.message || 'Error al importar transacciones');
    } finally {
      setImportLoading(false);
    }
  };

  const removeImportRow = (idx: number) => {
    if (!importPreview) return;
    setImportPreview(importPreview.filter((_, i) => i !== idx));
  };

  const updateImportRow = (idx: number, field: string, value: any) => {
    if (!importPreview) return;
    const copy = [...importPreview];
    copy[idx] = { ...copy[idx], [field]: value };
    setImportPreview(copy);
  };

  const handleDelete = async (id: string) => {
    if (!confirm(L(ml('Delete this transaction?','¿Eliminar esta transacción?','Excluir esta transação?')))) return;
    await fetch(`/api/transactions?id=${id}`, { method: 'DELETE' });
    fetchData();
  };

  const openPaymentModal = (tx: any) => {
    setPaymentModal({ id: tx.id, title: tx.title || tx.description || L(TYPE_CONFIG[tx.type]?.labels || ml('','','')) || 'Transacción' });
    setPaymentDate(new Date().toISOString().slice(0, 10));
  };

  const confirmPayment = async () => {
    if (!paymentModal || !paymentDate) return;
    await fetch('/api/transactions', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: paymentModal.id, executionStatus: 'EXECUTED', executedDate: paymentDate }),
    });
    setPaymentModal(null);
    setPaymentDate('');
    fetchData();
  };

  const revertToForecast = async (id: string) => {
    if (!confirm(L(ml('Cancel payment and revert to Forecast?','¿Anular el pago y volver a estado Previsto?','Cancelar pagamento e voltar ao estado Previsto?')))) return;
    await fetch('/api/transactions', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, executionStatus: 'FORECAST', executedDate: null }),
    });
    fetchData();
  };

  /* ---- batch operations ---- */
  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map(t => t.id)));
  };

  const batchDelete = async () => {
    if (selected.size === 0) return;
    if (!confirm(`${L(ml('Delete','¿Eliminar','Excluir'))} ${selected.size} ${L(ml('transaction(s)?','transacción(es)?','transação(ões)?'))}`)) return;
    await fetch(`/api/transactions?ids=${Array.from(selected).join(',')}`, { method: 'DELETE' });
    setSelected(new Set());
    fetchData();
  };

  const batchEditCategory = async () => {
    if (selected.size === 0 || !batchCat) return;
    const items = Array.from(selected).map(id => ({ id, category: batchCat }));
    await fetch('/api/transactions', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items }) });
    setSelected(new Set());
    setBatchCat('');
    fetchData();
  };

  // Batch payment modal
  const [batchPaymentModal, setBatchPaymentModal] = useState(false);
  const [batchPaymentDate, setBatchPaymentDate] = useState('');

  const openBatchPayment = () => {
    setBatchPaymentDate(new Date().toISOString().slice(0, 10));
    setBatchPaymentModal(true);
  };

  const confirmBatchPayment = async () => {
    if (selected.size === 0 || !batchPaymentDate) return;
    const items = Array.from(selected).map(id => ({ id, executionStatus: 'EXECUTED', executedDate: batchPaymentDate }));
    await fetch('/api/transactions', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items }) });
    setSelected(new Set());
    setBatchPaymentModal(false);
    setBatchPaymentDate('');
    fetchData();
  };

  const exportCSV = () => {
    const header = 'Fecha Prevista,Fecha Pago,Competencia,Tipo,Estado,Título,Categoría,Descripción,Monto,Moneda,Empresa,Proyecto,Recurrente\n';
    const rows = filtered.map(t =>
      `${new Date(t.date).toLocaleDateString('es-UY')},${t.executedDate ? new Date(t.executedDate).toLocaleDateString('es-UY') : ''},${t.accrualDate ? new Date(t.accrualDate).toLocaleDateString('es-UY') : ''},${TYPE_CONFIG[t.type]?.labels || t.type},${L(EXEC_STATUS[t.executionStatus]?.labels || ml('','','')) || t.executionStatus},"${t.title || ''}",${t.category || ''},"${t.description || ''}",${t.amount},${t.currency},"${t.company?.shortName || ''}","${t.project?.name || ''}",${t.isRecurring ? 'Sí' : 'No'}`
    ).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `finanzas_${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const maxBar = monthlyData.reduce((m, [, d]) => Math.max(m, d.income, d.expense), 1);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{L(ml('Financial Management','Gestión Financiera','Gestão Financeira'))}</h1>
          <p className="text-gray-500 text-sm">{L(ml('Planning and execution in one place','Planificación y ejecución en un solo lugar','Planejamento e execução em um só lugar'))}</p>
        </div>
      </div>

      {/* Tab navigation */}
      <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        <button onClick={() => setActiveTab('execution')}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition ${activeTab === 'execution' ? 'bg-white text-teal-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
          <DollarSign className="w-4 h-4" />{L(ml('Execution','Ejecución','Execução'))}
        </button>
        <button onClick={() => setActiveTab('planning')}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition ${activeTab === 'planning' ? 'bg-white text-teal-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
          <Wallet className="w-4 h-4" />{L(ml('Planning','Planificación','Planejamento'))}
        </button>
      </div>

      {/* Planning tab */}
      {activeTab === 'planning' && <BudgetPlanning />}

      {/* Execution tab */}
      {activeTab === 'execution' && <>

      {filterBudgetItemId && (
        <div className="rounded-xl border border-teal-200 bg-teal-50/90 px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-sm text-teal-900">
          <span>
            {L(ml(
              'Showing movements linked to this planning item only.',
              'Mostrando solo movimientos vinculados a este ítem de planificación.',
              'Mostrando apenas movimentos vinculados a este item de planejamento.',
            ))}
          </span>
          <button
            type="button"
            onClick={clearBudgetItemFilter}
            className="inline-flex items-center gap-1.5 rounded-lg border border-teal-300 bg-white px-3 py-1.5 text-xs font-medium text-teal-800 hover:bg-teal-50"
          >
            <X className="w-3.5 h-3.5" />
            {L(ml('Clear planning filter', 'Quitar filtro de planificación', 'Limpar filtro do planejamento'))}
          </button>
        </div>
      )}

      {/* Compact summary + actions bar */}
      <div className="bg-white rounded-xl shadow-sm p-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* Inline KPIs */}
          <div className="flex items-center gap-6 flex-wrap">
            <div className="flex items-center gap-2">
              <div className="w-2 h-8 rounded-full bg-emerald-500" />
              <div>
                <p className="text-[10px] text-gray-400 uppercase tracking-wider">{L(ml('Income','Ingresos','Receitas'))}</p>
                {totalsByCurrency.length === 0 && <p className="text-lg font-bold text-emerald-600 tabular-nums font-mono">{formatMoney(0)}</p>}
                {totalsByCurrency.map(([cur, d]) => (
                  <p key={cur} className="text-lg font-bold text-emerald-600 tabular-nums font-mono leading-tight">{formatMoney(d.income, cur)}</p>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-8 rounded-full bg-red-400" />
              <div>
                <p className="text-[10px] text-gray-400 uppercase tracking-wider">{L(ml('Expenses','Gastos','Despesas'))}</p>
                {totalsByCurrency.length === 0 && <p className="text-lg font-bold text-red-500 tabular-nums font-mono">{formatMoney(0)}</p>}
                {totalsByCurrency.map(([cur, d]) => (
                  <p key={cur} className="text-lg font-bold text-red-500 tabular-nums font-mono leading-tight">{formatMoney(d.expense, cur)}</p>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className={`w-2 h-8 rounded-full ${totals.balance >= 0 ? 'bg-blue-500' : 'bg-amber-500'}`} />
              <div>
                <p className="text-[10px] text-gray-400 uppercase tracking-wider">{L(ml('Balance','Balance','Saldo'))}</p>
                {totalsByCurrency.length === 0 && <p className="text-lg font-bold text-blue-600 tabular-nums font-mono">{formatMoney(0)}</p>}
                {totalsByCurrency.map(([cur, d]) => {
                  const bal = d.income - d.expense;
                  return <p key={cur} className={`text-lg font-bold tabular-nums font-mono leading-tight ${bal >= 0 ? 'text-blue-600' : 'text-amber-600'}`}>{formatMoney(bal, cur)}</p>;
                })}
              </div>
            </div>
          </div>
          {/* Actions */}
          <div className="flex items-center gap-2">
            <button onClick={() => { setShowImport(true); setImportPreview(null); setImportSummary(''); setImportFileName(''); }} className="flex items-center gap-1.5 px-3 py-2 text-sm bg-white border rounded-lg hover:bg-gray-50 transition text-gray-600">
              <Upload className="w-3.5 h-3.5" />{L(ml('Import','Importar','Importar'))}
            </button>
            <button onClick={exportCSV} className="flex items-center gap-1.5 px-3 py-2 text-sm bg-white border rounded-lg hover:bg-gray-50 transition text-gray-600">
              <Download className="w-3.5 h-3.5" />
            </button>
            <button onClick={openNew} className="flex items-center gap-1.5 px-4 py-2 text-sm bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition">
              <Plus className="w-4 h-4" />{L(ml('New','Nueva','Nova'))}
            </button>
          </div>
        </div>
      </div>

      {projectOnlyHiddenCount > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/90 px-4 py-3 text-sm text-amber-900 flex flex-wrap items-center gap-3">
          <span>
            {L(ml(
              `${projectOnlyHiddenCount} transaction(s) are hidden (marked “project only” / SIEP). Totals and the list below exclude them unless you enable the option.`,
              `${projectOnlyHiddenCount} transacción(es) ocultas (alcance “solo proyecto” / SIEP). Los totales y la lista no las incluyen salvo que actives la opción.`,
              `${projectOnlyHiddenCount} transação(ões) ocultas (âmbito “somente projeto” / SIEP). Os totais e a lista não as incluem exceto se ativar a opção.`,
            ))}
          </span>
          <label className="inline-flex items-center gap-2 cursor-pointer font-medium text-amber-950 whitespace-nowrap">
            <input
              type="checkbox"
              checked={showProjectOnlyTx}
              onChange={e => setShowProjectOnlyTx(e.target.checked)}
              className="rounded border-amber-400 text-teal-600 focus:ring-teal-500"
            />
            {L(ml('Show SIEP / project-only movements', 'Mostrar movimientos solo-proyecto (SIEP)', 'Mostrar movimentos só-projeto (SIEP)'))}
          </label>
        </div>
      )}

      {/* View tabs + inline filters */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5">
          {([['list', L(ml('Transactions','Transacciones','Transações')), BarChart3], ['summary', L(ml('Summary','Resumen','Resumo')), PieChart], ['dre', L(ml('P&L','PyG','DRE')), TrendingUp], ['cashflow', L(ml('Cash Flow','Flujo Caja','Fluxo Caixa')), DollarSign]] as const).map(([key, label, Icon]) => (
            <button key={key} onClick={() => setView(key as any)} className={`px-3 py-1.5 text-xs rounded-md font-medium transition flex items-center gap-1.5 ${view === key ? 'bg-white text-teal-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
              <Icon className="w-3 h-3" />{label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input value={searchText} onChange={e => setSearchText(e.target.value)} placeholder={L(ml("Search...","Buscar...","Buscar..."))} className="pl-8 pr-3 py-1.5 rounded-lg border text-xs w-44" />
          </div>
          <select value={filterType} onChange={e => setFilterType(e.target.value)} className="px-2 py-1.5 rounded-lg border text-xs">
            <option value="">{L(ml('All types','Todos','Todos'))}</option>
            {Object.entries(TYPE_CONFIG).map(([k, v]) => <option key={k} value={k}>{L(v.labels)}</option>)}
          </select>
          <select value={filterExecStatus} onChange={e => setFilterExecStatus(e.target.value)} className="px-2 py-1.5 rounded-lg border text-xs">
            <option value="">{L(ml('All status','Todo estado','Todo status'))}</option>
            <option value="FORECAST">{L(ml('Forecast','Previsto','Previsto'))}</option>
            <option value="EXECUTED">{L(ml('Executed','Ejecutado','Executado'))}</option>
          </select>
          <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} className="px-2 py-1.5 rounded-lg border text-xs">
            <option value="">{L(ml('Category','Categoría','Categoria'))}</option>
            {allCategories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={filterCurrency} onChange={e => setFilterCurrency(e.target.value)} className="px-2 py-1.5 rounded-lg border text-xs min-w-[5.5rem]" title={L(ml('Currency','Moneda','Moeda'))}>
            <option value="">{L(ml('All currencies','Todas las monedas','Todas as moedas'))}</option>
            {txCurrencies.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={filterOrigin} onChange={e => setFilterOrigin(e.target.value)} className="px-2 py-1.5 rounded-lg border text-xs">
            <option value="">{L(ml('Origin','Origen','Origem'))}</option>
            <option value="INTERNAL">{L(ml('Internal','Interno','Interno'))}</option>
            <option value="PROJECT">{L(ml('Project','Proyecto','Projeto'))}</option>
          </select>
          {companies.length > 1 && (
            <select value={filterCompany} onChange={e => setFilterCompany(e.target.value)} className="px-2 py-1.5 rounded-lg border text-xs">
              <option value="">{L(ml('Company','Empresa','Empresa'))}</option>
              {companies.map((c: any) => <option key={c.id} value={c.id}>{c.shortName}</option>)}
            </select>
          )}
          <select defaultValue="" onChange={e => {
            const v = e.target.value;
            const now = new Date();
            const y = now.getFullYear(), m = now.getMonth();
            if (v === 'this_month') { setDateFrom(`${y}-${String(m+1).padStart(2,'0')}-01`); setDateTo(`${y}-${String(m+1).padStart(2,'0')}-${new Date(y, m+1, 0).getDate()}`); }
            else if (v === 'last_month') { const pm = m === 0 ? 11 : m - 1; const py = m === 0 ? y - 1 : y; setDateFrom(`${py}-${String(pm+1).padStart(2,'0')}-01`); setDateTo(`${py}-${String(pm+1).padStart(2,'0')}-${new Date(py, pm+1, 0).getDate()}`); }
            else if (v === 'this_year') { setDateFrom(`${y}-01-01`); setDateTo(`${y}-12-31`); }
            else if (v === 'last_year') { setDateFrom(`${y-1}-01-01`); setDateTo(`${y-1}-12-31`); }
            else if (v === 'last_30') { const d = new Date(now); d.setDate(d.getDate()-30); setDateFrom(d.toISOString().slice(0,10)); setDateTo(now.toISOString().slice(0,10)); }
            else if (v === 'last_90') { const d = new Date(now); d.setDate(d.getDate()-90); setDateFrom(d.toISOString().slice(0,10)); setDateTo(now.toISOString().slice(0,10)); }
            else if (v === 'this_quarter') { const qs = Math.floor(m/3)*3; setDateFrom(`${y}-${String(qs+1).padStart(2,'0')}-01`); setDateTo(`${y}-${String(qs+3).padStart(2,'0')}-${new Date(y, qs+3, 0).getDate()}`); }
            e.target.value = '';
          }} className="px-2 py-1.5 rounded-lg border text-xs text-gray-400">
            <option value="">{L(ml('Period','Período','Período'))}</option>
            <option value="this_month">{L(ml('This month','Este mes','Este mês'))}</option>
            <option value="last_month">{L(ml('Last month','Mes pasado','Mês passado'))}</option>
            <option value="this_quarter">{L(ml('This quarter','Trimestre','Trimestre'))}</option>
            <option value="this_year">{L(ml('This year','Este año','Este ano'))}</option>
            <option value="last_year">{L(ml('Last year','Año pasado','Ano passado'))}</option>
            <option value="last_30">{L(ml('30 days','30 días','30 dias'))}</option>
            <option value="last_90">{L(ml('90 days','90 días','90 dias'))}</option>
          </select>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="px-2 py-1.5 rounded-lg border text-xs" />
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="px-2 py-1.5 rounded-lg border text-xs" />
          {(filterType || filterCategory || filterCompany || filterExecStatus || filterOrigin || filterCurrency || searchText || dateFrom || dateTo || filterBudgetItemId) && (
            <button
              onClick={() => {
                setFilterType('');
                setFilterCategory('');
                setFilterCompany('');
                setFilterExecStatus('');
                setFilterOrigin('');
                setFilterCurrency('');
                setSearchText('');
                setDateFrom('');
                setDateTo('');
                clearBudgetItemFilter();
              }}
              className="p-1 text-gray-400 hover:text-red-500"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Batch actions bar */}
      {selected.size > 0 && view === 'list' && (
        <div className="bg-teal-50 border border-teal-200 rounded-xl p-3 space-y-2">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-medium text-teal-800">{selected.size} {L(ml('selected','seleccionado(s)','selecionado(s)'))}</span>
            <button onClick={openBatchPayment} className="flex items-center gap-1 px-3 py-1.5 text-xs bg-emerald-600 text-white rounded-lg hover:bg-emerald-700">
              <CheckCircle2 className="w-3 h-3" />{L(ml('Pay selected','Pagar selección','Pagar seleção'))}
            </button>
            <button onClick={batchDelete} className="flex items-center gap-1 px-3 py-1.5 text-xs bg-red-600 text-white rounded-lg hover:bg-red-700">
              <Trash2 className="w-3 h-3" />{L(ml('Delete','Eliminar','Excluir'))}
            </button>
            <button onClick={() => setSelected(new Set())} className="ml-auto text-xs text-teal-600 hover:underline">{L(ml('Deselect','Deseleccionar','Desmarcar'))}</button>
          </div>
          <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-teal-200">
            <span className="text-[10px] text-teal-700 uppercase font-medium">{L(ml('Batch edit:','Editar lote:','Editar lote:'))}</span>
            <select value={batchCat} onChange={e => setBatchCat(e.target.value)} className="px-2 py-1 rounded border text-xs bg-white">
              <option value="">{L(ml('Category...','Categoría...','Categoria...'))}</option>
              {allCategories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            {batchCat && <button onClick={batchEditCategory} className="px-2 py-1 text-[10px] bg-teal-600 text-white rounded hover:bg-teal-700">{L(ml('Apply','Aplicar','Aplicar'))}</button>}
            <select defaultValue="" onChange={async e => {
              if (!e.target.value) return;
              const items = Array.from(selected).map(id => ({ id, type: e.target.value }));
              await fetch('/api/transactions', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items }) });
              setSelected(new Set()); fetchData(); e.target.value = '';
            }} className="px-2 py-1 rounded border text-xs bg-white">
              <option value="">Tipo...</option>
              {Object.entries(TYPE_CONFIG).map(([k, v]) => <option key={k} value={k}>{L(v.labels)}</option>)}
            </select>
            {companies.length > 1 && (
              <select defaultValue="" onChange={async e => {
                if (!e.target.value) return;
                const items = Array.from(selected).map(id => ({ id, companyId: e.target.value }));
                await fetch('/api/transactions', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items }) });
                setSelected(new Set()); fetchData(); e.target.value = '';
              }} className="px-2 py-1 rounded border text-xs bg-white">
                <option value="">{L(ml('Company...','Empresa...','Empresa...'))}</option>
                {companies.map((c: any) => <option key={c.id} value={c.id}>{c.shortName}</option>)}
              </select>
            )}
          </div>
        </div>
      )}

      {/* LIST VIEW */}
      {view === 'list' && (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-gray-400">{L(ml('Loading transactions...','Cargando transacciones...','Carregando transações...'))}</div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-gray-400">
              <DollarSign className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p className="font-medium">{L(ml('No transactions','Sin transacciones','Sem transações'))}</p>
              <p className="text-sm mt-1">{L(ml('Record income and expenses for financial tracking.','Registra ingresos y gastos para llevar el control financiero.','Registre receitas e gastos para acompanhamento financeiro.'))}</p>
            </div>
          ) : (
            <>
              {/* Select all header */}
              <div className="flex items-center gap-2 px-5 py-2 bg-gray-50 border-b text-xs text-gray-500">
                <button onClick={toggleSelectAll} className="text-gray-400 hover:text-teal-600">
                  {selected.size === filtered.length ? <CheckSquare className="w-4 h-4 text-teal-600" /> : <Square className="w-4 h-4" />}
                </button>
                <span>{L(ml('Select all','Seleccionar todo','Selecionar tudo'))}</span>
              </div>
              {/* Table header */}
              <div className="hidden md:grid grid-cols-[40px_1fr_100px_120px_110px_140px_90px] gap-2 px-4 py-2 bg-gray-50 border-b text-[10px] font-medium text-gray-500 uppercase tracking-wider">
                <span />
                <span>{L(ml('Description','Descripción','Descrição'))}</span>
                <span>{L(ml('Category','Categoría','Categoria'))}</span>
                <span>{L(ml('Date','Fecha','Data'))}</span>
                <span>{L(ml('Status','Estado','Status'))}</span>
                <span className="text-right">{L(ml('Amount','Monto','Valor'))}</span>
                <span />
              </div>
              <div className="divide-y">
                {filtered.map(tx => {
                  const cfg = TYPE_CONFIG[tx.type] || TYPE_CONFIG.EXPENSE;
                  const Icon = cfg.icon;
                  const execCfg = EXEC_STATUS[tx.executionStatus] || EXEC_STATUS.EXECUTED;
                  const isSelected = selected.has(tx.id);
                  const isForecast = tx.executionStatus === 'FORECAST';
                  return (
                    <div key={tx.id} className={`md:grid md:grid-cols-[40px_1fr_100px_120px_110px_140px_90px] flex flex-col md:flex-row items-start md:items-center gap-1 md:gap-2 px-4 py-2.5 hover:bg-gray-50 transition group ${isSelected ? 'bg-teal-50/50' : ''} ${isForecast ? 'opacity-75' : ''}`}>
                      {/* Checkbox */}
                      <button onClick={() => toggleSelect(tx.id)} className="text-gray-300 hover:text-teal-600 flex-shrink-0 self-center">
                        {isSelected ? <CheckSquare className="w-4 h-4 text-teal-600" /> : <Square className="w-4 h-4" />}
                      </button>
                      {/* Title + company + project */}
                      <div className="min-w-0 flex items-center gap-2">
                        <div className={`w-7 h-7 rounded ${cfg.bg} flex items-center justify-center flex-shrink-0`}>
                          <Icon className={`w-3.5 h-3.5 ${cfg.color}`} />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="text-sm font-medium text-gray-900 truncate">{tx.title || tx.description || L(cfg.labels)}</p>
                            {tx.isRecurring && <Repeat className="w-3 h-3 text-purple-400 flex-shrink-0" />}
                          </div>
                          <div className="flex items-center gap-1.5 text-[11px] text-gray-400">
                            {tx.company && <span className="truncate max-w-[100px]">{tx.company.shortName}</span>}
                            {tx.project ? (
                              <><span>·</span><span className="inline-block px-1 py-0 rounded bg-blue-50 text-blue-600 text-[10px]">{tx.project.name}</span></>
                            ) : (
                              <><span>·</span><span className="text-[10px] text-gray-300">{L(ml('Internal','Interno','Interno'))}</span></>
                            )}
                            {tx.note && <><span>·</span><span className="truncate max-w-[120px] italic">{tx.note}</span></>}
                            {tx.receiptUrl && <a href={tx.receiptUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 text-teal-600 hover:text-teal-700" title={L(ml('View receipt','Ver comprobante','Ver comprovante'))} onClick={e => e.stopPropagation()}><FileText className="w-3 h-3" /></a>}
                          </div>
                        </div>
                      </div>
                      {/* Category */}
                      <span className="text-xs text-gray-500 truncate">{tx.category || '—'}</span>
                      {/* Date */}
                      <span className="text-xs text-gray-500 tabular-nums">{new Date(tx.date).toLocaleDateString('es-UY')}</span>
                      {/* Status */}
                      <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium w-fit ${execCfg.bg} ${execCfg.color}`}>
                        {L(execCfg.labels)}
                      </span>
                      {/* Amount - right-aligned */}
                      <p className={`text-sm font-semibold text-right tabular-nums font-mono ${tx.type === 'INCOME' || tx.type === 'TRANSFER_IN' ? 'text-emerald-600' : 'text-red-500'} ${isForecast ? 'italic' : ''}`}>
                        {tx.type === 'INCOME' || tx.type === 'TRANSFER_IN' ? '+' : '-'}{formatMoney(tx.amount, tx.currency)}
                      </p>
                      {/* Actions */}
                      <div className="flex gap-0.5 md:opacity-0 md:group-hover:opacity-100 transition justify-end">
                        {isForecast ? (
                          <button onClick={() => openPaymentModal(tx)} className="p-1 rounded text-emerald-500 hover:text-emerald-700 hover:bg-emerald-50" title={L(ml("Pay","Pagar","Pagar"))}>
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <button onClick={() => revertToForecast(tx.id)} className="p-1 rounded text-gray-300 hover:text-amber-600 hover:bg-amber-50" title={L(ml("Revert","Anular","Anular"))}>
                            <Clock className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button onClick={() => openEdit(tx)} className="p-1 rounded text-gray-300 hover:text-teal-600 hover:bg-teal-50" title={L(ml("Edit","Editar","Editar"))}>
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => handleDelete(tx.id)} className="p-1 rounded text-gray-300 hover:text-red-500 hover:bg-red-50" title={L(ml("Delete","Eliminar","Excluir"))}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
          <div className="px-5 py-3 bg-gray-50 text-xs text-gray-500 border-t">
            {filtered.length} {L(ml("transaction(s)","transacción(es)","transação(ões)"))}
          </div>
        </div>
      )}

      {/* SUMMARY VIEW */}
      {view === 'summary' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl p-5 shadow-sm">
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2"><BarChart3 className="w-4 h-4 text-teal-600" />Flujo Mensual</h3>
            {monthlyData.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">Sin datos para mostrar</p>
            ) : (
              <div className="space-y-3">
                {monthlyData.map(([month, data]) => (
                  <div key={month} className="space-y-1">
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>{month}</span>
                      <span className="text-emerald-600">+{formatMoney(data.income)}</span>
                    </div>
                    <div className="flex gap-1 h-4">
                      <div className="bg-emerald-200 rounded-sm transition-all" style={{ width: `${(data.income / maxBar) * 100}%` }} />
                      <div className="bg-red-200 rounded-sm transition-all" style={{ width: `${(data.expense / maxBar) * 100}%` }} />
                    </div>
                    <div className="text-right text-xs text-red-400">-{formatMoney(data.expense)}</div>
                  </div>
                ))}
                <div className="flex gap-4 mt-2 text-xs">
                  <span className="flex items-center gap-1"><span className="w-3 h-3 bg-emerald-200 rounded-sm" />Ingresos</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 bg-red-200 rounded-sm" />Gastos</span>
                </div>
              </div>
            )}
          </div>
          <div className="bg-white rounded-xl p-5 shadow-sm">
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2"><PieChart className="w-4 h-4 text-teal-600" />Gastos por Categoría</h3>
            {categoryBreakdown.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">Sin gastos registrados</p>
            ) : (
              <div className="space-y-2">
                {categoryBreakdown.map(([cat, amount], i) => {
                  const total = categoryBreakdown.reduce((s, [, a]) => s + a, 0);
                  const pct = total > 0 ? (amount / total) * 100 : 0;
                  const colors = ['bg-red-400', 'bg-amber-400', 'bg-blue-400', 'bg-purple-400', 'bg-teal-400', 'bg-pink-400', 'bg-indigo-400', 'bg-orange-400'];
                  return (
                    <div key={cat}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-700">{cat}</span>
                        <span className="text-gray-500 font-medium">{formatMoney(amount)} ({pct.toFixed(1)}%)</span>
                      </div>
                      <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${colors[i % colors.length]} transition-all`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Previsión vs Ejecución summary card */}
          <div className="bg-white rounded-xl p-5 shadow-sm lg:col-span-2">
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2"><Eye className="w-4 h-4 text-teal-600" />Previsión vs Ejecución</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="border rounded-lg p-3">
                <p className="text-xs text-amber-600 font-medium">Ingresos Previstos</p>
                <p className="text-lg font-bold text-amber-700">{formatMoney(forecastTotals.fIncome)}</p>
              </div>
              <div className="border rounded-lg p-3">
                <p className="text-xs text-emerald-600 font-medium">Ingresos Ejecutados</p>
                <p className="text-lg font-bold text-emerald-700">{formatMoney(forecastTotals.eIncome)}</p>
              </div>
              <div className="border rounded-lg p-3">
                <p className="text-xs text-amber-600 font-medium">Gastos Previstos</p>
                <p className="text-lg font-bold text-amber-700">{formatMoney(forecastTotals.fExpense)}</p>
              </div>
              <div className="border rounded-lg p-3">
                <p className="text-xs text-emerald-600 font-medium">Gastos Ejecutados</p>
                <p className="text-lg font-bold text-emerald-700">{formatMoney(forecastTotals.eExpense)}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DRE VIEW */}
      {view === 'dre' && (() => {
        const incomeByCat: Record<string, number> = {};
        const expenseByCat: Record<string, number> = {};
        const costCats = ['Materiales', 'Transporte'];
        filtered.forEach(t => {
          const cat = t.category || 'Sin categoría';
          if (t.type === 'INCOME' || t.type === 'TRANSFER_IN') {
            incomeByCat[cat] = (incomeByCat[cat] || 0) + t.amount;
          } else {
            expenseByCat[cat] = (expenseByCat[cat] || 0) + t.amount;
          }
        });
        const totalRevenue = Object.values(incomeByCat).reduce((s, v) => s + v, 0);
        const cogs = costCats.reduce((s, c) => s + (expenseByCat[c] || 0), 0);
        const grossProfit = totalRevenue - cogs;
        const opExpenses = Object.entries(expenseByCat).filter(([c]) => !costCats.includes(c));
        const totalOpExpenses = opExpenses.reduce((s, [, v]) => s + v, 0);
        const operatingIncome = grossProfit - totalOpExpenses;
        const grossMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;
        const opMargin = totalRevenue > 0 ? (operatingIncome / totalRevenue) * 100 : 0;

        const DRELine = ({ label, amount, bold, indent, color }: { label: string; amount: number; bold?: boolean; indent?: boolean; color?: string }) => (
          <div className={`flex justify-between items-center py-2 ${bold ? 'font-semibold border-t border-gray-200 pt-3' : ''} ${indent ? 'pl-6' : ''}`}>
            <span className={`text-sm ${bold ? 'text-gray-900' : 'text-gray-600'}`}>{label}</span>
            <span className={`text-sm font-mono ${color || (amount >= 0 ? 'text-gray-900' : 'text-red-500')}`}>{formatMoney(amount)}</span>
          </div>
        );

        return (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b bg-gray-50">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-teal-600" />DRE — Estado de Resultados</h3>
              <p className="text-xs text-gray-500 mt-1">Demonstrativo de Resultado del Ejercicio — agrupa por competencia cuando disponible</p>
            </div>
            <div className="p-6 space-y-1">
              <DRELine label={L(ml("Gross Revenue","Ingresos Brutos","Receita Bruta"))} amount={totalRevenue} bold color="text-emerald-600" />
              {Object.entries(incomeByCat).map(([cat, amt]) => (
                <DRELine key={cat} label={cat} amount={amt} indent />
              ))}
              <div className="h-2" />
              <DRELine label={L(ml("(-) Cost of Goods Sold","(-) Costo de Ventas","(-) Custo dos Produtos"))} amount={-cogs} bold color="text-red-500" />
              {costCats.map(c => expenseByCat[c] ? <DRELine key={c} label={c} amount={-expenseByCat[c]} indent /> : null)}
              <div className="h-2" />
              <DRELine label={L(ml("= Gross Profit","= Ganancia Bruta","= Lucro Bruto"))} amount={grossProfit} bold color={grossProfit >= 0 ? 'text-emerald-600' : 'text-red-500'} />
              <div className="pl-6 text-xs text-gray-400">{L(ml("Gross margin","Margen bruto","Margem bruta"))}: {grossMargin.toFixed(1)}%</div>
              <div className="h-2" />
              <DRELine label={L(ml("(-) Operating Expenses","(-) Gastos Operativos","(-) Despesas Operacionais"))} amount={-totalOpExpenses} bold color="text-red-500" />
              {opExpenses.map(([cat, amt]) => (
                <DRELine key={cat} label={cat} amount={-amt} indent />
              ))}
              <div className="h-3" />
              <div className="border-t-2 border-teal-200 pt-3">
                <DRELine label={L(ml("= Operating Income","= Resultado Operativo","= Resultado Operacional"))} amount={operatingIncome} bold color={operatingIncome >= 0 ? 'text-emerald-700' : 'text-red-600'} />
                <div className="pl-6 text-xs text-gray-400">Margen operativo: {opMargin.toFixed(1)}%</div>
              </div>
            </div>
            {filtered.length === 0 && (
              <div className="px-6 pb-6 text-center text-gray-400 text-sm">{L(ml('No transactions in the selected period','Sin transacciones en el período seleccionado','Sem transações no período selecionado'))}</div>
            )}
          </div>
        );
      })()}

      {/* CASHFLOW VIEW - MULTI-CURRENCY */}
      {view === 'cashflow' && (() => {
        // Detect all currencies in filtered transactions
        const allCurrencies = Array.from(new Set(filtered.map(t => t.currency || 'USD'))).sort();
        const cfSource = cfCurrency === 'ALL' ? filtered : filtered.filter(t => (t.currency || 'USD') === cfCurrency);
        const displayCurrency = cfCurrency === 'ALL' ? 'USD' : cfCurrency;

        const cfMonths: { month: string; inflows: number; outflows: number; net: number; balance: number }[] = [];
        const monthMap: Record<string, { inflows: number; outflows: number }> = {};
        cfSource.forEach(t => {
          const m = new Date(t.date).toISOString().slice(0, 7);
          if (!monthMap[m]) monthMap[m] = { inflows: 0, outflows: 0 };
          if (t.type === 'INCOME' || t.type === 'TRANSFER_IN') monthMap[m].inflows += t.amount;
          else monthMap[m].outflows += t.amount;
        });
        let runBal = 0;
        Object.keys(monthMap).sort().forEach(m => {
          const d = monthMap[m];
          const net = d.inflows - d.outflows;
          runBal += net;
          cfMonths.push({ month: m, inflows: d.inflows, outflows: d.outflows, net, balance: runBal });
        });
        const maxCf = cfMonths.reduce((m, d) => Math.max(m, d.inflows, d.outflows), 1);

        // Per-currency summary cards
        const currSummary = allCurrencies.map(cur => {
          const txs = filtered.filter(t => (t.currency || 'USD') === cur);
          const inflows = txs.filter(t => t.type === 'INCOME' || t.type === 'TRANSFER_IN').reduce((s, t) => s + t.amount, 0);
          const outflows = txs.filter(t => t.type === 'EXPENSE' || t.type === 'TRANSFER_OUT').reduce((s, t) => s + t.amount, 0);
          return { currency: cur, inflows, outflows, net: inflows - outflows, count: txs.length };
        });

        return (
          <div className="space-y-6">
            {/* Per-currency summary cards */}
            {allCurrencies.length > 1 && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {currSummary.map(cs => (
                  <button key={cs.currency} onClick={() => setCfCurrency(cfCurrency === cs.currency ? 'ALL' : cs.currency)}
                    className={`bg-white rounded-xl border p-4 text-left transition hover:shadow-md ${cfCurrency === cs.currency ? 'ring-2 ring-teal-500 border-teal-500' : ''}`}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-bold text-gray-700">{cs.currency}</span>
                      <span className="text-xs text-gray-400">{cs.count} txns</span>
                    </div>
                    <div className="text-lg font-bold" style={{ color: cs.net >= 0 ? '#059669' : '#ef4444' }}>
                      {formatMoney(cs.net, cs.currency)}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs">
                      <span className="text-emerald-600">+{formatMoney(cs.inflows, cs.currency)}</span>
                      <span className="text-red-500">-{formatMoney(cs.outflows, cs.currency)}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}

            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b bg-gray-50 flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-gray-900 flex items-center gap-2"><DollarSign className="w-4 h-4 text-teal-600" />Flujo de Caja Mensual</h3>
                  <p className="text-xs text-gray-500 mt-1">
                    {cfCurrency === 'ALL' ? L(ml('All currencies (nominal values combined)','Todas las monedas (valores nominales combinados)','Todas as moedas (valores nominais combinados)')) : `Filtrado por ${cfCurrency}`}
                    {' '}— base efectuación/pago
                  </p>
                </div>
                {allCurrencies.length > 1 && (
                  <select className="border rounded-lg px-3 py-1.5 text-sm" value={cfCurrency} onChange={e => setCfCurrency(e.target.value)}>
                    <option value="ALL">{L(ml('All currencies','Todas las monedas','Todas as moedas'))}</option>
                    {allCurrencies.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                )}
              </div>
              {cfMonths.length === 0 ? (
                <div className="p-8 text-center text-gray-400 text-sm">{L(ml('No transactions to show cash flow','Sin transacciones para mostrar flujo de caja','Sem transações para mostrar fluxo de caixa'))}</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="text-left px-4 py-3 font-medium text-gray-600">Mes</th>
                        <th className="text-right px-4 py-3 font-medium text-emerald-600">Entradas</th>
                        <th className="text-right px-4 py-3 font-medium text-red-500">Salidas</th>
                        <th className="text-right px-4 py-3 font-medium text-gray-700">Neto</th>
                        <th className="text-right px-4 py-3 font-medium text-blue-600">Saldo Acumulado</th>
                        <th className="px-4 py-3 w-48">Flujo</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {cfMonths.map(row => (
                        <tr key={row.month} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium text-gray-900">{row.month}</td>
                          <td className="px-4 py-3 text-right text-emerald-600 font-mono">+{formatMoney(row.inflows, displayCurrency)}</td>
                          <td className="px-4 py-3 text-right text-red-500 font-mono">-{formatMoney(row.outflows, displayCurrency)}</td>
                          <td className={`px-4 py-3 text-right font-mono font-semibold ${row.net >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>{row.net >= 0 ? '+' : ''}{formatMoney(row.net, displayCurrency)}</td>
                          <td className={`px-4 py-3 text-right font-mono font-semibold ${row.balance >= 0 ? 'text-blue-600' : 'text-red-600'}`}>{formatMoney(row.balance, displayCurrency)}</td>
                          <td className="px-4 py-3">
                            <div className="flex gap-0.5 h-4 items-center">
                              <div className="bg-emerald-300 rounded-sm h-full" style={{ width: `${(row.inflows / maxCf) * 100}%` }} />
                              <div className="bg-red-300 rounded-sm h-full" style={{ width: `${(row.outflows / maxCf) * 100}%` }} />
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-gray-50 border-t-2 font-semibold">
                      <tr>
                        <td className="px-4 py-3 text-gray-900">Total</td>
                        <td className="px-4 py-3 text-right text-emerald-600 font-mono">+{formatMoney(cfMonths.reduce((s, r) => s + r.inflows, 0), displayCurrency)}</td>
                        <td className="px-4 py-3 text-right text-red-500 font-mono">-{formatMoney(cfMonths.reduce((s, r) => s + r.outflows, 0), displayCurrency)}</td>
                        <td className={`px-4 py-3 text-right font-mono ${(cfMonths.reduce((s, r) => s + r.net, 0)) >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>{(cfMonths.reduce((s, r) => s + r.net, 0)) >= 0 ? '+' : ''}{formatMoney(cfMonths.reduce((s, r) => s + r.net, 0), displayCurrency)}</td>
                        <td className={`px-4 py-3 text-right font-mono ${runBal >= 0 ? 'text-blue-600' : 'text-red-600'}`}>{formatMoney(cfMonths[cfMonths.length - 1]?.balance || 0, displayCurrency)}</td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* CREATE / EDIT FORM MODAL - NO click-outside-close */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <form onClick={e => e.stopPropagation()} onSubmit={handleSubmit} className="bg-white rounded-xl p-6 w-full max-w-lg space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">{editingId ? L(ml('Edit Transaction','Editar Transacción','Editar Transação')) : L(ml('New Transaction','Nueva Transacción','Nova Transação'))}</h3>
              <button type="button" onClick={() => { setShowForm(false); setEditingId(null); editOpenedForecastOnly.current = null; }} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="block text-xs text-gray-500 mb-1">Tipo *</label>
                <select required value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-sm">
                  {Object.entries(TYPE_CONFIG).map(([k, v]) => <option key={k} value={k}>{L(v.labels)}</option>)}
                </select>
              </div>
              <div><label className="block text-xs text-gray-500 mb-1">{L(ml('Amount *','Monto *','Valor *'))}</label>
                <input required type="number" step="0.01" min="0" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-sm" placeholder="0.00" />
              </div>
            </div>
            <div><label className="block text-xs text-gray-500 mb-1">Título</label>
              <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-sm" placeholder="Ej: Pago servidor AWS" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="block text-xs text-gray-500 mb-1">{L(ml('Company *','Empresa *','Empresa *'))}</label>
                <select required value={form.companyId} onChange={e => setForm({ ...form, companyId: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-sm">
                  <option value="">{L(ml('Select...','Seleccionar...','Selecionar...'))}</option>
                  {companies.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div><label className="block text-xs text-gray-500 mb-1">{L(ml('Project (optional)','Proyecto (opcional)','Projeto (opcional)'))}</label>
                <select value={form.projectId} onChange={e => setForm({ ...form, projectId: e.target.value, allocationPct: e.target.value ? form.allocationPct : '100' })} className="w-full px-3 py-2 rounded-lg border text-sm">
                  <option value="">{L(ml('No project','Sin proyecto','Sem projeto'))}</option>
                  {projects.filter((p: any) => !form.companyId || p.companyId === form.companyId).map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
            </div>
            {/* Allocation % — only when project is selected */}
            {form.projectId && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <label className="block text-xs font-medium text-blue-700 mb-1.5">{L(ml('Project allocation %','% Asignación al proyecto','% Alocação ao projeto'))}</label>
                <div className="flex items-center gap-3">
                  <input type="range" min="0" max="100" step="5" value={form.allocationPct} onChange={e => setForm({ ...form, allocationPct: e.target.value })} className="flex-1 accent-blue-600" />
                  <div className="flex items-center gap-1">
                    <input type="number" min="0" max="100" value={form.allocationPct} onChange={e => setForm({ ...form, allocationPct: e.target.value })} className="w-16 px-2 py-1 rounded border text-sm text-center font-mono" />
                    <span className="text-xs text-blue-600">%</span>
                  </div>
                </div>
                <p className="text-[10px] text-blue-500 mt-1">
                  {parseInt(form.allocationPct) === 100
                    ? L(ml('100% allocated to the project','100% asignado al proyecto','100% alocado ao projeto'))
                    : `${form.allocationPct}% ${L(ml('project','proyecto','projeto'))} — ${100 - (parseInt(form.allocationPct) || 0)}% ${L(ml('internal/overhead','interno/overhead','interno/overhead'))}`
                  }
                </p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Categoría</label>
                <div className="flex gap-1">
                  <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} className="flex-1 px-3 py-2 rounded-lg border text-sm">
                    <option value="">{L(ml('No category','Sin categoría','Sem categoria'))}</option>
                    {allCategories.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <button type="button" onClick={() => setShowNewCat(!showNewCat)} className="p-2 rounded-lg border text-teal-600 hover:bg-teal-50" title="Agregar categoría">
                    <PlusCircle className="w-4 h-4" />
                  </button>
                </div>
                {showNewCat && (
                  <div className="flex gap-1 mt-1">
                    <input value={newCatName} onChange={e => setNewCatName(e.target.value)} className="flex-1 px-2 py-1 rounded border text-xs" placeholder="Nueva categoría..." onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCategory(); } }} />
                    <button type="button" onClick={addCategory} className="px-2 py-1 text-xs bg-teal-600 text-white rounded hover:bg-teal-700">Agregar</button>
                  </div>
                )}
              </div>
              <div><label className="block text-xs text-gray-500 mb-1">{L(ml('Currency','Moneda','Moeda'))}</label>
                <select value={form.currency} onChange={e => setForm({ ...form, currency: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-sm">
                  <option value="USD">USD</option><option value="UYU">UYU</option><option value="BRL">BRL</option><option value="EUR">EUR</option><option value="ARS">ARS</option>
                </select>
              </div>
            </div>
            <div><label className="block text-xs text-gray-500 mb-1">Descripción</label>
              <input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-sm" placeholder={L(ml("Additional transaction details","Detalle adicional de la transacción","Detalhe adicional da transação"))} />
            </div>
            <div><label className="block text-xs text-gray-500 mb-1">{L(ml('Note (optional)','Nota (opcional)','Nota (opcional)'))}</label>
              <input value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-sm" placeholder={L(ml("Internal note or justification","Nota interna o justificación","Nota interna ou justificativa"))} />
            </div>
            <div><label className="block text-xs text-gray-500 mb-1">{L(ml('Receipt Link (optional)','Enlace Comprobante (opcional)','Link Comprovante (opcional)'))}</label>
              <input value={form.receiptUrl} onChange={e => setForm({ ...form, receiptUrl: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-sm" placeholder="https://drive.google.com/... o https://onedrive.live.com/..." />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="block text-xs text-gray-500 mb-1">{L(ml('Forecast Date *','Fecha Prevista *','Data Prevista *'))}</label>
                <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-sm" />
              </div>
              <div><label className="block text-xs text-gray-500 mb-1">Competencia (mes contable)</label>
                <input type="date" value={form.accrualDate} onChange={e => setForm({ ...form, accrualDate: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-sm" />
              </div>
            </div>
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 space-y-2">
              <label className="flex items-start gap-2 cursor-pointer text-xs text-gray-700">
                <input
                  type="checkbox"
                  checked={form.forecastOnly}
                  onChange={e => setForm({ ...form, forecastOnly: e.target.checked })}
                  className="mt-0.5 rounded border-gray-300"
                />
                <span>
                  {L(ml(
                    'Forecast only (not executed yet). Unchecked = counts as executed in totals and filters.',
                    'Solo previsión (aún no ejecutada). Sin marcar = cuenta como ejecutada en totales y filtros.',
                    'Apenas previsão (ainda não executada). Desmarcado = conta como executada nos totais e filtros.',
                  ))}
                </span>
              </label>
              {form.forecastOnly && (
                <p className="text-[11px] text-amber-700 flex items-center gap-1.5 pl-6">
                  <Clock className="w-3.5 h-3.5 flex-shrink-0" />
                  {L(ml('Use "Pay" in the list when you want to mark as executed.', 'Usa "Pagar" en la lista cuando quieras marcar como ejecutada.', 'Use "Pagar" na lista quando quiser marcar como executada.'))}
                </p>
              )}
            </div>
            {/* Recurring */}
            <div className="border-t pt-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.isRecurring} onChange={e => setForm({ ...form, isRecurring: e.target.checked })} className="rounded border-gray-300 text-teal-600 focus:ring-teal-500" />
                <Repeat className="w-3.5 h-3.5 text-purple-500" />
                <span className="text-sm text-gray-700">Transacción recurrente</span>
              </label>
              {form.isRecurring && (
                <div className="mt-2 grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Se repite cada (meses)</label>
                    <input type="number" min="1" max="60" value={form.recurrenceMonths} onChange={e => setForm({ ...form, recurrenceMonths: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-sm" />
                  </div>
                  {!editingId && (
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Cantidad de repeticiones</label>
                      <input type="number" min="1" max="60" value={form.recurrenceCount} onChange={e => setForm({ ...form, recurrenceCount: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-sm" />
                    </div>
                  )}
                  {!editingId && parseInt(form.recurrenceCount) > 1 && form.date && (() => {
                    const count = parseInt(form.recurrenceCount) || 1;
                    const months = parseInt(form.recurrenceMonths) || 1;
                    const base = new Date(form.date);
                    const dates = Array.from({ length: Math.min(count, 12) }, (_, i) => {
                      const d = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + (i * months), base.getUTCDate()));
                      return d.toLocaleDateString('es-UY');
                    });
                    return (
                      <div className="col-span-2 bg-purple-50 border border-purple-200 rounded-lg p-2 text-xs text-purple-700">
                        <Repeat className="w-3 h-3 inline mr-1" />
                        {L(ml('Will create','Se crearán','Serão criadas'))} <strong>{count} {L(ml('transactions','transacciones','transações'))}</strong>: {dates.join(', ')}{count > 12 ? '...' : ''}
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => { setShowForm(false); setEditingId(null); }} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">{L(ml('Cancel','Cancelar','Cancelar'))}</button>
              {!editingId && (
                <button type="button" onClick={(e) => handleSubmit(e as any, true)} className="px-4 py-2 text-sm bg-teal-100 text-teal-700 rounded-lg hover:bg-teal-200 flex items-center gap-1.5">
                  <Plus className="w-3.5 h-3.5" />{L(ml('Save & New','Registrar y Nuevo','Registrar e Novo'))}
                </button>
              )}
              <button type="submit" className="px-4 py-2 text-sm bg-teal-600 text-white rounded-lg hover:bg-teal-700 flex items-center gap-1.5">
                {editingId ? <><Pencil className="w-3.5 h-3.5" />{L(ml('Save changes','Guardar cambios','Salvar alterações'))}</> : <><Plus className="w-3.5 h-3.5" />{L(ml('Record','Registrar','Registrar'))}</>}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* BATCH PAYMENT MODAL */}
      {batchPaymentModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div onClick={e => e.stopPropagation()} className="bg-white rounded-xl p-6 w-full max-w-sm space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />{L(ml('Record Bulk Payment','Registrar Pago Masivo','Registrar Pagamento em Massa'))} 
              </h3>
              <button type="button" onClick={() => setBatchPaymentModal(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <p className="text-sm text-gray-600">
              {L(ml("Confirm payment for","Confirmar el pago de","Confirmar pagamento de"))} <strong className="text-gray-900">{selected.size} {L(ml("transaction(s)","transacción(es)","transação(ões)"))}</strong>
            </p>
            <div>
              <label className="block text-xs text-gray-500 mb-1">{L(ml('Payment date *','Fecha de pago *','Data de pagamento *'))}</label>
              <input type="date" value={batchPaymentDate} onChange={e => setBatchPaymentDate(e.target.value)} className="w-full px-3 py-2 rounded-lg border text-sm" />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setBatchPaymentModal(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Cancelar</button>
              <button type="button" onClick={confirmBatchPayment} disabled={!batchPaymentDate} className="px-4 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />{L(ml('Confirm Payments','Confirmar Pagos','Confirmar Pagamentos'))}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* IMPORT MODAL */}
      {showImport && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div onClick={e => e.stopPropagation()} className="bg-white rounded-xl w-full max-w-3xl shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Upload className="w-5 h-5 text-teal-600" />{L(ml('Import Transactions','Importar Transacciones','Importar Transações'))}
              </h3>
              <button type="button" onClick={() => setShowImport(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              {!importPreview && !importLoading && (
                <div className="space-y-4">
                  <p className="text-sm text-gray-600">
                    {L(ml(
                      'Upload a file and AI will automatically read and extract transactions. Supports: PDF, Excel, CSV, images of receipts/invoices.',
                      'Sube un archivo y la IA leerá e interpretará automáticamente las transacciones. Soporta: PDF, Excel, CSV, imágenes de comprobantes/facturas.',
                      'Envie um arquivo e a IA lerá e interpretará automaticamente as transações. Suporta: PDF, Excel, CSV, imagens de comprovantes/faturas.'
                    ))}
                  </p>
                  <label className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-teal-400 hover:bg-teal-50/50 transition">
                    <FileText className="w-10 h-10 text-gray-300 mb-2" />
                    <span className="text-sm text-gray-500 font-medium">{L(ml('Click to select file','Clic para seleccionar archivo','Clique para selecionar arquivo'))}</span>
                    <span className="text-xs text-gray-400 mt-1">PDF, XLSX, XLS, CSV, JPG, PNG, DOCX</span>
                    <input type="file" className="hidden" accept=".pdf,.xlsx,.xls,.csv,.jpg,.jpeg,.png,.webp,.docx,.txt" onChange={e => { const f = e.target.files?.[0]; if (f) handleImportFile(f); }} />
                  </label>
                </div>
              )}
              {importLoading && (
                <div className="flex flex-col items-center justify-center py-12">
                  <Loader2 className="w-10 h-10 text-teal-600 animate-spin mb-3" />
                  <p className="text-sm text-gray-600 font-medium">{L(ml('AI is reading the file...','La IA está leyendo el archivo...','A IA está lendo o arquivo...'))}</p>
                  <p className="text-xs text-gray-400 mt-1">{importFileName}</p>
                </div>
              )}
              {importPreview && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-gray-700">
                      <span className="font-semibold text-teal-700">{importPreview.length}</span> {L(ml('transactions found','transacciones encontradas','transações encontradas'))}
                      {importSummary && <span className="text-gray-400 ml-2">— {importSummary}</span>}
                    </p>
                    <button onClick={() => { setImportPreview(null); setImportSummary(''); }} className="text-xs text-gray-500 hover:text-gray-700">{L(ml('Upload different file','Subir otro archivo','Enviar outro arquivo'))}</button>
                  </div>
                  <div className="border rounded-lg overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-2 py-2 text-left font-medium text-gray-500">{L(ml('Title','Título','Título'))}</th>
                          <th className="px-2 py-2 text-left font-medium text-gray-500">Tipo</th>
                          <th className="px-2 py-2 text-right font-medium text-gray-500">{L(ml('Amount','Monto','Valor'))}</th>
                          <th className="px-2 py-2 text-left font-medium text-gray-500">{L(ml('Currency','Moneda','Moeda'))}</th>
                          <th className="px-2 py-2 text-left font-medium text-gray-500">{L(ml('Category','Categoría','Categoria'))}</th>
                          <th className="px-2 py-2 text-left font-medium text-gray-500">{L(ml('Date','Fecha','Data'))}</th>
                          <th className="px-2 py-2 w-8" />
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {importPreview.map((t, i) => (
                          <tr key={i} className="hover:bg-gray-50">
                            <td className="px-2 py-1.5"><input value={t.title} onChange={e => updateImportRow(i, 'title', e.target.value)} className="w-full px-1 py-0.5 border rounded text-xs" /></td>
                            <td className="px-2 py-1.5">
                              <select value={t.type} onChange={e => updateImportRow(i, 'type', e.target.value)} className="px-1 py-0.5 border rounded text-xs">
                                {Object.entries(TYPE_CONFIG).map(([k, v]) => <option key={k} value={k}>{L(v.labels)}</option>)}
                              </select>
                            </td>
                            <td className="px-2 py-1.5"><input type="number" step="0.01" value={t.amount} onChange={e => updateImportRow(i, 'amount', parseFloat(e.target.value) || 0)} className="w-20 px-1 py-0.5 border rounded text-xs text-right" /></td>
                            <td className="px-2 py-1.5">
                              <select value={t.currency} onChange={e => updateImportRow(i, 'currency', e.target.value)} className="px-1 py-0.5 border rounded text-xs">
                                <option value="USD">USD</option><option value="UYU">UYU</option><option value="BRL">BRL</option><option value="EUR">EUR</option><option value="ARS">ARS</option>
                              </select>
                            </td>
                            <td className="px-2 py-1.5"><input value={t.category} onChange={e => updateImportRow(i, 'category', e.target.value)} className="w-24 px-1 py-0.5 border rounded text-xs" /></td>
                            <td className="px-2 py-1.5"><input type="date" value={t.date} onChange={e => updateImportRow(i, 'date', e.target.value)} className="px-1 py-0.5 border rounded text-xs" /></td>
                            <td className="px-2 py-1.5">
                              <button onClick={() => removeImportRow(i)} className="p-0.5 text-gray-300 hover:text-red-500"><X className="w-3 h-3" /></button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <button type="button" onClick={() => setShowImport(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">{L(ml('Cancel','Cancelar','Cancelar'))}</button>
                    <button type="button" onClick={confirmImport} disabled={importPreview.length === 0 || importLoading} className="px-4 py-2 text-sm bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5" />{L(ml('Confirm & Import','Confirmar e Importar','Confirmar e Importar'))} ({importPreview.length})
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* PAYMENT MODAL */}
      {paymentModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div onClick={e => e.stopPropagation()} className="bg-white rounded-xl p-6 w-full max-w-sm space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />{L(ml('Record Payment','Registrar Pago','Registrar Pagamento'))}
              </h3>
              <button type="button" onClick={() => setPaymentModal(null)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <p className="text-sm text-gray-600">
              Confirmar el pago de: <strong className="text-gray-900">{paymentModal.title}</strong>
            </p>
            <div>
              <label className="block text-xs text-gray-500 mb-1">{L(ml('Actual payment date *','Fecha de pago real *','Data de pagamento real *'))}</label>
              <input type="date" value={paymentDate} onChange={e => setPaymentDate(e.target.value)} className="w-full px-3 py-2 rounded-lg border text-sm" required />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setPaymentModal(null)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Cancelar</button>
              <button type="button" onClick={confirmPayment} disabled={!paymentDate} className="px-4 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />Confirmar Pago
              </button>
            </div>
          </div>
        </div>
      )}
      </>}
    </div>
  );
}
