'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useApp } from '@/app/providers';
import type { Locale } from '@/lib/i18n';
import {
  ChevronDown, ChevronRight, Plus, Pencil, Trash2, Save, X,
  Users, Plane, FileSignature, Laptop, Package, Wifi, Shield, MoreHorizontal, Wallet, Loader2, FolderPlus,
  DollarSign, CheckSquare, Square, ExternalLink,
} from 'lucide-react';

type ML = { en: string; es: string; pt: string };
const ml = (en: string, es: string, pt: string): ML => ({ en, es, pt });

const ICONS: Record<string, any> = { Users, Plane, FileSignature, Laptop, Package, Wifi, Shield, MoreHorizontal, Wallet };
const UNIT_OPTIONS = ['month', 'day', 'hour', 'flight', 'trip', 'unit', 'lump_sum'];

const MS_DAY = 86400000;
const MAX_FUNDING_SCAN_DAYS = 4000;

function parseYmd(ymd: string | null | undefined): Date | null {
  if (!ymd || typeof ymd !== 'string' || ymd.length < 10) return null;
  const [y, m, d] = ymd.slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(Date.UTC(y, m - 1, d));
}

function formatYmdUtc(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Valor para <input type="date"> sin correr día por zona horaria (ISO string vs UTC). */
function toDateInputValue(d: string | Date | null | undefined): string | null {
  if (d == null) return null;
  const x = typeof d === 'string' ? new Date(d) : d;
  if (Number.isNaN(x.getTime())) return null;
  return formatYmdUtc(x);
}

type SplitLike = { percentage?: number; periodStart?: string | null; periodEnd?: string | null };

type FundingSplitValidation = {
  /** Suma > 100% en algún día donde se superponen tramos */
  overlapDate: string | null;
  /** Dentro del período del ítem hay días con suma < 100% (resto implícito interno) */
  gapDate: string | null;
  /** Falta período del ítem o fechas en fuente para cerrar el rango */
  missingRange: boolean;
  /** Fecha fin < inicio en alguna fuente */
  invertedRange: boolean;
  /** Rango a escanear demasiado largo */
  periodTooLong: boolean;
};

/**
 * Tramos como [inicio, fin] en fechas de calendario: el último día incluido es fin.
 * En validación usamos semiabierto [start, endExclusive) con endExclusive = fin + 1 día,
 * así "hasta 30/04" y "desde 01/05" no comparten el mismo día.
 */
function validateFundingSplitsByPeriod(
  itemPeriodStart: string | null | undefined,
  itemPeriodEnd: string | null | undefined,
  splits: SplitLike[]
): FundingSplitValidation {
  const empty: FundingSplitValidation = {
    overlapDate: null,
    gapDate: null,
    missingRange: false,
    invertedRange: false,
    periodTooLong: false,
  };
  if (!splits.length) return empty;

  const contractS = parseYmd(itemPeriodStart ?? undefined);
  const contractE = parseYmd(itemPeriodEnd ?? undefined);

  const hasOwnStart = (sp: SplitLike) => !!(sp.periodStart && String(sp.periodStart).length >= 10 && parseYmd(sp.periodStart));
  const hasOwnEnd = (sp: SplitLike) => !!(sp.periodEnd && String(sp.periodEnd).length >= 10 && parseYmd(sp.periodEnd));

  const noneHaveOwnDates = splits.every((sp) => !hasOwnStart(sp) && !hasOwnEnd(sp));

  // Varias fuentes sin fechas propias: comparten todo el contrato → cofinanciación simultánea (suma global ≤ 100).
  if (noneHaveOwnDates && splits.length > 1) {
    if (!contractS || !contractE) {
      return { ...empty, missingRange: true };
    }
    if (contractS.getTime() > contractE.getTime()) {
      return { ...empty, invertedRange: true };
    }
    const totalPct = splits.reduce((s, sp) => s + Math.min(100, Math.max(0, Number(sp.percentage) || 0)), 0);
    const overlapDate = totalPct > 100.01 ? formatYmdUtc(contractS) : null;
    let gapDate: string | null = null;
    if (totalPct < 99.99) {
      gapDate = formatYmdUtc(contractS);
    }
    return { overlapDate, gapDate, missingRange: false, invertedRange: false, periodTooLong: false };
  }

  const ranges: { start: Date; endExclusive: Date; pct: number }[] = [];

  for (const sp of splits) {
    const pct = Math.min(100, Math.max(0, Number(sp.percentage) || 0));
    let s = parseYmd(sp.periodStart ?? undefined) || (contractS ? new Date(contractS.getTime()) : null);
    let eInclusive = parseYmd(sp.periodEnd ?? undefined) || (contractE ? new Date(contractE.getTime()) : null);
    if (!s || !eInclusive) {
      return { ...empty, missingRange: true };
    }
    if (s.getTime() > eInclusive.getTime()) {
      return { ...empty, invertedRange: true };
    }
    const endExclusive = new Date(eInclusive.getTime() + MS_DAY);
    ranges.push({ start: s, endExclusive, pct });
  }

  let minD = ranges[0].start;
  let maxLastDay = new Date(ranges[0].endExclusive.getTime() - MS_DAY);
  for (const r of ranges) {
    if (r.start < minD) minD = r.start;
    const last = new Date(r.endExclusive.getTime() - MS_DAY);
    if (last > maxLastDay) maxLastDay = last;
  }

  const spanDays = Math.ceil((maxLastDay.getTime() - minD.getTime()) / MS_DAY) + 1;
  if (spanDays > MAX_FUNDING_SCAN_DAYS) {
    return { ...empty, periodTooLong: true };
  }

  let overlapDate: string | null = null;
  for (let t = minD.getTime(); t <= maxLastDay.getTime(); t += MS_DAY) {
    const day = new Date(t);
    let sum = 0;
    for (const r of ranges) {
      if (day.getTime() >= r.start.getTime() && day.getTime() < r.endExclusive.getTime()) sum += r.pct;
    }
    if (sum > 100.01) {
      overlapDate = formatYmdUtc(day);
      break;
    }
  }

  let gapDate: string | null = null;
  if (contractS && contractE && contractS.getTime() <= contractE.getTime()) {
    const contractEndExclusive = new Date(contractE.getTime() + MS_DAY);
    for (let t = contractS.getTime(); t < contractEndExclusive.getTime(); t += MS_DAY) {
      const day = new Date(t);
      let sum = 0;
      for (const r of ranges) {
        if (day.getTime() >= r.start.getTime() && day.getTime() < r.endExclusive.getTime()) sum += r.pct;
      }
      if (sum < 99.99) {
        gapDate = formatYmdUtc(day);
        break;
      }
    }
  }

  return { overlapDate, gapDate, missingRange: false, invertedRange: false, periodTooLong: false };
}

interface BudgetSubcategory {
  id: string; name: string; nameEs?: string; namePt?: string; isSystem: boolean;
}
interface FundingSplit {
  id: string; projectId?: string | null; percentage: number;
  periodStart?: string | null; periodEnd?: string | null; note?: string | null;
  project?: { id: string; name: string } | null;
}
interface BudgetItem {
  id: string; budgetLineId: string; subcategoryId?: string; description: string;
  unit: string; quantity: number; unitCost: number; total: number; currency: string;
  budgetFlow?: string;
  /** Soma de transações EXECUTED ligadas (tipos alinhados com budgetFlow) */
  executedAmount?: number;
  executedTxCount?: number;
  periodStart?: string; periodEnd?: string; note?: string;
  origin: string; projectId?: string; allocationPct: number;
  subcategory?: BudgetSubcategory | null;
  project?: { id: string; name: string } | null;
  fundingSplits?: FundingSplit[];
}

function getItemFlow(item: BudgetItem | Partial<BudgetItem>): 'EXPENSE' | 'INCOME' {
  return item.budgetFlow === 'INCOME' ? 'INCOME' : 'EXPENSE';
}

function itemExecutionLabel(item: BudgetItem): 'none' | 'partial' | 'complete' {
  const planned = Math.max(0, Number(item.total) || 0);
  const ex = Math.max(0, Number(item.executedAmount) || 0);
  if (planned <= 0.01) return ex > 0.01 ? 'complete' : 'none';
  if (ex <= 0.01) return 'none';
  if (ex >= planned - 0.02) return 'complete';
  return 'partial';
}

function isItemFullyExecuted(item: BudgetItem) {
  return itemExecutionLabel(item) === 'complete';
}

function executionBadgeClass(label: 'none' | 'partial' | 'complete') {
  if (label === 'complete') return 'bg-emerald-100 text-emerald-800 border-emerald-200';
  if (label === 'partial') return 'bg-amber-100 text-amber-900 border-amber-200';
  return 'bg-gray-100 text-gray-600 border-gray-200';
}
interface BudgetLine {
  id: string; name: string; nameEs?: string; namePt?: string;
  icon?: string; color: string; isSystem: boolean; order: number;
  subcategories: BudgetSubcategory[]; items: BudgetItem[];
}

export default function BudgetPlanning() {
  const { locale, activeCompanyId } = useApp();
  const L = (m: ML) => m[locale as Locale] || m.en;

  const [lines, setLines] = useState<BudgetLine[]>([]);
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [editingItem, setEditingItem] = useState<Partial<BudgetItem> & { budgetLineId: string } | null>(null);
  const [savingItem, setSavingItem] = useState(false);
  const [itemSaveError, setItemSaveError] = useState<string | null>(null);
  const [showNewLine, setShowNewLine] = useState(false);
  const [newLineName, setNewLineName] = useState('');
  const [showNewSub, setShowNewSub] = useState<string | null>(null);
  const [newSubName, setNewSubName] = useState('');
  const [editSplits, setEditSplits] = useState<Array<Partial<FundingSplit> & { _key: string }>>([]);
  const [savingSplit, setSavingSplit] = useState(false);
  // Period filter
  const [periodFrom, setPeriodFrom] = useState('');
  const [periodTo, setPeriodTo] = useState('');
  const [hideCompletedItems, setHideCompletedItems] = useState(false);
  const [budgetFlowFilter, setBudgetFlowFilter] = useState<'all' | 'income' | 'expense'>('all');
  // Batch / execute → financial transactions
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
  const [showExecuteModal, setShowExecuteModal] = useState(false);
  const [executeDate, setExecuteDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [executeError, setExecuteError] = useState<string | null>(null);
  const [executing, setExecuting] = useState(false);

  const fetchData = useCallback(async () => {
    if (!activeCompanyId) {
      setLines([]);
      setProjects([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), 120_000);
    try {
      const [linesRes, projRes] = await Promise.all([
        fetch(`/api/company-budget?companyId=${activeCompanyId}`, { signal: ac.signal }),
        fetch(`/api/projects?companyId=${activeCompanyId}`, { signal: ac.signal }),
      ]);
      if (linesRes.ok) setLines(await linesRes.json());
      else setLines([]);
      if (projRes.ok) {
        const pData = await projRes.json();
        const arr = Array.isArray(pData) ? pData : (pData.projects ?? []);
        setProjects(arr.map((pr: any) => ({ id: pr.id, name: pr.name })));
      } else setProjects([]);
    } catch (e: unknown) {
      console.error(e);
      setLines([]);
      setProjects([]);
    } finally {
      clearTimeout(t);
      setLoading(false);
    }
  }, [activeCompanyId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const toggleCollapse = (id: string) => {
    setCollapsed(prev => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });
  };

  const lineName = (line: BudgetLine) => {
    if (locale === 'es' && line.nameEs) return line.nameEs;
    if (locale === 'pt' && line.namePt) return line.namePt;
    return line.name;
  };
  const subName = (sub: BudgetSubcategory) => {
    if (locale === 'es' && sub.nameEs) return sub.nameEs;
    if (locale === 'pt' && sub.namePt) return sub.namePt;
    return sub.name;
  };

  // Filter items by period and planned flow
  const filterItems = useCallback((items: BudgetItem[]) => {
    let filtered = items;
    if (periodFrom || periodTo) {
      filtered = items.filter(item => {
        if (!item.periodStart && !item.periodEnd) return true;
        const from = periodFrom ? new Date(periodFrom) : null;
        const to = periodTo ? new Date(periodTo) : null;
        const iStart = item.periodStart ? new Date(item.periodStart) : null;
        const iEnd = item.periodEnd ? new Date(item.periodEnd) : null;
        if (from && iEnd && iEnd < from) return false;
        if (to && iStart && iStart > to) return false;
        return true;
      });
    }
    if (budgetFlowFilter !== 'all') {
      filtered = filtered.filter(item => getItemFlow(item) === (budgetFlowFilter === 'income' ? 'INCOME' : 'EXPENSE'));
    }
    return filtered;
  }, [periodFrom, periodTo, budgetFlowFilter]);

  const visibleLineItems = useCallback(
    (items: BudgetItem[]) => {
      const base = filterItems(items);
      if (!hideCompletedItems) return base;
      return base.filter((it) => !isItemFullyExecuted(it));
    },
    [filterItems, hideCompletedItems]
  );

  const plannedSummary = useMemo(() => {
    const income: Record<string, number> = {};
    const expense: Record<string, number> = {};
    lines.forEach((line) => {
      filterItems(line.items).forEach((item) => {
        const cur = item.currency || 'USD';
        if (getItemFlow(item) === 'INCOME') income[cur] = (income[cur] || 0) + item.total;
        else expense[cur] = (expense[cur] || 0) + item.total;
      });
    });
    return { income, expense };
  }, [lines, filterItems]);

  const formatMoney = (amount: number, currency: string = 'USD') => {
    return new Intl.NumberFormat('es-UY', { style: 'currency', currency, minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);
  };

  const findItemAndLine = useCallback(
    (itemId: string): { item: BudgetItem; line: BudgetLine } | null => {
      for (const line of lines) {
        const item = line.items.find((i) => i.id === itemId);
        if (item) return { item, line };
      }
      return null;
    },
    [lines]
  );

  const resolveProjectId = (item: BudgetItem): string | null => {
    if (item.projectId) return item.projectId;
    const split = item.fundingSplits?.find((s) => s.projectId);
    return split?.projectId ?? null;
  };

  const executeItems = async (ids: string[]) => {
    if (!activeCompanyId || ids.length === 0) return;
    setExecuteError(null);
    const kinds = new Set<'EXPENSE' | 'INCOME'>();
    for (const id of ids) {
      const found = findItemAndLine(id);
      if (found) kinds.add(getItemFlow(found.item));
    }
    if (kinds.size > 1) {
      setExecuteError(
        L(
          ml(
            'Select only expense items or only income items in one batch.',
            'Seleccioná solo gastos o solo ingresos en un mismo lote.',
            'Selecione apenas despesas ou apenas receitas no mesmo lote.',
          )
        )
      );
      return;
    }
    setExecuting(true);
    try {
      const payloads: Record<string, unknown>[] = [];
      for (const id of ids) {
        const found = findItemAndLine(id);
        if (!found) continue;
        const { item, line } = found;
        const projectId = resolveProjectId(item);
        const cat = item.subcategory ? subName(item.subcategory) : lineName(line);
        const flow = getItemFlow(item);
        payloads.push({
          companyId: activeCompanyId,
          projectId,
          type: flow === 'INCOME' ? 'INCOME' : 'EXPENSE',
          amount: item.total,
          currency: item.currency || 'USD',
          description: item.description,
          category: cat,
          date: executeDate,
          companyBudgetItemId: item.id,
          scope: 'SHARED',
          registerAsExecuted: true,
          origin: projectId ? 'PROJECT' : 'INTERNAL',
        });
      }
      if (payloads.length === 0) {
        setExecuteError('No se encontraron ítems válidos');
        return;
      }
      const res = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: payloads }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setExecuteError((data as { error?: string }).error || `Error ${res.status}`);
        return;
      }
      setSelectedItemIds(new Set());
      setShowExecuteModal(false);
      await fetchData();
    } finally {
      setExecuting(false);
    }
  };

  const toggleItemSelect = (itemId: string) => {
    setSelectedItemIds((prev) => {
      const next = new Set(prev);
      next.has(itemId) ? next.delete(itemId) : next.add(itemId);
      return next;
    });
  };

  const allVisibleItemIds = useMemo(() => {
    const ids: string[] = [];
    for (const line of lines) {
      for (const item of visibleLineItems(line.items)) {
        ids.push(item.id);
      }
    }
    return ids;
  }, [lines, visibleLineItems]);

  const executeSelectionKinds = useMemo(() => {
    const kinds = new Set<'EXPENSE' | 'INCOME'>();
    for (const id of selectedItemIds) {
      const found = findItemAndLine(id);
      if (found) kinds.add(getItemFlow(found.item));
    }
    return kinds;
  }, [selectedItemIds, findItemAndLine]);

  const executeModalIsIncome = executeSelectionKinds.size === 1 && executeSelectionKinds.has('INCOME');

  const toggleSelectAllVisible = () => {
    if (selectedItemIds.size === allVisibleItemIds.length && allVisibleItemIds.length > 0) {
      setSelectedItemIds(new Set());
    } else {
      setSelectedItemIds(new Set(allVisibleItemIds));
    }
  };

  // Item form
  const openNewItem = (budgetLineId: string) => {
    setItemSaveError(null);
    setEditingItem({
      budgetLineId,
      description: '',
      unit: 'month',
      quantity: 1,
      unitCost: 0,
      currency: 'USD',
      budgetFlow: 'EXPENSE',
      origin: 'INTERNAL',
      allocationPct: 100,
    });
    setEditSplits([]);
  };

  const openEditItem = async (item: BudgetItem) => {
    setItemSaveError(null);
    setEditingItem({ ...item });
    setEditSplits([]);
    let raw: FundingSplit[] = item.fundingSplits ?? [];
    if ((!raw || raw.length === 0) && item.id) {
      try {
        const res = await fetch(`/api/budget-item-funding?budgetItemId=${encodeURIComponent(item.id)}`);
        if (res.ok) {
          const data = await res.json();
          raw = (data.fundings as FundingSplit[]) ?? [];
        }
      } catch {
        raw = [];
      }
    }
    setEditSplits(
      raw.map((fs) => ({
        ...fs,
        _key: fs.id,
        periodStart: toDateInputValue(fs.periodStart as string | Date | null | undefined),
        periodEnd: toDateInputValue(fs.periodEnd as string | Date | null | undefined),
      }))
    );
  };

  const saveItem = async () => {
    setItemSaveError(null);
    if (!editingItem || !activeCompanyId) {
      setItemSaveError(
        L(ml('Could not save: no organization selected.', 'No se pudo guardar: no hay organización seleccionada.', 'Não foi possível salvar: nenhuma organização selecionada.'))
      );
      return;
    }
    setSavingItem(true);
    try {
      const isEdit = !!(editingItem as any).id;
      const url = '/api/company-budget';
      const method = isEdit ? 'PUT' : 'POST';
      const body: any = {
        companyId: activeCompanyId,
        action: isEdit ? 'updateItem' : 'createItem',
        ...(isEdit && { id: (editingItem as any).id }),
        budgetLineId: editingItem.budgetLineId,
        subcategoryId: editingItem.subcategoryId || null,
        description: editingItem.description,
        unit: editingItem.unit,
        quantity: editingItem.quantity,
        unitCost: editingItem.unitCost,
        currency: editingItem.currency,
        periodStart: editingItem.periodStart || null,
        periodEnd: editingItem.periodEnd || null,
        note: editingItem.note || null,
        origin: editingItem.origin,
        projectId: editingItem.projectId || null,
        allocationPct: editingItem.allocationPct ?? 100,
        budgetFlow: getItemFlow(editingItem as BudgetItem),
      };
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const raw = await res.text();
      let resData: { id?: string; item?: { id?: string }; error?: string } | null = null;
      try {
        resData = raw ? JSON.parse(raw) : null;
      } catch {
        setItemSaveError(
          L(ml('Invalid response from server.', 'Respuesta inválida del servidor.', 'Resposta inválida do servidor.')) + (raw ? ` (${res.status})` : '')
        );
        return;
      }
      if (!res.ok) {
        const msg = typeof resData?.error === 'string' ? resData.error : `HTTP ${res.status}`;
        setItemSaveError(msg);
        return;
      }
      {
        const itemId = isEdit ? (editingItem as any).id : resData?.item?.id ?? resData?.id;
        // Save funding splits if item has an ID
        if (itemId && editSplits.length > 0) {
          // Get existing splits to determine creates/updates/deletes
          const existingIds = new Set(editSplits.filter(s => s.id).map(s => s.id));
          const origItem = lines.flatMap(l => l.items).find(i => i.id === itemId);
          const origSplitIds = (origItem?.fundingSplits || []).map(f => f.id);
          // Delete removed splits
          for (const oldId of origSplitIds) {
            if (!existingIds.has(oldId)) {
              await fetch(`/api/budget-item-funding?id=${oldId}`, { method: 'DELETE' });
            }
          }
          // Create/update splits
          for (const split of editSplits) {
            const splitBody = {
              budgetItemId: itemId,
              projectId: split.projectId || null,
              percentage: split.percentage ?? 100,
              periodStart: split.periodStart || null,
              periodEnd: split.periodEnd || null,
              note: split.note || null,
            };
            if (split.id) {
              await fetch('/api/budget-item-funding', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: split.id, ...splitBody }) });
            } else {
              await fetch('/api/budget-item-funding', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(splitBody) });
            }
          }
        } else if (itemId && editSplits.length === 0) {
          // Delete all existing splits if user removed them all
          const origItem = lines.flatMap(l => l.items).find(i => i.id === itemId);
          for (const fs of (origItem?.fundingSplits || [])) {
            await fetch(`/api/budget-item-funding?id=${fs.id}`, { method: 'DELETE' });
          }
        }
        setEditingItem(null);
        setEditSplits([]);
        setItemSaveError(null);
        fetchData();
      }
    } catch (e) {
      console.error(e);
      setItemSaveError(
        L(ml('Network error while saving.', 'Error de red al guardar.', 'Erro de rede ao salvar.'))
      );
    } finally {
      setSavingItem(false);
    }
  };

  const deleteItem = async (id: string) => {
    if (!confirm(L(ml('Delete this item?', '¿Eliminar este ítem?', 'Excluir este item?')))) return;
    await fetch(`/api/company-budget?id=${id}&type=item`, { method: 'DELETE' });
    fetchData();
  };

  const createLine = async () => {
    if (!newLineName.trim() || !activeCompanyId) return;
    await fetch('/api/company-budget', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'createLine', companyId: activeCompanyId, name: newLineName.trim() }),
    });
    setNewLineName('');
    setShowNewLine(false);
    fetchData();
  };

  const createSubcategory = async (budgetLineId: string) => {
    if (!newSubName.trim() || !activeCompanyId) return;
    await fetch('/api/company-budget', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'createSubcategory', companyId: activeCompanyId, budgetLineId, name: newSubName.trim() }),
    });
    setNewSubName('');
    setShowNewSub(null);
    fetchData();
  };

  const currentSubs = editingItem ? lines.find(l => l.id === editingItem.budgetLineId)?.subcategories || [] : [];

  const fundingValidation = useMemo((): FundingSplitValidation | null => {
    if (!editingItem || editSplits.length === 0) return null;
    return validateFundingSplitsByPeriod(editingItem.periodStart, editingItem.periodEnd, editSplits);
  }, [editingItem?.id, editingItem?.periodStart, editingItem?.periodEnd, editSplits]);

  const fundingSplitBlocksSave =
    !!fundingValidation &&
    !!(fundingValidation.overlapDate || fundingValidation.missingRange || fundingValidation.invertedRange || fundingValidation.periodTooLong);

  if (!activeCompanyId) {
    return (
      <div className="max-w-[1400px] mx-auto min-h-[50vh] flex flex-col items-center justify-center text-center px-6">
        <Wallet className="w-14 h-14 text-teal-600/40 mb-4" />
        <p className="text-gray-700 font-medium">{L(ml('Select an organization', 'Seleccione una organización', 'Selecione uma organização'))}</p>
        <p className="text-sm text-gray-500 mt-2 max-w-md">
          {L(ml(
            'Use the company selector in the header to load budget planning.',
            'Use el selector de empresa en la barra superior para cargar la planificación presupuestaria.',
            'Use o seletor de empresa no topo da página para carregar o planejamento orçamentário.',
          ))}
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
        <p className="text-xs text-gray-400">{L(ml('Loading budget…', 'Cargando presupuesto…', 'Carregando orçamento…'))}</p>
      </div>
    );
  }

  return (
    <div className="max-w-[1400px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{L(ml('Budget Planning', 'Planificación Presupuestaria', 'Planejamento Orçamentário'))}</h1>
          <p className="text-sm text-gray-500 mt-1">{L(ml('Plan and track your company budget by category', 'Planificá y controlá el presupuesto de la empresa por categoría', 'Planeje e controle o orçamento da empresa por categoria'))}</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Period filter */}
          <div className="flex items-center gap-2 text-sm">
            <label className="text-gray-500">{L(ml('From', 'Desde', 'De'))}</label>
            <input type="month" value={periodFrom} onChange={e => setPeriodFrom(e.target.value)} className="border rounded-lg px-2 py-1.5 text-sm" />
            <label className="text-gray-500">{L(ml('To', 'Hasta', 'Até'))}</label>
            <input type="month" value={periodTo} onChange={e => setPeriodTo(e.target.value)} className="border rounded-lg px-2 py-1.5 text-sm" />
            {(periodFrom || periodTo) && (
              <button onClick={() => { setPeriodFrom(''); setPeriodTo(''); }} className="text-xs text-gray-400 hover:text-gray-600">✕</button>
            )}
            <label className="flex items-center gap-2 text-xs text-gray-600 ml-2 cursor-pointer whitespace-nowrap">
              <input type="checkbox" checked={hideCompletedItems} onChange={(e) => setHideCompletedItems(e.target.checked)} className="rounded border-gray-300" />
              {L(ml('Hide fully executed', 'Ocultar ítems ya ejecutados', 'Ocultar itens já executados'))}
            </label>
          </div>
          <button onClick={() => setShowNewLine(true)} className="flex items-center gap-1.5 px-3 py-2 text-sm bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition">
            <FolderPlus className="w-4 h-4" />{L(ml('New Line', 'Nueva Línea', 'Nova Linha'))}
          </button>
        </div>
      </div>

      {/* Planned summary: revenue, expenses, net */}
      <div className="bg-white border rounded-xl p-4 space-y-3">
        <p className="text-sm font-medium text-gray-600">{L(ml('Planned overview (filtered period)', 'Resumen planificado (período filtrado)', 'Resumo planejado (período filtrado)'))}</p>
        <div className="flex flex-wrap gap-8">
          {(() => {
            const currencies = new Set([...Object.keys(plannedSummary.income), ...Object.keys(plannedSummary.expense)]);
            if (currencies.size === 0) {
              return <span className="text-sm text-gray-400">{L(ml('No planned items in view.', 'Sin ítems planificados en la vista.', 'Sem itens planejados na vista.'))}</span>;
            }
            return Array.from(currencies)
              .sort()
              .map((curr) => {
                const inc = plannedSummary.income[curr] || 0;
                const exp = plannedSummary.expense[curr] || 0;
                const net = inc - exp;
                return (
                  <div key={curr} className="flex flex-wrap gap-6 items-end border border-gray-100 rounded-lg px-4 py-3 bg-gray-50/50">
                    <div className="min-w-[72px]">
                      <p className="text-xs font-semibold text-gray-700 font-mono">{curr}</p>
                    </div>
                    <div className="min-w-[130px]">
                      <p className="text-[10px] uppercase text-gray-400">{L(ml('Planned revenue', 'Ingresos planificados', 'Receitas planejadas'))}</p>
                      <p className="text-base font-bold text-emerald-700 tabular-nums font-mono">{formatMoney(inc, curr)}</p>
                    </div>
                    <div className="min-w-[130px]">
                      <p className="text-[10px] uppercase text-gray-400">{L(ml('Planned expenses', 'Gastos planificados', 'Despesas planejadas'))}</p>
                      <p className="text-base font-bold text-red-600 tabular-nums font-mono">{formatMoney(exp, curr)}</p>
                    </div>
                    <div className="min-w-[130px]">
                      <p className="text-[10px] uppercase text-gray-400">{L(ml('Planned net', 'Resultado planificado', 'Resultado planejado'))}</p>
                      <p className={`text-base font-bold tabular-nums font-mono ${net >= 0 ? 'text-blue-700' : 'text-amber-700'}`}>{formatMoney(net, curr)}</p>
                    </div>
                  </div>
                );
              });
          })()}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 bg-white border border-gray-100 rounded-xl px-4 py-3">
        <span className="text-sm font-medium text-gray-700">{L(ml('Show', 'Mostrar', 'Mostrar'))}:</span>
        <button
          type="button"
          onClick={() => setBudgetFlowFilter('all')}
          className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${budgetFlowFilter === 'all' ? 'bg-teal-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
        >
          {L(ml('All', 'Todas', 'Todas'))}
        </button>
        <button
          type="button"
          onClick={() => setBudgetFlowFilter('income')}
          className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${budgetFlowFilter === 'income' ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
        >
          {L(ml('Revenue', 'Ingresos', 'Receitas'))}
        </button>
        <button
          type="button"
          onClick={() => setBudgetFlowFilter('expense')}
          className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${budgetFlowFilter === 'expense' ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
        >
          {L(ml('Expenses', 'Gastos', 'Despesas'))}
        </button>
      </div>

      {selectedItemIds.size > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-teal-200 bg-teal-50/80 px-4 py-3">
          <span className="text-sm font-medium text-teal-900">
            {selectedItemIds.size} {L(ml('selected', 'seleccionados', 'selecionados'))}
          </span>
          <button
            type="button"
            onClick={() => { setExecuteError(null); setShowExecuteModal(true); }}
            className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700"
          >
            <DollarSign className="w-4 h-4" />
            {executeSelectionKinds.size === 1 && executeSelectionKinds.has('INCOME')
              ? L(ml('Register as executed income', 'Registrar ingresos ejecutados', 'Registrar receitas executadas'))
              : L(ml('Register as executed expenses', 'Registrar como gastos ejecutados', 'Registrar como despesas executadas'))}
          </button>
          <button type="button" onClick={() => setSelectedItemIds(new Set())} className="text-sm text-teal-800 underline">
            {L(ml('Clear selection', 'Limpiar selección', 'Limpar seleção'))}
          </button>
        </div>
      )}

      {/* New line form */}
      {showNewLine && (
        <div className="bg-white border rounded-xl p-4 flex items-center gap-3">
          <input value={newLineName} onChange={e => setNewLineName(e.target.value)} placeholder={L(ml('Line name...', 'Nombre de línea...', 'Nome da linha...'))} className="flex-1 border rounded-lg px-3 py-2 text-sm" autoFocus />
          <button onClick={createLine} className="px-3 py-2 bg-teal-600 text-white rounded-lg text-sm hover:bg-teal-700"><Save className="w-4 h-4" /></button>
          <button onClick={() => { setShowNewLine(false); setNewLineName(''); }} className="px-3 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm hover:bg-gray-200"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Budget lines (blocks) */}
      {lines.map(line => {
        const LineIcon = ICONS[line.icon || 'Wallet'] || Wallet;
        const periodItems = filterItems(line.items);
        const visibleItems = visibleLineItems(line.items);
        const lineTotal: Record<string, number> = {};
        visibleItems.forEach(it => { lineTotal[it.currency] = (lineTotal[it.currency] || 0) + it.total; });
        const isCollapsed = collapsed.has(line.id);

        return (
          <div key={line.id} className="bg-white border rounded-xl overflow-hidden shadow-sm">
            {/* Line header */}
            <button
              onClick={() => toggleCollapse(line.id)}
              className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: line.color + '20' }}>
                  <LineIcon className="w-4 h-4" style={{ color: line.color }} />
                </div>
                {isCollapsed ? <ChevronRight className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                <span className="font-semibold text-gray-900">{lineName(line)}</span>
                <span className="text-xs text-gray-400 ml-1">
                  {visibleItems.length}
                  {periodItems.length !== visibleItems.length ? ` / ${periodItems.length}` : ''}{' '}
                  {visibleItems.length === 1 ? 'item' : L(ml('items', 'ítems', 'itens'))}
                </span>
              </div>
              <div className="flex items-center gap-4">
                {Object.entries(lineTotal).map(([curr, amt]) => (
                  <span key={curr} className="font-bold text-gray-900 tabular-nums font-mono">{formatMoney(amt, curr)}</span>
                ))}
              </div>
            </button>

            {/* Expanded content */}
            {!isCollapsed && (
              <div className="border-t">
                {/* Items table */}
                {periodItems.length > 0 && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 text-left">
                          <th className="w-10 px-2 py-2.5">
                            <button
                              type="button"
                              onClick={toggleSelectAllVisible}
                              className="p-1 rounded hover:bg-gray-200 text-gray-500"
                              title={L(ml('Select all visible', 'Seleccionar visibles', 'Selecionar visíveis'))}
                            >
                              {selectedItemIds.size === allVisibleItemIds.length && allVisibleItemIds.length > 0 ? (
                                <CheckSquare className="w-4 h-4 text-teal-600" />
                              ) : (
                                <Square className="w-4 h-4" />
                              )}
                            </button>
                          </th>
                          <th className="px-5 py-2.5 font-medium text-gray-500 w-[30%]">{L(ml('Item', 'Ítem', 'Item'))}</th>
                          <th className="px-3 py-2.5 font-medium text-gray-500">{L(ml('Category', 'Categoría', 'Categoria'))}</th>
                          <th className="px-3 py-2.5 font-medium text-gray-500">{L(ml('Unit', 'Unidad', 'Unidade'))}</th>
                          <th className="px-3 py-2.5 font-medium text-gray-500 text-right">{L(ml('Qty', 'Cant.', 'Qtd.'))}</th>
                          <th className="px-3 py-2.5 font-medium text-gray-500 text-right">{L(ml('Unit Cost', 'Costo Unit.', 'Custo Unit.'))}</th>
                          <th className="px-3 py-2.5 font-medium text-gray-500 text-right">{L(ml('Total', 'Total', 'Total'))}</th>
                          <th className="px-3 py-2.5 font-medium text-gray-500 min-w-[9rem]">{L(ml('Execution', 'Ejecución', 'Execução'))}</th>
                          <th className="px-3 py-2.5 font-medium text-gray-500">{L(ml('Allocation', 'Asignación', 'Alocação'))}</th>
                          <th className="px-3 py-2.5 font-medium text-gray-500 w-28"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {visibleItems.length === 0 && periodItems.length > 0 && (
                          <tr>
                            <td colSpan={10} className="px-5 py-6 text-center text-sm text-gray-500">
                              {L(ml(
                                'All items in this line are fully executed for the current view. Turn off “Hide fully executed” to see them.',
                                'Todos los ítems de esta línea están ejecutados en la vista actual. Desactivá “Ocultar ítems ya ejecutados” para verlos.',
                                'Todos os itens desta linha estão executados na vista atual. Desligue “Ocultar itens já executados” para vê-los.',
                              ))}
                            </td>
                          </tr>
                        )}
                        {visibleItems.map(item => {
                          const exLabel = itemExecutionLabel(item);
                          const planned = Math.max(0, Number(item.total) || 0);
                          const exAmt = Math.max(0, Number(item.executedAmount) || 0);
                          const exCount = Math.max(0, Number(item.executedTxCount) || 0);
                          const pct = planned > 0.01 ? Math.min(100, (exAmt / planned) * 100) : exAmt > 0.01 ? 100 : 0;
                          return (
                          <tr key={item.id} className="hover:bg-gray-50 transition">
                            <td className="px-2 py-3 align-top">
                              <button
                                type="button"
                                onClick={() => toggleItemSelect(item.id)}
                                className="p-1 rounded text-gray-400 hover:bg-gray-100"
                              >
                                {selectedItemIds.has(item.id) ? (
                                  <CheckSquare className="w-4 h-4 text-teal-600" />
                                ) : (
                                  <Square className="w-4 h-4" />
                                )}
                              </button>
                            </td>
                            <td className="px-5 py-3">
                              <div className="font-medium text-gray-900">{item.description}</div>
                              {item.note && <div className="text-xs text-gray-400 mt-0.5">{item.note}</div>}
                              {(item.periodStart || item.periodEnd) && (
                                <div className="text-xs text-gray-400 mt-0.5">
                                  {item.periodStart ? new Date(item.periodStart).toLocaleDateString('es-UY', { month: 'short', year: 'numeric' }) : '...'}
                                  {' → '}
                                  {item.periodEnd ? new Date(item.periodEnd).toLocaleDateString('es-UY', { month: 'short', year: 'numeric' }) : '...'}
                                </div>
                              )}
                            </td>
                            <td className="px-3 py-3">
                              {item.subcategory && (
                                <span className="inline-block px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">{subName(item.subcategory)}</span>
                              )}
                            </td>
                            <td className="px-3 py-3 text-gray-600">{item.unit}</td>
                            <td className="px-3 py-3 text-right tabular-nums">{item.quantity}</td>
                            <td className="px-3 py-3 text-right tabular-nums font-mono">{formatMoney(item.unitCost, item.currency)}</td>
                            <td className="px-3 py-3 text-right font-semibold tabular-nums font-mono">{formatMoney(item.total, item.currency)}</td>
                            <td className="px-3 py-3 align-top">
                              <div className="flex flex-col gap-1.5 min-w-[8.5rem]">
                                <span className={`inline-flex w-fit items-center rounded border px-1.5 py-0.5 text-[10px] font-medium ${executionBadgeClass(exLabel)}`}>
                                  {exLabel === 'complete'
                                    ? L(ml('Done', 'Listo', 'Concluído'))
                                    : exLabel === 'partial'
                                      ? L(ml('Partial', 'Parcial', 'Parcial'))
                                      : L(ml('None', 'Nada', 'Nenhum'))}
                                </span>
                                <div className="text-[11px] text-gray-600 tabular-nums font-mono">
                                  {formatMoney(exAmt, item.currency)} / {formatMoney(planned, item.currency)}
                                </div>
                                <div className="h-1.5 w-full rounded-full bg-gray-100 overflow-hidden">
                                  <div className="h-full rounded-full bg-teal-500 transition-all" style={{ width: `${pct}%` }} />
                                </div>
                                {exCount > 0 && (
                                  <p className="text-[10px] text-gray-400">
                                    {exCount} {exCount === 1 ? L(ml('movement', 'movimiento', 'movimento')) : L(ml('movements', 'movimientos', 'movimentos'))}
                                  </p>
                                )}
                                <Link
                                  href={`/finance?tab=execution&budgetItemId=${encodeURIComponent(item.id)}`}
                                  className="inline-flex items-center gap-1 text-[11px] font-medium text-teal-700 hover:text-teal-900 hover:underline w-fit"
                                >
                                  {L(ml('Open in Finance', 'Abrir en Finanzas', 'Abrir em Finanças'))}
                                  <ExternalLink className="w-3 h-3 flex-shrink-0" />
                                </Link>
                              </div>
                            </td>
                            <td className="px-3 py-3">
                              {(item.fundingSplits && item.fundingSplits.length > 0) ? (
                                <div className="flex flex-col gap-0.5">
                                  {item.fundingSplits.map((fs: FundingSplit) => (
                                    <span key={fs.id} className="text-xs">
                                      <span className={`inline-block px-1.5 py-0.5 rounded ${fs.projectId ? 'bg-blue-50 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>
                                        {fs.percentage}% {fs.project?.name || L(ml('Internal', 'Interno', 'Interno'))}
                                      </span>
                                      {(fs.periodStart || fs.periodEnd) && (
                                        <span className="ml-1 text-[10px] text-gray-400">
                                          {fs.periodStart ? new Date(fs.periodStart).toLocaleDateString('es-UY', { month: 'short', year: '2-digit' }) : '...'}–{fs.periodEnd ? new Date(fs.periodEnd).toLocaleDateString('es-UY', { month: 'short', year: '2-digit' }) : '...'}
                                        </span>
                                      )}
                                    </span>
                                  ))}
                                </div>
                              ) : item.origin === 'PROJECT' && item.project ? (
                                <span className="text-xs">
                                  <span className="inline-block px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded">{item.allocationPct}% {item.project.name}</span>
                                  {item.allocationPct < 100 && <span className="ml-1 text-gray-400">{100 - item.allocationPct}% {L(ml('Internal', 'Interno', 'Interno'))}</span>}
                                </span>
                              ) : (
                                <span className="text-xs text-gray-400">{L(ml('Internal', 'Interno', 'Interno'))}</span>
                              )}
                            </td>
                            <td className="px-3 py-3">
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setExecuteError(null);
                                    setExecuteDate(new Date().toISOString().slice(0, 10));
                                    setSelectedItemIds(new Set([item.id]));
                                    setShowExecuteModal(true);
                                  }}
                                  className="p-1 text-gray-400 hover:text-emerald-600 rounded"
                                  title={
                                    getItemFlow(item) === 'INCOME'
                                      ? L(ml('Register income (executed)', 'Registrar ingreso (ejecutado)', 'Registrar receita (executada)'))
                                      : L(ml('Register expense (executed)', 'Registrar gasto (ejecutado)', 'Registrar despesa (executada)'))
                                  }
                                >
                                  <DollarSign className="w-3.5 h-3.5" />
                                </button>
                                <button onClick={() => openEditItem(item)} className="p-1 text-gray-400 hover:text-teal-600 rounded"><Pencil className="w-3.5 h-3.5" /></button>
                                <button onClick={() => deleteItem(item.id)} className="p-1 text-gray-400 hover:text-red-500 rounded"><Trash2 className="w-3.5 h-3.5" /></button>
                              </div>
                            </td>
                          </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Actions row */}
                <div className="px-5 py-3 bg-gray-50/50 flex items-center gap-3 border-t">
                  <button onClick={() => openNewItem(line.id)} className="flex items-center gap-1.5 text-sm text-teal-600 hover:text-teal-700 font-medium">
                    <Plus className="w-3.5 h-3.5" />{L(ml('Add Item', 'Agregar Ítem', 'Adicionar Item'))}
                  </button>
                  {showNewSub === line.id ? (
                    <div className="flex items-center gap-2 ml-4">
                      <input value={newSubName} onChange={e => setNewSubName(e.target.value)} placeholder={L(ml('Subcategory name...', 'Nombre subcategoría...', 'Nome subcategoria...'))} className="border rounded px-2 py-1 text-xs w-40" autoFocus />
                      <button onClick={() => createSubcategory(line.id)} className="text-xs text-teal-600 font-medium">{L(ml('Save', 'Guardar', 'Salvar'))}</button>
                      <button onClick={() => { setShowNewSub(null); setNewSubName(''); }} className="text-xs text-gray-400">✕</button>
                    </div>
                  ) : (
                    <button onClick={() => setShowNewSub(line.id)} className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 ml-4">
                      <Plus className="w-3 h-3" />{L(ml('Subcategory', 'Subcategoría', 'Subcategoria'))}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}

      {lines.length === 0 && !loading && (
        <div className="text-center py-16 text-gray-400">
          <Wallet className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>{L(ml('No budget lines yet', 'Aún no hay líneas presupuestarias', 'Ainda não há linhas orçamentárias'))}</p>
        </div>
      )}

      {/* Execute planned items → transactions (executed) */}
      {showExecuteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div
            className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-gray-900 mb-2">
              {executeSelectionKinds.size > 1
                ? L(ml('Register planned items', 'Registrar ítems planificados', 'Registrar itens planejados'))
                : executeModalIsIncome
                  ? L(ml('Register income', 'Registrar ingresos', 'Registrar receitas'))
                  : L(ml('Register expenses', 'Registrar gastos', 'Registrar despesas'))}
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              {executeSelectionKinds.size > 1
                ? L(ml(
                    'You can only register one kind at a time: either expenses or income. Adjust your selection and try again.',
                    'Solo podés registrar un tipo a la vez: gastos o ingresos. Ajustá la selección e intentá de nuevo.',
                    'Só é possível registrar um tipo por vez: despesas ou receitas. Ajuste a seleção e tente de novo.',
                  ))
                : executeModalIsIncome
                  ? L(ml(
                      `Create ${selectedItemIds.size} income transaction(s) as EXECUTED. They will appear in the financial flow and in project execution when linked to a project.`,
                      `Se crearán ${selectedItemIds.size} transacción(es) de ingreso como EJECUTADAS. Aparecerán en el flujo financiero y en la ejecución del proyecto si hay proyecto vinculado.`,
                      `Serão criadas ${selectedItemIds.size} transação(ões) de receita como EXECUTADAS. Aparecerão no fluxo financeiro e na execução do projeto se houver vínculo.`,
                    ))
                  : L(ml(
                      `Create ${selectedItemIds.size} expense transaction(s) as EXECUTED. They will appear in the financial flow and in project execution when linked to a project.`,
                      `Se crearán ${selectedItemIds.size} transacción(es) de gasto como EJECUTADAS. Aparecerán en el flujo financiero y en la ejecución del proyecto si hay proyecto vinculado.`,
                      `Serão criadas ${selectedItemIds.size} transação(ões) de despesa como EXECUTADAS. Aparecerão no fluxo financeiro e na execução do projeto se houver vínculo.`,
                    ))}
            </p>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {L(ml('Payment / execution date', 'Fecha de pago / ejecución', 'Data de pagamento / execução'))}
            </label>
            <input
              type="date"
              value={executeDate}
              onChange={(e) => setExecuteDate(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm mb-4"
            />
            {executeError && (
              <div className="mb-4 rounded-lg bg-red-50 text-red-700 text-sm px-3 py-2 border border-red-100">{executeError}</div>
            )}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => { setShowExecuteModal(false); setExecuteError(null); }}
                className="px-4 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                {L(ml('Cancel', 'Cancelar', 'Cancelar'))}
              </button>
              <button
                type="button"
                disabled={executing || !executeDate || executeSelectionKinds.size > 1}
                onClick={() => executeItems(Array.from(selectedItemIds))}
                className="px-4 py-2 text-sm text-white bg-teal-600 rounded-lg hover:bg-teal-700 disabled:opacity-50 inline-flex items-center gap-2"
              >
                {executing && <Loader2 className="w-4 h-4 animate-spin" />}
                {L(ml('Confirm', 'Confirmar', 'Confirmar'))}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Item edit/create modal */}
      {editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-900 mb-4">
              {(editingItem as any).id ? L(ml('Edit Item', 'Editar Ítem', 'Editar Item')) : L(ml('New Item', 'Nuevo Ítem', 'Novo Item'))}
            </h3>

            <div className="space-y-4">
              {/* Description */}
              <div>
                <label className="text-sm font-medium text-gray-700">{L(ml('Description', 'Descripción', 'Descrição'))} *</label>
                <input value={editingItem.description || ''} onChange={e => setEditingItem({ ...editingItem, description: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 mt-1 text-sm" placeholder={L(ml('e.g. Project Manager (Tiago Rezende)', 'ej. Director Ejecutivo (Tiago Rezende)', 'ex. Gerente de Projeto (Tiago Rezende)'))} />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700">{L(ml('Planned flow', 'Flujo planificado', 'Fluxo planejado'))}</label>
                <div className="flex flex-wrap gap-4 mt-2">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="radio"
                      name="budgetFlow"
                      checked={getItemFlow(editingItem as BudgetItem) === 'EXPENSE'}
                      onChange={() => setEditingItem({ ...editingItem, budgetFlow: 'EXPENSE' })}
                    />
                    {L(ml('Expense (planned cost)', 'Gasto (costo planificado)', 'Despesa (custo planejado)'))}
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="radio"
                      name="budgetFlow"
                      checked={getItemFlow(editingItem as BudgetItem) === 'INCOME'}
                      onChange={() => setEditingItem({ ...editingItem, budgetFlow: 'INCOME' })}
                    />
                    {L(ml('Income (planned revenue)', 'Ingreso (ingreso planificado)', 'Receita (receita planejada)'))}
                  </label>
                </div>
              </div>

              {/* Budget line + subcategory */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700">{L(ml('Budget Line', 'Línea Presupuestaria', 'Linha Orçamentária'))}</label>
                  <select value={editingItem.budgetLineId} onChange={e => setEditingItem({ ...editingItem, budgetLineId: e.target.value, subcategoryId: undefined })}
                    className="w-full border rounded-lg px-3 py-2 mt-1 text-sm">
                    {lines.map(l => <option key={l.id} value={l.id}>{lineName(l)}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">{L(ml('Category', 'Categoría', 'Categoria'))}</label>
                  <select value={editingItem.subcategoryId || ''} onChange={e => setEditingItem({ ...editingItem, subcategoryId: e.target.value || undefined })}
                    className="w-full border rounded-lg px-3 py-2 mt-1 text-sm">
                    <option value="">{L(ml('None', 'Ninguna', 'Nenhuma'))}</option>
                    {currentSubs.map(s => <option key={s.id} value={s.id}>{subName(s)}</option>)}
                  </select>
                </div>
              </div>

              {/* Unit / Qty / Cost / Currency */}
              <div className="grid grid-cols-4 gap-3">
                <div>
                  <label className="text-sm font-medium text-gray-700">{L(ml('Unit', 'Unidad', 'Unidade'))}</label>
                  <select value={editingItem.unit || 'month'} onChange={e => setEditingItem({ ...editingItem, unit: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 mt-1 text-sm">
                    {UNIT_OPTIONS.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">{L(ml('Quantity', 'Cantidad', 'Quantidade'))}</label>
                  <input type="number" min={0} step={0.5} value={editingItem.quantity ?? 1} onChange={e => setEditingItem({ ...editingItem, quantity: parseFloat(e.target.value) || 0 })}
                    className="w-full border rounded-lg px-3 py-2 mt-1 text-sm" />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">{L(ml('Unit Cost', 'Costo Unit.', 'Custo Unit.'))}</label>
                  <input type="number" min={0} step={0.01} value={editingItem.unitCost ?? 0} onChange={e => setEditingItem({ ...editingItem, unitCost: parseFloat(e.target.value) || 0 })}
                    className="w-full border rounded-lg px-3 py-2 mt-1 text-sm" />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">{L(ml('Currency', 'Moneda', 'Moeda'))}</label>
                  <select value={editingItem.currency || 'USD'} onChange={e => setEditingItem({ ...editingItem, currency: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 mt-1 text-sm">
                    <option value="USD">USD</option>
                    <option value="UYU">UYU</option>
                    <option value="EUR">EUR</option>
                    <option value="BRL">BRL</option>
                  </select>
                </div>
              </div>

              {/* Calculated total */}
              <div className="bg-gray-50 rounded-lg p-3 flex items-center justify-between">
                <span className="text-sm text-gray-600">{L(ml('Total', 'Total', 'Total'))}</span>
                <span className="text-lg font-bold tabular-nums font-mono">{formatMoney((editingItem.quantity || 0) * (editingItem.unitCost || 0), editingItem.currency || 'USD')}</span>
              </div>

              {/* Period */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700">{L(ml('Period Start', 'Inicio Período', 'Início Período'))}</label>
                  <input type="date" value={editingItem.periodStart ? editingItem.periodStart.substring(0, 10) : ''}
                    onChange={e => setEditingItem({ ...editingItem, periodStart: e.target.value || undefined })}
                    className="w-full border rounded-lg px-3 py-2 mt-1 text-sm" />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">{L(ml('Period End', 'Fin Período', 'Fim Período'))}</label>
                  <input type="date" value={editingItem.periodEnd ? editingItem.periodEnd.substring(0, 10) : ''}
                    onChange={e => setEditingItem({ ...editingItem, periodEnd: e.target.value || undefined })}
                    className="w-full border rounded-lg px-3 py-2 mt-1 text-sm" />
                </div>
              </div>

              {/* Funding Splits */}
              <div className="border-t pt-4">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-gray-700">{L(ml('Funding Sources', 'Fuentes de Financiamiento', 'Fontes de Financiamento'))}</label>
                  <button type="button" onClick={() => setEditSplits([...editSplits, { _key: `new_${Date.now()}`, projectId: null, percentage: 100, periodStart: null, periodEnd: null, note: null }])}
                    className="flex items-center gap-1 text-xs text-teal-600 hover:text-teal-700 font-medium">
                    <Plus className="w-3 h-3" />{L(ml('Add Source', 'Agregar Fuente', 'Adicionar Fonte'))}
                  </button>
                </div>
                {editSplits.length === 0 && (
                  <p className="text-xs text-gray-400 italic mb-2">{L(ml('No splits configured — defaults to simple allocation above.', 'Sin tramos configurados — usa asignación simple.', 'Sem tramos configurados — usa alocação simples.'))}</p>
                )}
                {editSplits.length > 0 && (
                  <div className="space-y-2">
                    {editSplits.map((split, idx) => (
                      <div key={split._key} className="flex items-center gap-2 bg-gray-50 rounded-lg p-2">
                        <select value={split.projectId || ''} onChange={e => { const ns = [...editSplits]; ns[idx] = { ...ns[idx], projectId: e.target.value || null }; setEditSplits(ns); }}
                          className="flex-1 border rounded px-2 py-1.5 text-xs">
                          <option value="">{L(ml('Internal', 'Interno', 'Interno'))}</option>
                          {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                        <input type="number" min={1} max={100} value={split.percentage ?? 100} onChange={e => { const ns = [...editSplits]; ns[idx] = { ...ns[idx], percentage: parseInt(e.target.value) || 100 }; setEditSplits(ns); }}
                          className="w-16 border rounded px-2 py-1.5 text-xs text-center" title="%" />
                        <span className="text-[10px] text-gray-400">%</span>
                        <input type="date" value={split.periodStart || ''} onChange={e => { const ns = [...editSplits]; ns[idx] = { ...ns[idx], periodStart: e.target.value || null }; setEditSplits(ns); }}
                          className="border rounded px-2 py-1.5 text-xs w-28" title={L(ml('Start', 'Inicio', 'Início'))} />
                        <input type="date" value={split.periodEnd || ''} onChange={e => { const ns = [...editSplits]; ns[idx] = { ...ns[idx], periodEnd: e.target.value || null }; setEditSplits(ns); }}
                          className="border rounded px-2 py-1.5 text-xs w-28" title={L(ml('End', 'Fin', 'Fim'))} />
                        <button type="button" onClick={() => setEditSplits(editSplits.filter((_, i) => i !== idx))} className="p-1 text-red-400 hover:text-red-600"><Trash2 className="w-3 h-3" /></button>
                      </div>
                    ))}
                    {fundingValidation && fundingValidation.missingRange && (
                      <p className="text-[10px] text-red-600">
                        {L(ml(
                          'Set the item contract period (above) or enter start/end dates on each funding row.',
                          'Defina el período del ítem (arriba) o las fechas inicio/fin en cada fuente.',
                          'Defina o período do item (acima) ou as datas início/fim em cada fonte.',
                        ))}
                      </p>
                    )}
                    {fundingValidation && fundingValidation.invertedRange && (
                      <p className="text-[10px] text-red-600">
                        {L(ml('A funding row has end date before start date.', 'Una fuente tiene fecha fin anterior al inicio.', 'Uma fonte tem data fim anterior ao início.'))}
                      </p>
                    )}
                    {fundingValidation && fundingValidation.periodTooLong && (
                      <p className="text-[10px] text-red-600">
                        {L(ml('Combined date range is too long to validate (max ~11 years).', 'El rango de fechas es demasiado largo para validar.', 'O intervalo de datas é longo demais para validar.'))}
                      </p>
                    )}
                    {fundingValidation && fundingValidation.overlapDate && (
                      <p className="text-[10px] text-red-600">
                        {L(ml(
                          `Overlapping funding on at least one day exceeds 100% (e.g. ${fundingValidation.overlapDate}). Adjust percentages or date ranges.`,
                          `En fechas superpuestas la suma supera 100% (ej. ${fundingValidation.overlapDate}). Ajustá porcentajes o tramos.`,
                          `Em datas sobrepostas a soma ultrapassa 100% (ex.: ${fundingValidation.overlapDate}). Ajuste percentuais ou períodos.`,
                        ))}
                      </p>
                    )}
                    {fundingValidation && fundingValidation.gapDate && !fundingSplitBlocksSave && (
                      <p className="text-[10px] text-amber-600">
                        {L(ml(
                          `Part of the item contract has under 100% assigned funding (e.g. from ${fundingValidation.gapDate}) — remainder is implicit internal cost until you add sources.`,
                          `Parte del contrato del ítem queda con menos del 100% asignado (ej. desde ${fundingValidation.gapDate}); el resto es costo interno implícito hasta agregar fuentes.`,
                          `Parte do período do item fica com menos de 100% atribuído (ex. a partir de ${fundingValidation.gapDate}); o restante é custo interno implícito até adicionar fontes.`,
                        ))}
                      </p>
                    )}
                  </div>
                )}
                {editSplits.length === 0 && (
                  <>
                    <div className="flex items-center gap-4 mt-2">
                      <label className="flex items-center gap-2 text-sm">
                        <input type="radio" name="origin" checked={editingItem.origin === 'INTERNAL'}
                          onChange={() => setEditingItem({ ...editingItem, origin: 'INTERNAL', projectId: undefined, allocationPct: 100 })} />
                        {L(ml('Internal', 'Interno', 'Interno'))}
                      </label>
                      <label className="flex items-center gap-2 text-sm">
                        <input type="radio" name="origin" checked={editingItem.origin === 'PROJECT'}
                          onChange={() => setEditingItem({ ...editingItem, origin: 'PROJECT', allocationPct: 100 })} />
                        {L(ml('Project', 'Proyecto', 'Projeto'))}
                      </label>
                    </div>
                    {editingItem.origin === 'PROJECT' && (
                      <div className="mt-3 grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-xs text-gray-500">{L(ml('Project', 'Proyecto', 'Projeto'))}</label>
                          <select value={editingItem.projectId || ''} onChange={e => setEditingItem({ ...editingItem, projectId: e.target.value || undefined })}
                            className="w-full border rounded-lg px-3 py-2 mt-1 text-sm">
                            <option value="">{L(ml('Select...', 'Seleccionar...', 'Selecionar...'))}</option>
                            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="text-xs text-gray-500">{L(ml('Project %', '% Proyecto', '% Projeto'))}</label>
                          <div className="flex items-center gap-2 mt-1">
                            <input type="number" min={1} max={100} value={editingItem.allocationPct ?? 100}
                              onChange={e => setEditingItem({ ...editingItem, allocationPct: parseInt(e.target.value) || 100 })}
                              className="w-20 border rounded-lg px-3 py-2 text-sm" />
                            <span className="text-xs text-gray-400">% {L(ml('project', 'proyecto', 'projeto'))} — {100 - (editingItem.allocationPct ?? 100)}% {L(ml('internal', 'interno', 'interno'))}</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Note */}
              <div>
                <label className="text-sm font-medium text-gray-700">{L(ml('Note', 'Nota', 'Nota'))}</label>
                <textarea value={editingItem.note || ''} onChange={e => setEditingItem({ ...editingItem, note: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 mt-1 text-sm" rows={2} placeholder={L(ml('Optional justification...', 'Justificación opcional...', 'Justificativa opcional...'))} />
              </div>
            </div>

            {itemSaveError && (
              <div className="mt-4 rounded-lg bg-red-50 text-red-800 text-sm px-3 py-2 border border-red-100" role="alert">
                {itemSaveError}
              </div>
            )}

            {/* Modal actions */}
            <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
              <button
                type="button"
                onClick={() => { setEditingItem(null); setItemSaveError(null); }}
                className="px-4 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                {L(ml('Cancel', 'Cancelar', 'Cancelar'))}
              </button>
              <button
                type="button"
                onClick={() => void saveItem()}
                disabled={savingItem || !editingItem.description?.trim() || fundingSplitBlocksSave}
                className="px-4 py-2 text-sm text-white bg-teal-600 rounded-lg hover:bg-teal-700 disabled:opacity-50 flex items-center gap-2"
              >
                {savingItem && <Loader2 className="w-4 h-4 animate-spin" />}
                {L(ml('Save', 'Guardar', 'Salvar'))}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
