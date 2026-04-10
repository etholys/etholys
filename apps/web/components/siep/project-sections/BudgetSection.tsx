'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { SectionProps } from './types';
import SectionTooltip from './SectionTooltip';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Plus, Trash2, X, DollarSign, Edit2, Save, ChevronDown, ChevronRight, FileText, AlertCircle, Calendar, CheckSquare, Square, ExternalLink, RefreshCw, ArrowRightLeft } from 'lucide-react';

interface TxItem { id: string; type: string; amount: number; description?: string; category?: string; date: string; budgetLineId?: string | null; executionStatus?: string; }

interface BudgetLineItem {
  id: string;
  category: string;
  description: string;
  unit: string | null;
  quantity: number;
  unitCost: number;
  total: number;
  narrative: string;
  fundSource: string;
  periodStart: string | null;
  periodEnd: string | null;
  transactions?: TxItem[];
}

const BUDGET_CATEGORIES = [
  { value: 'personnel', label: 'Personal / Personnel', color: '#4f46e5' },
  { value: 'fringe', label: 'Beneficios / Fringe Benefits', color: '#7c3aed' },
  { value: 'travel', label: 'Viajes / Travel', color: '#2563eb' },
  { value: 'equipment', label: 'Equipamiento / Equipment', color: '#0891b2' },
  { value: 'supplies', label: 'Suministros / Supplies', color: '#059669' },
  { value: 'contractual', label: 'Contractual / Contractual', color: '#d97706' },
  { value: 'other_direct', label: 'Otros Directos / Other Direct', color: '#dc2626' },
  { value: 'indirect', label: 'Indirectos / Indirect Costs', color: '#6b7280' },
];

const getCatLabel = (val: string) => BUDGET_CATEGORIES.find(c => c.value === val)?.label || val;
const getCatColor = (val: string) => BUDGET_CATEGORIES.find(c => c.value === val)?.color || '#6b7280';

/* Date range helpers */
function toISODate(d: Date) { return d.toISOString().split('T')[0]; }
function formatRangeLabel(from: string, to: string) {
  if (!from && !to) return 'Todo el proyecto';
  const f = from ? new Date(from + 'T00:00:00').toLocaleDateString('es-UY', { day: '2-digit', month: 'short', year: '2-digit' }) : '...';
  const t = to ? new Date(to + 'T00:00:00').toLocaleDateString('es-UY', { day: '2-digit', month: 'short', year: '2-digit' }) : '...';
  return `${f} \u2013 ${t}`;
}

export default function BudgetSection({ project, onRefresh, tr }: SectionProps) {
  const [lines, setLines] = useState<BudgetLineItem[]>([]);
  const [linesLoading, setLinesLoading] = useState(true);
  const [showLineForm, setShowLineForm] = useState(false);
  const [editLine, setEditLine] = useState<BudgetLineItem | null>(null);
  const [lineForm, setLineForm] = useState<any>({
    category: 'personnel', description: '', unit: '', quantity: '1', unitCost: '0', narrative: '', fundSource: 'federal',
  });
  const [showNarrative, setShowNarrative] = useState<string | null>(null);
  const [collapsedCats, setCollapsedCats] = useState<Set<string>>(new Set());
  const [budgetTab, setBudgetTab] = useState<'lines' | 'transactions'>('lines');
  const [transactionSubTab, setTransactionSubTab] = useState<'all' | 'income' | 'expense'>('all');

  /* Date range filter state */
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  /* Batch selection for transactions */
  const [selectedTx, setSelectedTx] = useState<Set<string>>(new Set());
  /* Transaction-specific date filter (separate from budget lines filter) */
  const [txDateFrom, setTxDateFrom] = useState('');
  const [txDateTo, setTxDateTo] = useState('');

  /* Sync to ATLAS state */
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<any>(null);

  const handleSyncToAtlas = async () => {
    if (syncing) return;
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await fetch('/api/sync-project-budget', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: project.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al sincronizar');
      setSyncResult(data.summary);
    } catch (err: any) {
      setSyncResult({ error: err.message });
    } finally {
      setSyncing(false);
    }
  };

  const fetchLines = useCallback(() => {
    fetch(`/api/budget-lines?projectId=${project.id}`)
      .then(r => r.json())
      .then(d => { setLines(d?.lines ?? []); setLinesLoading(false); })
      .catch(() => setLinesLoading(false));
  }, [project.id]);

  useEffect(() => { fetchLines(); }, [fetchLines]);

  const [showTxForm, setShowTxForm] = useState(false);
  const [txForm, setTxForm] = useState<any>({
    type: 'EXPENSE',
    amount: '',
    description: '',
    category: '',
    date: '',
    budgetLineId: '',
    scope: 'SHARED',
    companyAmount: '',
    currency: 'USD',
    registerAsExecuted: false,
  });
  const [txSaveError, setTxSaveError] = useState<string | null>(null);

  /* Date range filter active? */
  const hasDateFilter = !!(dateFrom || dateTo);
  const dateRangeLabel = formatRangeLabel(dateFrom, dateTo);

  /* Filter transactions by date range */
  const filterTxByPeriod = useCallback((txs: TxItem[]) => {
    if (!dateFrom && !dateTo) return txs;
    return txs.filter(t => {
      const d = t.date ? t.date.substring(0, 10) : '';
      if (dateFrom && d < dateFrom) return false;
      if (dateTo && d > dateTo) return false;
      return true;
    });
  }, [dateFrom, dateTo]);

  const allProjectTx = useMemo(() => (project?.transactions ?? []).filter((t: any) => t?.scope !== 'COMPANY_ONLY'), [project?.transactions]);
  const filteredProjectTx = useMemo(() => filterTxByPeriod(allProjectTx), [allProjectTx, filterTxByPeriod]);

  const { totalIncome, totalExpense, remaining, burnRate } = useMemo(() => {
    const txs = filteredProjectTx;
    const inc = txs.filter((t: any) => t?.type === 'INCOME').reduce((s: number, t: any) => s + (t?.amount ?? 0), 0);
    const exp = txs.filter((t: any) => t?.type === 'EXPENSE' || t?.type === 'TRANSFER_OUT').reduce((s: number, t: any) => s + (t?.amount ?? 0), 0);
    return { totalIncome: inc, totalExpense: exp, remaining: (project?.budget ?? 0) - exp, burnRate: project?.budget > 0 ? Math.round((exp / project.budget) * 100) : 0 };
  }, [filteredProjectTx, project?.budget]);

  const budgetLinesTotal = useMemo(() => lines.reduce((s, l) => s + l.total, 0), [lines]);
  const federalTotal = useMemo(() => lines.filter(l => l.fundSource === 'federal').reduce((s, l) => s + l.total, 0), [lines]);
  const costShareTotal = useMemo(() => lines.filter(l => l.fundSource === 'cost_share').reduce((s, l) => s + l.total, 0), [lines]);

  /* Group lines by category */
  const grouped = useMemo(() => {
    const map = new Map<string, { lines: BudgetLineItem[]; total: number }>();
    BUDGET_CATEGORIES.forEach(c => map.set(c.value, { lines: [], total: 0 }));
    lines.forEach(l => {
      const g = map.get(l.category);
      if (g) { g.lines.push(l); g.total += l.total; }
      else {
        if (!map.has(l.category)) map.set(l.category, { lines: [], total: 0 });
        const ng = map.get(l.category)!;
        ng.lines.push(l); ng.total += l.total;
      }
    });
    return Array.from(map.entries()).filter(([_, v]) => v.lines.length > 0);
  }, [lines]);

  /* Executed per line (sum of linked transactions, filtered by period) */
  const executedByLine = useMemo(() => {
    const map = new Map<string, number>();
    lines.forEach(l => {
      const txs = filterTxByPeriod(l.transactions ?? []);
      const spent = txs.filter(t => (t.type === 'EXPENSE' || t.type === 'TRANSFER_OUT') && t.executionStatus === 'EXECUTED').reduce((s, t) => s + (t.amount ?? 0), 0);
      map.set(l.id, spent);
    });
    return map;
  }, [lines, filterTxByPeriod]);

  /* Executed per category */
  const executedByCat = useMemo(() => {
    const map = new Map<string, number>();
    grouped.forEach(([cat, { lines: catLines }]) => {
      const total = catLines.reduce((s, l) => s + (executedByLine.get(l.id) ?? 0), 0);
      map.set(cat, total);
    });
    return map;
  }, [grouped, executedByLine]);

  const toggleCat = (cat: string) => {
    setCollapsedCats(prev => {
      const next = new Set(prev);
      next.has(cat) ? next.delete(cat) : next.add(cat);
      return next;
    });
  };

  const openLineCreate = () => {
    setEditLine(null);
    setLineForm({ category: 'personnel', description: '', unit: '', quantity: '1', unitCost: '0', narrative: '', fundSource: 'federal' });
    setShowLineForm(true);
  };

  const openLineEdit = (l: BudgetLineItem) => {
    setEditLine(l);
    setLineForm({
      category: l.category, description: l.description, unit: l.unit || '',
      quantity: String(l.quantity), unitCost: String(l.unitCost),
      narrative: l.narrative, fundSource: l.fundSource,
    });
    setShowLineForm(true);
  };

  const handleLineSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = { ...lineForm, projectId: project.id };
    if (editLine) {
      await fetch('/api/budget-lines', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: editLine.id, ...payload }) });
    } else {
      await fetch('/api/budget-lines', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    }
    setShowLineForm(false);
    fetchLines();
  };

  const handleLineDelete = async (id: string) => {
    if (!confirm('\u00bfEliminar esta l\u00ednea de presupuesto?')) return;
    await fetch(`/api/budget-lines?id=${id}`, { method: 'DELETE' });
    fetchLines();
  };

  /* Transaction creation — now with budgetLineId */
  const projectCompanyId = project?.companyId ?? project?.company?.id ?? '';

  const openTxFromLine = (line: BudgetLineItem) => {
    const today = new Date().toISOString().slice(0, 10);
    setTxSaveError(null);
    setTxForm({
      type: 'EXPENSE',
      amount: String(line.total ?? ''),
      description: line.description || '',
      category: getCatLabel(line.category).split('/')[0].trim(),
      date: today,
      budgetLineId: line.id,
      scope: 'SHARED',
      companyAmount: '',
      currency: project?.currency || 'USD',
      registerAsExecuted: true,
    });
    setShowTxForm(true);
  };

  const openTxGeneral = () => {
    setTxSaveError(null);
    setTxForm({
      type: 'EXPENSE',
      amount: '',
      description: '',
      category: '',
      date: '',
      budgetLineId: '',
      scope: 'SHARED',
      companyAmount: '',
      currency: project?.currency || 'USD',
      registerAsExecuted: false,
    });
    setShowTxForm(true);
  };

  const handleTxCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setTxSaveError(null);
    const companyId = projectCompanyId;
    if (!companyId) {
      setTxSaveError('Falta companyId del proyecto. Recargue la página.');
      return;
    }
    const payload = {
      ...txForm,
      projectId: project.id,
      companyId,
      registerAsExecuted: !!txForm.registerAsExecuted,
    };
    const res = await fetch('/api/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setTxSaveError((data as any)?.error || `Error ${res.status} al guardar`);
      return;
    }
    setShowTxForm(false);
    setTxForm({
      type: 'EXPENSE',
      amount: '',
      description: '',
      category: '',
      date: '',
      budgetLineId: '',
      scope: 'SHARED',
      companyAmount: '',
      currency: project?.currency || 'USD',
      registerAsExecuted: false,
    });
    onRefresh();
    fetchLines();
  };

  const handleTxDelete = async (txId: string) => {
    if (!confirm(tr('general.confirm') + '?')) return;
    await fetch(`/api/transactions?id=${txId}`, { method: 'DELETE' });
    onRefresh();
    fetchLines();
  };

  const handleBatchTxDelete = async () => {
    if (selectedTx.size === 0) return;
    if (!confirm(`\u00bfEliminar ${selectedTx.size} transacciones?`)) return;
    await fetch('/api/transactions', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: Array.from(selectedTx) }),
    });
    setSelectedTx(new Set());
    onRefresh();
    fetchLines();
  };

  const toggleTxSelect = (id: string) => {
    setSelectedTx(prev => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });
  };

  /* Filter project transactions for the Transactions tab */
  const txTabFiltered = useMemo(() => {
    let txs = filteredProjectTx;
    if (txDateFrom || txDateTo) {
      txs = txs.filter((t: any) => {
        const d = t?.date ? t.date.substring(0, 10) : '';
        if (txDateFrom && d < txDateFrom) return false;
        if (txDateTo && d > txDateTo) return false;
        return true;
      });
    }
    if (transactionSubTab === 'income') {
      txs = txs.filter((t: any) => t?.type === 'INCOME');
    } else if (transactionSubTab === 'expense') {
      txs = txs.filter((t: any) => t?.type === 'EXPENSE' || t?.type === 'TRANSFER_OUT');
    }
    return txs;
  }, [filteredProjectTx, txDateFrom, txDateTo, transactionSubTab]);

  const calcLineTotal = () => {
    const q = parseFloat(lineForm.quantity) || 0;
    const u = parseFloat(lineForm.unitCost) || 0;
    return q * u;
  };

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <p className="text-[10px] uppercase tracking-wide text-gray-500 font-medium">Presupuesto Total</p>
          <p className="text-xl font-bold text-indigo-700 mt-1">{formatCurrency(project?.budget)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <p className="text-[10px] uppercase tracking-wide text-gray-500 font-medium">Planificado (L&iacute;neas)</p>
          <p className="text-xl font-bold text-blue-600 mt-1">{formatCurrency(budgetLinesTotal)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <p className="text-[10px] uppercase tracking-wide text-gray-500 font-medium">Ejecutado{hasDateFilter ? ` (${dateRangeLabel})` : ''}</p>
          <p className="text-xl font-bold text-red-600 mt-1">{formatCurrency(totalExpense)}</p>
          <div className="w-full bg-gray-100 rounded-full h-1 mt-2"><div className="h-1 rounded-full bg-indigo-500" style={{ width: `${Math.min(burnRate, 100)}%` }} /></div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <p className="text-[10px] uppercase tracking-wide text-gray-500 font-medium">Restante</p>
          <p className={`text-xl font-bold mt-1 ${remaining >= 0 ? 'text-gray-900' : 'text-red-600'}`}>{formatCurrency(remaining)}</p>
        </div>
      </div>

      {/* Date Range Filter */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-1.5 text-sm text-gray-600">
            <Calendar className="w-4 h-4" />
            <span className="font-medium">Rango:</span>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs text-gray-700 focus:ring-1 focus:ring-indigo-400 focus:border-indigo-400 outline-none"
              placeholder="Desde"
            />
            <span className="text-gray-400 text-xs">&mdash;</span>
            <input
              type="date"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs text-gray-700 focus:ring-1 focus:ring-indigo-400 focus:border-indigo-400 outline-none"
              placeholder="Hasta"
            />
          </div>
          {hasDateFilter && (
            <button
              onClick={() => { setDateFrom(''); setDateTo(''); }}
              className="flex items-center gap-1 px-2 py-1 rounded-md text-xs text-indigo-600 hover:bg-indigo-50 transition font-medium"
            >
              <X className="w-3 h-3" />Limpiar
            </button>
          )}
          {hasDateFilter && (
            <span className="text-[10px] text-gray-400 italic">{dateRangeLabel}</span>
          )}
        </div>
      </div>

      {/* Fund Source Split */}
      {lines.length > 0 && (federalTotal > 0 || costShareTotal > 0) && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-gray-500">Fondos Federales</span>
                <span className="font-medium text-indigo-600">{formatCurrency(federalTotal)}</span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${budgetLinesTotal > 0 ? (federalTotal / budgetLinesTotal) * 100 : 0}%` }} />
              </div>
            </div>
            <div className="flex-1">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-gray-500">Contrapartida</span>
                <span className="font-medium text-emerald-600">{formatCurrency(costShareTotal)}</span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${budgetLinesTotal > 0 ? (costShareTotal / budgetLinesTotal) * 100 : 0}%` }} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ Sync to ATLAS Banner ═══ */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-200 p-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <ArrowRightLeft className="w-5 h-5 text-blue-700" />
            </div>
            <div>
              <p className="text-sm font-semibold text-blue-900">Sincronizar con ATLAS Finance</p>
              <p className="text-xs text-blue-600">Enviar líneas presupuestarias y costos de personal al presupuesto de la empresa</p>
            </div>
          </div>
          <button
            onClick={handleSyncToAtlas}
            disabled={syncing}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Sincronizando...' : 'Sincronizar'}
          </button>
        </div>
        {syncResult && !syncResult.error && (
          <div className="mt-3 p-3 bg-white/70 rounded-lg border border-blue-100">
            <p className="text-xs font-medium text-green-700">
              ✓ Sincronización completada: {syncResult.created} creados, {syncResult.updated} actualizados
            </p>
            {syncResult.skipped?.length > 0 && (
              <p className="text-xs text-amber-600 mt-1">⚠ Omitidos: {syncResult.skipped.join(', ')}</p>
            )}
            {syncResult.revenueItems?.length > 0 && (
              <div className="mt-2 p-2 bg-green-50 rounded-md border border-green-200">
                <p className="text-xs font-medium text-green-800">💰 Personal 100% financiado por proyectos:</p>
                {syncResult.revenueItems.map((r: any, i: number) => (
                  <p key={i} className="text-xs text-green-700 mt-0.5">
                    • {r.employee}: salario {new Intl.NumberFormat('es', { style: 'currency', currency: 'USD' }).format(r.baseSalary)} cubierto — libera presupuesto interno
                  </p>
                ))}
              </div>
            )}
          </div>
        )}
        {syncResult?.error && (
          <div className="mt-3 p-3 bg-red-50 rounded-lg border border-red-200">
            <p className="text-xs text-red-700">✗ Error: {syncResult.error}</p>
          </div>
        )}
      </div>

      {/* Tab switcher */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
              <button onClick={() => setBudgetTab('lines')} className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium transition ${budgetTab === 'lines' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                <FileText className="w-3.5 h-3.5" />Líneas Presupuestarias
              </button>
              <button onClick={() => setBudgetTab('transactions')} className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium transition ${budgetTab === 'transactions' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                <DollarSign className="w-3.5 h-3.5" />Transacciones
                {filteredProjectTx.length > 0 && <span className="ml-1 bg-indigo-100 text-indigo-600 text-[10px] font-bold px-1.5 py-0.5 rounded-full">{filteredProjectTx.length}</span>}
              </button>
            </div>
            <SectionTooltip content="Líneas: presupuesto planificado por categoría. Transacciones: registro de ingresos y gastos del proyecto." />
          </div>
          <div className="flex items-center gap-2">
            {budgetTab === 'lines' && (
              <button onClick={openLineCreate} className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 transition">
                <Plus className="w-4 h-4" />Línea
              </button>
            )}
            {budgetTab === 'transactions' && (
              <button onClick={openTxGeneral} className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 transition">
                <Plus className="w-4 h-4" />Transacción
              </button>
            )}
          </div>
        </div>

        {/* ============ LÍNEAS TAB ============ */}
        {budgetTab === 'lines' && (
          <>
            {linesLoading ? (
              <div className="flex items-center justify-center py-8"><div className="w-6 h-6 border-2 border-indigo-600/30 border-t-indigo-600 rounded-full animate-spin" /></div>
            ) : lines.length === 0 ? (
              <div className="text-center py-10">
                <DollarSign className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-400">Sin l&iacute;neas presupuestarias a&uacute;n.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {grouped.map(([cat, { lines: catLines, total }]) => {
                  const isCollapsed = collapsedCats.has(cat);
                  const catExecuted = executedByCat.get(cat) ?? 0;
                  const catPct = total > 0 ? Math.round((catExecuted / total) * 100) : 0;
                  return (
                    <div key={cat} className="border border-gray-100 rounded-lg overflow-hidden">
                      <button
                        onClick={() => toggleCat(cat)}
                        className="w-full flex items-center justify-between px-4 py-2.5 bg-gray-50 hover:bg-gray-100 transition text-left"
                      >
                        <div className="flex items-center gap-2">
                          {isCollapsed ? <ChevronRight className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                          <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: getCatColor(cat) }} />
                          <span className="text-sm font-semibold text-gray-700">{getCatLabel(cat)}</span>
                          <span className="text-[10px] text-gray-400">{catLines.length} l&iacute;nea{catLines.length !== 1 ? 's' : ''}</span>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-2 w-32">
                            <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                              <div className="h-full rounded-full bg-indigo-500" style={{ width: `${Math.min(catPct, 100)}%` }} />
                            </div>
                            <span className="text-[10px] font-medium text-gray-500 w-8 text-right">{catPct}%</span>
                          </div>
                          <div className="text-right">
                            <span className="text-sm font-bold text-gray-900">{formatCurrency(total)}</span>
                            {catExecuted > 0 && <span className="text-[10px] text-red-500 ml-2">-{formatCurrency(catExecuted)}</span>}
                          </div>
                        </div>
                      </button>
                      {!isCollapsed && (
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-gray-100 bg-gray-50/50">
                                <th className="text-left px-4 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wide">&Iacute;tem</th>
                                <th className="text-left px-3 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wide w-24">Unidad</th>
                                <th className="text-right px-3 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wide w-20">Cant.</th>
                                <th className="text-right px-3 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wide w-28">Costo Unit.</th>
                                <th className="text-right px-3 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wide w-28">Total</th>
                                <th className="text-right px-3 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wide w-28">Ejecutado</th>
                                <th className="text-right px-3 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wide w-16">%</th>
                                <th className="w-24 px-2"></th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                              {catLines.map(line => {
                                const lineExec = executedByLine.get(line.id) ?? 0;
                                const linePct = line.total > 0 ? Math.round((lineExec / line.total) * 100) : 0;
                                const lineTxs = filterTxByPeriod(line.transactions ?? []);
                                return (
                                  <tr key={line.id} className="hover:bg-gray-50/50 transition group">
                                    <td className="px-4 py-2.5">
                                      <div>
                                        <p className="text-sm text-gray-800 font-medium">{line.description}</p>
                                        <div className="flex items-center gap-2 mt-0.5">
                                          <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${line.fundSource === 'federal' ? 'bg-indigo-50 text-indigo-600' : 'bg-emerald-50 text-emerald-600'}`}>
                                            {line.fundSource === 'federal' ? 'Federal' : 'Contrapartida'}
                                          </span>
                                          {line.narrative && (
                                            <button onClick={(e) => { e.stopPropagation(); setShowNarrative(showNarrative === line.id ? null : line.id); }} className="text-[9px] text-indigo-500 hover:text-indigo-600 flex items-center gap-0.5">
                                              <FileText className="w-2.5 h-2.5" />Narrativa
                                            </button>
                                          )}
                                          {lineTxs.length > 0 && (
                                            <span className="text-[9px] text-gray-400">{lineTxs.length} tx</span>
                                          )}
                                        </div>
                                        {showNarrative === line.id && line.narrative && (
                                          <p className="text-xs text-gray-600 mt-1.5 bg-indigo-50/50 border border-indigo-100 rounded px-2 py-1.5 italic">{line.narrative}</p>
                                        )}
                                      </div>
                                    </td>
                                    <td className="px-3 py-2.5 text-xs text-gray-500">{line.unit || '\u2014'}</td>
                                    <td className="px-3 py-2.5 text-xs text-gray-700 text-right font-medium">{line.quantity}</td>
                                    <td className="px-3 py-2.5 text-xs text-gray-700 text-right">{formatCurrency(line.unitCost)}</td>
                                    <td className="px-3 py-2.5 text-sm text-gray-900 text-right font-semibold">{formatCurrency(line.total)}</td>
                                    <td className="px-3 py-2.5 text-sm text-right font-medium text-red-600">{lineExec > 0 ? formatCurrency(lineExec) : '\u2014'}</td>
                                    <td className="px-3 py-2.5 text-right">
                                      {linePct > 0 && (
                                        <span className={`text-[10px] font-bold ${linePct >= 100 ? 'text-red-600' : linePct >= 80 ? 'text-amber-600' : 'text-gray-500'}`}>{linePct}%</span>
                                      )}
                                    </td>
                                    <td className="px-2 py-2.5">
                                      <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition justify-end">
                                        <button onClick={() => openTxFromLine(line)} className="p-1 rounded hover:bg-emerald-50 text-gray-400 hover:text-emerald-600" title="Registrar gasto"><DollarSign className="w-3.5 h-3.5" /></button>
                                        <button onClick={() => openLineEdit(line)} className="p-1 rounded hover:bg-indigo-50 text-gray-400 hover:text-indigo-600"><Edit2 className="w-3.5 h-3.5" /></button>
                                        <button onClick={() => handleLineDelete(line.id)} className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
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
                  );
                })}
                <div className="flex justify-between items-center px-4 py-3 bg-indigo-50 rounded-lg">
                  <span className="text-sm font-semibold text-indigo-700">Total Presupuesto Detallado</span>
                  <span className="text-lg font-bold text-indigo-700">{formatCurrency(budgetLinesTotal)}</span>
                </div>
              </div>
            )}
          </>
        )}

        {/* ============ TRANSACCIONES TAB ============ */}
        {budgetTab === 'transactions' && (
          <>
            {/* Sub-tabs for transaction types */}
            <div className="flex items-center bg-gray-50 rounded-lg p-0.5 mb-4">
              <button onClick={() => setTransactionSubTab('all')} className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium transition ${transactionSubTab === 'all' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                Todas
                {filteredProjectTx.length > 0 && <span className="ml-1 bg-gray-100 text-gray-600 text-[10px] font-bold px-1.5 py-0.5 rounded-full">{filteredProjectTx.length}</span>}
              </button>
              <button onClick={() => setTransactionSubTab('income')} className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium transition ${transactionSubTab === 'income' ? 'bg-white text-emerald-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                <ArrowRightLeft className="w-3.5 h-3.5" />Receitas
                {filteredProjectTx.filter((t: any) => t?.type === 'INCOME').length > 0 && <span className="ml-1 bg-emerald-100 text-emerald-600 text-[10px] font-bold px-1.5 py-0.5 rounded-full">{filteredProjectTx.filter((t: any) => t?.type === 'INCOME').length}</span>}
              </button>
              <button onClick={() => setTransactionSubTab('expense')} className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium transition ${transactionSubTab === 'expense' ? 'bg-white text-red-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                <DollarSign className="w-3.5 h-3.5" />Despesas
                {filteredProjectTx.filter((t: any) => t?.type === 'EXPENSE' || t?.type === 'TRANSFER_OUT').length > 0 && <span className="ml-1 bg-red-100 text-red-600 text-[10px] font-bold px-1.5 py-0.5 rounded-full">{filteredProjectTx.filter((t: any) => t?.type === 'EXPENSE' || t?.type === 'TRANSFER_OUT').length}</span>}
              </button>
            </div>

            {/* Transaction date filter */}
            <div className="flex items-center gap-4 mb-4 flex-wrap">
              <div className="flex items-center gap-1.5 text-sm text-gray-600">
                <Calendar className="w-4 h-4" />
                <span className="font-medium">Rango de transacciones:</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={txDateFrom}
                  onChange={e => setTxDateFrom(e.target.value)}
                  className="px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs text-gray-700 focus:ring-1 focus:ring-indigo-400 focus:border-indigo-400 outline-none"
                  placeholder="Desde"
                />
                <span className="text-gray-400 text-xs">&mdash;</span>
                <input
                  type="date"
                  value={txDateTo}
                  onChange={e => setTxDateTo(e.target.value)}
                  className="px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs text-gray-700 focus:ring-1 focus:ring-indigo-400 focus:border-indigo-400 outline-none"
                  placeholder="Hasta"
                />
              </div>
              {(txDateFrom || txDateTo) && (
                <button onClick={() => { setTxDateFrom(''); setTxDateTo(''); }} className="text-xs text-gray-400 hover:text-gray-600">Limpiar</button>
              )}
            </div>

            {txTabFiltered.length === 0 ? (
              <div className="text-center py-10">
                <DollarSign className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-400">
                  {transactionSubTab === 'income' ? 'Sin ingresos registrados.' : transactionSubTab === 'expense' ? 'Sin gastos registrados.' : 'Sin transacciones registradas.'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50/50">
                      <th className="text-left px-4 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Fecha</th>
                      <th className="text-left px-2 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wide w-20">Tipo</th>
                      <th className="text-left px-2 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Descripción</th>
                      <th className="text-left px-2 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wide w-32">Categoría</th>
                      <th className="text-left px-2 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wide w-32">Línea Presupuestaria</th>
                      <th className="text-center px-2 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wide w-20">Estado</th>
                      <th className="text-right px-2 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wide w-24">Monto</th>
                      <th className="w-20 px-2"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {txTabFiltered.map((t: any) => {
                      const linkedLine = lines.find(l => l.id === t?.budgetLineId);
                      return (
                        <tr key={t?.id} className="hover:bg-gray-50/50 transition group">
                          <td className="px-4 py-2 text-gray-700 text-xs">{t?.date ? new Date(t.date).toLocaleDateString('es-UY') : ''}</td>
                          <td className="py-2 px-2"><span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${t?.type === 'INCOME' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>{t?.type === 'INCOME' ? 'Ingreso' : 'Gasto'}</span></td>
                          <td className="py-2 px-2 text-gray-700 text-xs">{t?.description ?? ''}</td>
                          <td className="py-2 px-2 text-gray-500 text-xs">{t?.category ?? ''}</td>
                          <td className="py-2 px-2 text-xs">{linkedLine ? <span className="text-indigo-600 font-medium">{linkedLine.description.substring(0, 25)}{linkedLine.description.length > 25 ? '...' : ''}</span> : <span className="text-gray-300">&mdash;</span>}</td>
                          <td className="py-2 px-2 text-center">
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${t?.executionStatus === 'EXECUTED' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                              {t?.executionStatus === 'EXECUTED' ? 'Ejecutado' : 'Previsto'}
                            </span>
                          </td>
                          <td className={`py-2 px-2 text-right text-xs font-medium ${t?.type === 'INCOME' ? 'text-emerald-600' : 'text-red-600'}`}>{t?.type === 'INCOME' ? '+' : '-'}{formatCurrency(t?.amount)}</td>
                          <td className="py-2 text-right flex items-center justify-end gap-0.5">
                            {t?.receiptUrl && <a href={t.receiptUrl} target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:text-indigo-600 p-1" title="Ver comprobante"><ExternalLink className="w-3 h-3" /></a>}
                            <button onClick={() => handleTxDelete(t?.id)} className="text-red-400 hover:text-red-600 p-1"><Trash2 className="w-3 h-3" /></button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>

      {/* Budget Line Form Modal */}
      {showLineForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b">
              <h2 className="text-lg font-semibold">{editLine ? 'Editar' : 'Nueva'} L&iacute;nea Presupuestaria</h2>
              <button onClick={() => setShowLineForm(false)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <form onSubmit={handleLineSave} className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Categor&iacute;a OMB *</label>
                  <select required value={lineForm.category} onChange={e => setLineForm({ ...lineForm, category: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-sm">
                    {BUDGET_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Fuente de Fondos</label>
                  <select value={lineForm.fundSource} onChange={e => setLineForm({ ...lineForm, fundSource: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-sm">
                    <option value="federal">Federal / Donante</option>
                    <option value="cost_share">Contrapartida / Cost Share</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">&Iacute;tem / Descripci&oacute;n *</label>
                <input required value={lineForm.description} onChange={e => setLineForm({ ...lineForm, description: e.target.value })} placeholder="ej: Director de Proyecto - salario 12 meses" className="w-full px-3 py-2 rounded-lg border text-sm" />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Unidad</label>
                  <input value={lineForm.unit} onChange={e => setLineForm({ ...lineForm, unit: e.target.value })} placeholder="meses, viajes..." className="w-full px-3 py-2 rounded-lg border text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Cantidad</label>
                  <input type="number" step="any" min="0" value={lineForm.quantity} onChange={e => setLineForm({ ...lineForm, quantity: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Costo Unitario</label>
                  <input type="number" step="0.01" min="0" value={lineForm.unitCost} onChange={e => setLineForm({ ...lineForm, unitCost: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-sm" />
                </div>
              </div>
              <div className="bg-indigo-50 rounded-lg px-4 py-2.5 flex justify-between items-center">
                <span className="text-sm text-indigo-600 font-medium">Total calculado</span>
                <span className="text-lg font-bold text-indigo-700">{formatCurrency(calcLineTotal())}</span>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Narrativa Justificativa</label>
                <textarea value={lineForm.narrative} onChange={e => setLineForm({ ...lineForm, narrative: e.target.value })} rows={3} className="w-full px-3 py-2 rounded-lg border text-sm" placeholder="Explique por qu\u00e9 este gasto es necesario para el proyecto." />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowLineForm(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">{tr('general.cancel')}</button>
                <button type="submit" className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium flex items-center gap-2">
                  <Save className="w-4 h-4" />{editLine ? tr('general.save') : tr('general.create')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Transaction Form Modal — now with budgetLineId */}
      {showTxForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b"><h2 className="text-lg font-semibold">Nueva Transacci&oacute;n</h2><button onClick={() => setShowTxForm(false)}><X className="w-5 h-5 text-gray-400" /></button></div>
            <form onSubmit={handleTxCreate} className="p-5 space-y-4">
              {txSaveError && (
                <div className="rounded-lg bg-red-50 text-red-700 text-sm px-3 py-2 border border-red-100">{txSaveError}</div>
              )}
              <div><label className="block text-sm font-medium mb-1">Tipo *</label>
                <select required value={txForm.type} onChange={e => setTxForm({ ...txForm, type: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-sm">
                  <option value="EXPENSE">Gasto</option><option value="INCOME">Ingreso</option>
                </select>
              </div>
              <div><label className="block text-sm font-medium mb-1">Monto *</label>
                <input required type="number" step="0.01" min="0" value={txForm.amount} onChange={e => setTxForm({ ...txForm, amount: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-sm" />
              </div>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!txForm.registerAsExecuted}
                  onChange={e => setTxForm({ ...txForm, registerAsExecuted: e.target.checked })}
                />
                <span>Contar como <strong>ejecutado</strong> (aparece en ejecuci&oacute;n del presupuesto y en flujo financiero)</span>
              </label>
              <div><label className="block text-sm font-medium mb-1">Descripci&oacute;n</label>
                <input value={txForm.description} onChange={e => setTxForm({ ...txForm, description: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">L&iacute;nea Presupuestaria</label>
                <select value={txForm.budgetLineId} onChange={e => setTxForm({ ...txForm, budgetLineId: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-sm">
                  <option value="">Sin vincular</option>
                  {lines.map(l => <option key={l.id} value={l.id}>[{getCatLabel(l.category).split('/')[0].trim()}] {l.description.substring(0, 50)}</option>)}
                </select>
                <p className="text-[10px] text-gray-400 mt-1">Vincule la transacci&oacute;n a una l&iacute;nea para rastrear ejecuci&oacute;n.</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium mb-1">Categor&iacute;a</label>
                  <input value={txForm.category} onChange={e => setTxForm({ ...txForm, category: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-sm" placeholder="Personal, Viajes..." />
                </div>
                <div><label className="block text-sm font-medium mb-1">Fecha</label>
                  <input type="date" value={txForm.date} onChange={e => setTxForm({ ...txForm, date: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Moneda</label>
                <select value={txForm.currency || 'USD'} onChange={e => setTxForm({ ...txForm, currency: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-sm">
                  <option value="USD">USD</option>
                  <option value="UYU">UYU</option>
                  <option value="EUR">EUR</option>
                  <option value="BRL">BRL</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Alcance SIEP / ATLAS</label>
                <select value={txForm.scope} onChange={e => setTxForm({ ...txForm, scope: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-sm">
                  <option value="SHARED">Compartida (SIEP + ATLAS)</option>
                  <option value="PROJECT_ONLY">Solo Proyecto (SIEP)</option>
                  <option value="COMPANY_ONLY">Solo Empresa (ATLAS)</option>
                </select>
                <p className="text-[10px] text-gray-400 mt-1">Define d&oacute;nde se visualiza esta transacci&oacute;n.</p>
              </div>
              {txForm.scope === 'SHARED' && (
                <div>
                  <label className="block text-sm font-medium mb-1">Monto Empresa (opcional)</label>
                  <input type="number" step="0.01" min="0" value={txForm.companyAmount} onChange={e => setTxForm({ ...txForm, companyAmount: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-sm" placeholder="Monto que se imputa a la empresa" />
                  <p className="text-[10px] text-gray-400 mt-1">Si difiere del monto del proyecto. Ej: costos compartidos con distinta proporci&oacute;n.</p>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium mb-1">Enlace Comprobante (opcional)</label>
                <input value={txForm.receiptUrl || ''} onChange={e => setTxForm({ ...txForm, receiptUrl: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-sm" placeholder="https://drive.google.com/..." />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowTxForm(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">{tr('general.cancel')}</button>
                <button type="submit" className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium">{tr('general.create')}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
