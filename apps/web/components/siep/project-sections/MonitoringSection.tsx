'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import ReactDOM from 'react-dom';
import { SectionProps } from './types';
import { SectionTooltip } from './SectionTooltip';
import { formatDate } from '@/lib/utils';
import { buildMonitoringMaps } from '@/lib/siep/objective-hierarchy';
import { metricsMissing, resolveIndicatorMetrics } from '@/lib/siep/indicator-fields';
import {
  displayMeasurementPeriod,
  encodeMeasurementPeriod,
  isValidMeasurementPeriodRange,
} from '@/lib/siep/measurement-period';
import {
  BarChart3, Plus, X, Save, Edit2, Trash2, ChevronDown, ChevronRight,
  Target, AlertCircle, AlertTriangle, CheckCircle2, Clock,
  Eye, Filter, Pencil, Check, Info, Loader2,
} from 'lucide-react';

/* Portal wrapper to avoid type issues */
function Portal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return null;
  return ReactDOM.createPortal(children as any, document.body) as any;
}

/* Inline tooltip for hierarchy code badges — uses fixed positioning to escape overflow containers */
function CodeTooltip({ code, fullLabel, title, color }: { code: string; fullLabel: string; title: string; color: string }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{x:number;y:number}|null>(null);
  const ref = React.useRef<HTMLSpanElement>(null);
  const handleEnter = () => {
    if (ref.current) {
      const r = ref.current.getBoundingClientRect();
      setPos({ x: r.left + r.width / 2, y: r.top });
    }
    setOpen(true);
  };
  return (
    <span ref={ref} className="relative inline-block" onMouseEnter={handleEnter} onMouseLeave={() => setOpen(false)}>
      <span
        className="inline-block text-[9px] font-mono font-bold px-1 py-0.5 rounded cursor-help"
        style={{ backgroundColor: color + '18', color }}
      >
        {code}
      </span>
      {open && pos && (
        <Portal>
          <span
            className="fixed z-[9999] w-56 bg-gray-900 text-white text-[10px] rounded-lg shadow-lg px-3 py-2 pointer-events-none"
            style={{ left: pos.x, top: pos.y, transform: 'translate(-50%, -100%) translateY(-6px)' }}
          >
            <span className="block font-semibold text-[10px] mb-0.5" style={{ color: color }}>{fullLabel}</span>
            <span className="block leading-snug text-gray-200">{title}</span>
            <span className="absolute top-full left-1/2 -translate-x-1/2 -mt-px w-2 h-2 bg-gray-900 rotate-45" />
          </span>
        </Portal>
      )}
    </span>
  );
}

interface Measurement {
  id: string;
  objectiveId: string;
  period: string;
  value: string;
  notes: string | null;
  source: string | null;
  status: string;
  collectedAt: string;
  objective: { id: string; title: string; code: string | null; type: string; indicator: string | null; baseline: string | null; target: string | null; actual: string | null };
}

const STATUS_CONFIG: Record<string, { bg: string; text: string; label: string }> = {
  draft: { bg: 'bg-gray-100', text: 'text-gray-600', label: 'Borrador' },
  submitted: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Enviado' },
  approved: { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Aprobado' },
  reported: { bg: 'bg-blue-100', text: 'text-blue-600', label: 'Reportado' },
  verified: { bg: 'bg-emerald-100', text: 'text-emerald-600', label: 'Verificado' },
  rejected: { bg: 'bg-red-100', text: 'text-red-600', label: 'Rechazado' },
};

const OBJ_COLORS: Record<string, string> = {
  objective: '#4f46e5', outcome: '#2563eb', output: '#7c3aed', activity: '#6366f1',
  indicator: '#ef4444', deliverable: '#059669', goal: '#1d4ed8', impact: '#1e40af',
};

/* Hierarchy code columns: OE=Objetivo Espec&iacute;fico, OC=Outcome, OP=Output, A=Activity */
const HIERARCHY_COLS = [
  { key: 'objective', abbr: 'OE', full: 'Objetivo Espec\u00edfico', color: '#4f46e5' },
  { key: 'outcome', abbr: 'OC', full: 'Outcome / Resultado', color: '#2563eb' },
  { key: 'output', abbr: 'OP', full: 'Output / Producto', color: '#7c3aed' },
  { key: 'activity', abbr: 'A', full: 'Actividad', color: '#f59e0b' },
];

export function MonitoringSection({ project, onRefresh, tr }: SectionProps) {
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [measLoading, setMeasLoading] = useState(true);
  const [showMeasForm, setShowMeasForm] = useState(false);
  const [measContextObj, setMeasContextObj] = useState<any | null>(null);
  const [measForm, setMeasForm] = useState<any>({ objectiveId: '', periodStart: '', periodEnd: '', value: '', notes: '', source: '' });
  const [filterObjId, setFilterObjId] = useState<string>('');

  const [expandedIndicator, setExpandedIndicator] = useState<string | null>(null);

  /* Full row editing state (P1) */
  const [editingRow, setEditingRow] = useState<string | null>(null);
  const [rowForm, setRowForm] = useState<any>({});
  const [rowSaving, setRowSaving] = useState(false);
  const [pendingParentChange, setPendingParentChange] = useState<{ objectiveId: string; newParentId: string } | null>(null);

  /* Cascading dropdown state for measurement creation (P2) */
  const [cascadeOE, setCascadeOE] = useState('');
  const [cascadeOC, setCascadeOC] = useState('');
  const [cascadeOP, setCascadeOP] = useState('');
  const [cascadeA, setCascadeA] = useState('');
  const [repairState, setRepairState] = useState<'idle' | 'running' | 'done' | 'error'>('idle');
  const [repairInfo, setRepairInfo] = useState<string | null>(null);
  const [metaRepairState, setMetaRepairState] = useState<'idle' | 'running' | 'done' | 'error'>('idle');
  const [metaRepairInfo, setMetaRepairInfo] = useState<string | null>(null);

  const { indicatorObjs, hierarchyMap, byType } = useMemo(
    () => buildMonitoringMaps(project?.objectives),
    [project?.objectives],
  );

  const orphanIndicators = useMemo(
    () => indicatorObjs.filter((o) => o.type === 'indicator' && !hierarchyMap.get(o.id)?.activity?.id),
    [indicatorObjs, hierarchyMap],
  );

  const linkedCount = indicatorObjs.filter((o) => o.type === 'indicator' && hierarchyMap.get(o.id)?.activity?.id).length;
  const indicatorTypeCount = indicatorObjs.filter((o) => o.type === 'indicator').length;

  const missingMetricsCount = useMemo(
    () => indicatorObjs.filter((o) => o.type === 'indicator' && metricsMissing(o)).length,
    [indicatorObjs],
  );

  const runMetadataRepair = useCallback(async (manual = false) => {
    if (!project?.id) return;
    if (!manual && missingMetricsCount === 0) {
      setMetaRepairState('done');
      return;
    }
    setMetaRepairState('running');
    setMetaRepairInfo(null);
    try {
      const r = await fetch(`/api/projects/${project.id}/repair-indicator-metadata`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ useAi: true }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.error || 'Erro ao preencher metadados');
      setMetaRepairInfo(d.message || 'Metadados actualizados.');
      setMetaRepairState('done');
      if ((d.updated ?? 0) + (d.aiFilled ?? 0) > 0) onRefresh();
    } catch (e: unknown) {
      setMetaRepairState('error');
      setMetaRepairInfo(e instanceof Error ? e.message : 'Erro ao preencher unidade/meta');
    }
  }, [missingMetricsCount, onRefresh, project?.id]);

  const runActivityRepair = useCallback(async (manual = false) => {
    if (!project?.id) return;
    if (!manual && orphanIndicators.length === 0) {
      setRepairState('done');
      setRepairInfo('Todos os indicadores já têm actividade (A) na hierarquia.');
      return;
    }
    setRepairState('running');
    setRepairInfo(null);
    try {
      const r = await fetch(`/api/projects/${project.id}/repair-indicator-activities`, { method: 'POST' });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.error || 'Erro na reparação');
      const msg = d.repaired > 0 || d.activitiesCreated > 0
        ? `Vínculos corrigidos: ${d.repaired} indicador(es) reparentados, ${d.activitiesCreated} actividade(s) criadas.`
        : d.message || 'Nenhuma alteração necessária.';
      setRepairInfo(msg);
      setRepairState('done');
      if ((d?.repaired ?? 0) > 0 || (d?.activitiesCreated ?? 0) > 0) onRefresh();
    } catch (e: unknown) {
      setRepairState('error');
      setRepairInfo(e instanceof Error ? e.message : 'Erro ao vincular actividades');
    }
  }, [project?.id, orphanIndicators.length, onRefresh]);

  useEffect(() => {
    runActivityRepair(false);
  }, [project?.id]); // eslint-disable-line react-hooks/exhaustive-deps -- uma vez por projeto

  useEffect(() => {
    if (missingMetricsCount > 0) runMetadataRepair(false);
  }, [project?.id]); // eslint-disable-line react-hooks/exhaustive-deps -- uma vez por projeto

  /* ---- Cascading dropdown filtered lists (P2) ---- */
  const cascadeFiltered = useMemo(() => {
    const oeList = byType.objective || [];
    const ocList = (byType.outcome || []).filter((o: any) => !cascadeOE || o.ancestors?.objective?.id === cascadeOE);
    const opList = (byType.output || []).filter((o: any) => {
      if (cascadeOC && o.ancestors?.outcome?.id !== cascadeOC) return false;
      if (!cascadeOC && cascadeOE && o.ancestors?.objective?.id !== cascadeOE) return false;
      return true;
    });
    const aList = (byType.activity || []).filter((o: any) => {
      if (cascadeOP && o.ancestors?.output?.id !== cascadeOP) return false;
      if (!cascadeOP && cascadeOC && o.ancestors?.outcome?.id !== cascadeOC) return false;
      if (!cascadeOP && !cascadeOC && cascadeOE && o.ancestors?.objective?.id !== cascadeOE) return false;
      return true;
    });
    // Indicators filtered similarly
    const indList = indicatorObjs.filter((o: any) => {
      const anc = hierarchyMap.get(o.id) || {} as any;
      if (cascadeA && anc.activity?.id !== cascadeA) return false;
      if (!cascadeA && cascadeOP && anc.output?.id !== cascadeOP) return false;
      if (!cascadeA && !cascadeOP && cascadeOC && anc.outcome?.id !== cascadeOC) return false;
      if (!cascadeA && !cascadeOP && !cascadeOC && cascadeOE && anc.objective?.id !== cascadeOE) return false;
      return true;
    });
    return { oeList, ocList, opList, aList, indList };
  }, [byType, indicatorObjs, hierarchyMap, cascadeOE, cascadeOC, cascadeOP, cascadeA]);

  const fetchMeasurements = useCallback(() => {
    const params = new URLSearchParams({ projectId: project.id });
    if (filterObjId) params.set('objectiveId', filterObjId);
    fetch(`/api/indicator-measurements?${params}`)
      .then(r => r.json())
      .then(d => { setMeasurements(d?.measurements ?? []); setMeasLoading(false); })
      .catch(() => setMeasLoading(false));
  }, [project.id, filterObjId]);

  useEffect(() => { fetchMeasurements(); }, [fetchMeasurements]);

  /* ---- Row editing helpers (P1) ---- */
  const startRowEdit = (obj: any) => {
    const metrics = resolveIndicatorMetrics(obj);
    setEditingRow(obj.id);
    setRowForm({
      indicator: obj.type === 'indicator' ? obj.title : (obj.indicator || obj.title || ''),
      unitOfMeasure: metrics.unitOfMeasure,
      baseline: metrics.baseline,
      target: metrics.target,
      actual: metrics.actual,
    });
  };

  const cancelRowEdit = () => { setEditingRow(null); setRowForm({}); };

  const saveRowEdit = async () => {
    if (!editingRow) return;
    setRowSaving(true);
    try {
      const obj = indicatorObjs.find(o => o.id === editingRow);
      const payload: any = { id: editingRow, actual: rowForm.actual };
      // For indicator-type objectives, title IS the indicator
      if (obj?.type === 'indicator') {
        payload.title = rowForm.indicator;
      } else {
        payload.indicator = rowForm.indicator;
      }
      payload.unitOfMeasure = rowForm.unitOfMeasure;
      payload.baseline = rowForm.baseline;
      payload.target = rowForm.target;
      // Apply pending parent reassignment
      if (pendingParentChange && pendingParentChange.objectiveId === editingRow) {
        payload.parentId = pendingParentChange.newParentId;
      }
      await fetch('/api/objectives', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      setEditingRow(null);
      setPendingParentChange(null);
      onRefresh();
    } catch (e) { console.error(e); }
    setRowSaving(false);
  };

  /* Reassign indicator to a different parent (hierarchy column dropdown) */
  const reassignParent = async (objectiveId: string, newParentId: string) => {
    try {
      await fetch('/api/objectives', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: objectiveId, parentId: newParentId }),
      });
      onRefresh();
    } catch (e) { console.error(e); }
  };

  /* ---- Measurement CRUD ---- */
  const closeMeasForm = () => {
    setShowMeasForm(false);
    setMeasContextObj(null);
  };

  const openMeasCreate = (objId?: string) => {
    if (objId) {
      const obj = indicatorObjs.find((o) => o.id === objId);
      const hierarchy = hierarchyMap.get(objId) || {};
      setMeasContextObj(obj || null);
      setCascadeOE(hierarchy.objective?.id || '');
      setCascadeOC(hierarchy.outcome?.id || '');
      setCascadeOP(hierarchy.output?.id || '');
      setCascadeA(hierarchy.activity?.id || '');
      setMeasForm({ objectiveId: objId, periodStart: '', periodEnd: '', value: '', notes: '', source: '' });
    } else {
      setMeasContextObj(null);
      setCascadeOE('');
      setCascadeOC('');
      setCascadeOP('');
      setCascadeA('');
      setMeasForm({ objectiveId: '', periodStart: '', periodEnd: '', value: '', notes: '', source: '' });
    }
    setShowMeasForm(true);
  };

  const handleMeasSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!measForm.objectiveId) return;
    if (!isValidMeasurementPeriodRange(measForm.periodStart, measForm.periodEnd)) {
      alert('La fecha de fin debe ser igual o posterior a la de inicio.');
      return;
    }
    const { periodStart, periodEnd, ...rest } = measForm;
    await fetch('/api/indicator-measurements', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId: project.id,
        ...rest,
        period: encodeMeasurementPeriod(periodStart, periodEnd),
      }),
    });
    closeMeasForm();
    fetchMeasurements();
    onRefresh();
  };

  const handleMeasDelete = async (id: string) => {
    if (!confirm('\u00bfEliminar esta medici\u00f3n?')) return;
    await fetch(`/api/indicator-measurements?id=${id}`, { method: 'DELETE' });
    fetchMeasurements();
  };

  const handleMeasStatus = async (id: string, status: string) => {
    await fetch('/api/indicator-measurements', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status }),
    });
    fetchMeasurements();
  };

  /* ---- Stats ---- */
  const indicatorStats = useMemo(() => {
    const total = indicatorObjs.length;
    const withMeasurements = new Set(measurements.map(m => m.objectiveId)).size;
    const onTrack = indicatorObjs.filter(o => {
      const target = parseFloat(o.target ?? '');
      const actual = parseFloat(o.actual ?? '');
      if (isNaN(target) || isNaN(actual) || target === 0) return false;
      return (actual / target) >= 0.7;
    }).length;
    return { total, withMeasurements, onTrack };
  }, [indicatorObjs, measurements]);

  const measByObj = useMemo(() => {
    const map = new Map<string, Measurement[]>();
    measurements.forEach(m => {
      if (!map.has(m.objectiveId)) map.set(m.objectiveId, []);
      map.get(m.objectiveId)!.push(m);
    });
    return map;
  }, [measurements]);

  return (
    <div className="space-y-4">
      {/* Summary Dashboard */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <p className="text-[10px] uppercase tracking-wide text-gray-500 font-medium">Indicadores</p>
          <p className="text-2xl font-bold text-indigo-700 mt-1">{indicatorStats.total}</p>
          <p className="text-[10px] text-gray-400">definidos en marco l&oacute;gico</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <p className="text-[10px] uppercase tracking-wide text-gray-500 font-medium">Con Mediciones</p>
          <p className="text-2xl font-bold text-blue-600 mt-1">{indicatorStats.withMeasurements}</p>
          <p className="text-[10px] text-gray-400">indicadores medidos</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <p className="text-[10px] uppercase tracking-wide text-gray-500 font-medium">En Meta</p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">{indicatorStats.onTrack}</p>
          <p className="text-[10px] text-gray-400">&ge;70% de la meta</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <p className="text-[10px] uppercase tracking-wide text-gray-500 font-medium">Mediciones</p>
          <p className="text-2xl font-bold text-purple-600 mt-1">{measurements.length}</p>
          <p className="text-[10px] text-gray-400">registros en el per&iacute;odo</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200">
        <div className="p-5">
            <div>
              {missingMetricsCount > 0 && (
                <div className={`mb-4 rounded-xl border px-4 py-3 flex flex-wrap items-center justify-between gap-3 ${
                  metaRepairState === 'error' ? 'bg-red-50 border-red-200' :
                  metaRepairState === 'done' && missingMetricsCount === 0 ? 'bg-emerald-50 border-emerald-200' :
                  'bg-sky-50 border-sky-200'
                }`}>
                  <div className="flex items-start gap-2 min-w-0">
                    {metaRepairState === 'running' ? (
                      <Loader2 className="w-4 h-4 animate-spin text-sky-600 mt-0.5 flex-shrink-0" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-sky-600 mt-0.5 flex-shrink-0" />
                    )}
                    <div className="text-xs text-gray-700">
                      <p className="font-medium">
                        {missingMetricsCount} indicador(es) sem unidade ou meta na base de dados.
                      </p>
                      {metaRepairInfo && <p className="mt-0.5 text-gray-600">{metaRepairInfo}</p>}
                      <p className="mt-0.5 text-sky-900">
                        Para valores exactos do documento, re-importe o marco lógico na aba Marco Lógico.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => runMetadataRepair(true)}
                    disabled={metaRepairState === 'running'}
                    className="text-xs px-3 py-1.5 rounded-lg bg-sky-600 text-white hover:bg-sky-700 disabled:opacity-50 whitespace-nowrap"
                  >
                    {metaRepairState === 'running' ? 'A preencher…' : 'Preencher unidade/meta'}
                  </button>
                </div>
              )}
              {(repairState !== 'idle' || orphanIndicators.length > 0) && (
                <div className={`mb-4 rounded-xl border px-4 py-3 flex flex-wrap items-center justify-between gap-3 ${
                  repairState === 'error' ? 'bg-red-50 border-red-200' :
                  orphanIndicators.length === 0 && repairState === 'done' ? 'bg-emerald-50 border-emerald-200' :
                  'bg-amber-50 border-amber-200'
                }`}>
                  <div className="flex items-start gap-2 min-w-0">
                    {repairState === 'running' ? (
                      <Loader2 className="w-4 h-4 animate-spin text-amber-600 mt-0.5 flex-shrink-0" />
                    ) : orphanIndicators.length === 0 ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                    )}
                    <div className="text-xs text-gray-700">
                      <p className="font-medium">
                        Hierarquia OE → OC → OP → <span className="text-orange-600 font-bold">A</span>:
                        {' '}{linkedCount}/{indicatorTypeCount || indicatorObjs.length} indicadores com actividade
                      </p>
                      {repairInfo && <p className="mt-0.5 text-gray-600">{repairInfo}</p>}
                      {orphanIndicators.length > 0 && repairState !== 'running' && (
                        <p className="mt-0.5 text-amber-800">{orphanIndicators.length} indicador(es) sem coluna A — clique para corrigir.</p>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => runActivityRepair(true)}
                    disabled={repairState === 'running'}
                    className="text-xs px-3 py-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 whitespace-nowrap"
                  >
                    {repairState === 'running' ? 'A vincular…' : 'Vincular actividades'}
                  </button>
                </div>
              )}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-gray-900">Seguimiento de Indicadores</h3>
                  <SectionTooltip content="Registre mediciones peri&oacute;dicas. Haga clic en el l&aacute;piz de cualquier fila para editar todos los campos del indicador (nombre, unidad, base, meta, actual). Las columnas OE/OC/OP/A muestran la jerarqu&iacute;a del marco l&oacute;gico." />
                </div>
                <div className="flex items-center gap-2">
                  {indicatorObjs.length > 0 && (
                    <select
                      value={filterObjId}
                      onChange={e => setFilterObjId(e.target.value)}
                      className="px-2 py-1.5 rounded-lg border text-xs text-gray-600"
                    >
                      <option value="">Todos los indicadores</option>
                      {indicatorObjs.map(o => (
                        <option key={o.id} value={o.id}>{o.code || o.type}: {(o.type === 'indicator' ? o.title : (o.indicator || o.title))?.substring(0, 40)}</option>
                      ))}
                    </select>
                  )}
                  <button onClick={() => openMeasCreate()} className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 transition">
                    <Plus className="w-4 h-4" />Medici&oacute;n
                  </button>
                </div>
              </div>

              {indicatorObjs.length === 0 ? (
                <div className="text-center py-10">
                  <Target className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-400">No hay indicadores definidos.</p>
                  <p className="text-xs text-gray-400 mt-1">Defina indicadores en el Marco L&oacute;gico primero.</p>
                </div>
              ) : measLoading ? (
                <div className="flex items-center justify-center py-8"><div className="w-6 h-6 border-2 border-indigo-600/30 border-t-indigo-600 rounded-full animate-spin" /></div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm table-fixed">
                    <colgroup>
                      {HIERARCHY_COLS.map(col => <col key={col.key} className="w-16" />)}
                      <col /> {/* Indicador — flexible */}
                      <col className="w-20" /> {/* Unidad */}
                      <col className="w-16" /> {/* Base */}
                      <col className="w-16" /> {/* Meta */}
                      <col className="w-16" /> {/* Actual */}
                      <col className="w-24" /> {/* Avance */}
                      <col className="w-14" /> {/* Med. */}
                      <col className="w-16" /> {/* Actions */}
                    </colgroup>
                    <thead>
                      <tr className="border-b-2 border-gray-200 text-left">
                        {HIERARCHY_COLS.map(col => (
                          <th key={col.key} className="py-2.5 px-1.5 font-semibold text-[10px] uppercase tracking-wide text-center">
                            <span className="relative group inline-block">
                              <span className="inline-block px-1.5 py-0.5 rounded text-white text-[9px] cursor-help" style={{ backgroundColor: col.color }}>
                                {col.abbr}
                              </span>
                              <span className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-1.5 whitespace-nowrap bg-gray-900 text-white text-[10px] rounded-md shadow-lg px-2 py-1 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
                                {col.full}
                                <span className="absolute top-full left-1/2 -translate-x-1/2 -mt-px w-2 h-2 bg-gray-900 rotate-45" />
                              </span>
                            </span>
                          </th>
                        ))}
                        <th className="py-2.5 px-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Indicador</th>
                        <th className="py-2.5 px-2 font-semibold text-gray-600 text-xs uppercase tracking-wide">Unidad</th>
                        <th className="py-2.5 px-2 font-semibold text-gray-600 text-xs uppercase tracking-wide text-right">Base</th>
                        <th className="py-2.5 px-2 font-semibold text-gray-600 text-xs uppercase tracking-wide text-right">Meta</th>
                        <th className="py-2.5 px-2 font-semibold text-gray-600 text-xs uppercase tracking-wide text-right">Actual</th>
                        <th className="py-2.5 px-2 font-semibold text-gray-600 text-xs uppercase tracking-wide text-center">Avance</th>
                        <th className="py-2.5 px-2 font-semibold text-gray-600 text-xs uppercase tracking-wide text-center">Med.</th>
                        <th className="py-2.5 px-1"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {indicatorObjs.filter(o => !filterObjId || o.id === filterObjId).map(obj => {
                        const objMeas = measByObj.get(obj.id) || [];
                        const metrics = resolveIndicatorMetrics(obj);
                        const target = parseFloat(metrics.target) || 0;
                        const actual = parseFloat(metrics.actual) || parseFloat(obj.actual ?? '') || 0;
                        const progress = target > 0 ? Math.min(Math.round((actual / target) * 100), 100) : 0;
                        const color = OBJ_COLORS[obj.type] || '#6b7280';
                        const indLabel = obj.type === 'indicator' ? obj.title : (obj.indicator || obj.title || 'Sin t\u00edtulo');
                        const isExpanded = expandedIndicator === obj.id;
                        const hierarchy = hierarchyMap.get(obj.id) || {};
                        const isEditingThis = editingRow === obj.id;

                        return (
                          <React.Fragment key={obj.id}>
                            <tr className={`border-b border-gray-100 hover:bg-gray-50/50 transition ${isExpanded ? 'bg-indigo-50/30' : ''} ${isEditingThis ? 'bg-amber-50/40' : ''}`}>
                              {/* Hierarchy code cells — with hover tooltip; editable dropdown in edit mode */}
                              {HIERARCHY_COLS.map(col => {
                                const ancestor = (hierarchy as any)[col.key];
                                const code = ancestor?.code || '';
                                const candidates = byType[col.key] || [];
                                return (
                                  <td key={col.key} className="py-2.5 px-1.5 text-center align-middle">
                                    {isEditingThis && candidates.length > 0 ? (
                                      <select
                                        className="w-full text-[9px] font-mono rounded border border-amber-300 bg-white px-0.5 py-0.5 focus:ring-1 focus:ring-amber-500 outline-none"
                                        value={ancestor?.id || ''}
                                        onChange={e => {
                                          if (e.target.value && e.target.value !== (ancestor?.id || '')) {
                                            reassignParent(obj.id, e.target.value);
                                          }
                                        }}
                                      >
                                        <option value="">&mdash;</option>
                                        {candidates.map((c: any) => (
                                          <option key={c.id} value={c.id}>{c.code || '??'} – {(c.title || '').slice(0, 30)}</option>
                                        ))}
                                      </select>
                                    ) : code ? (
                                      <CodeTooltip code={code} fullLabel={col.full} title={ancestor.title || ''} color={col.color} />
                                    ) : (
                                      <span className="text-gray-200 text-[10px]">&mdash;</span>
                                    )}
                                  </td>
                                );
                              })}

                              {/* Indicator name — editable (P1) */}
                              <td className="py-2.5 px-3">
                                {isEditingThis ? (
                                  <input
                                    value={rowForm.indicator}
                                    onChange={e => setRowForm({ ...rowForm, indicator: e.target.value })}
                                    className="w-full px-2 py-1 text-xs rounded border border-amber-300 focus:ring-1 focus:ring-amber-500 outline-none"
                                    autoFocus
                                  />
                                ) : (
                                  <span className="text-sm text-gray-800 line-clamp-2">{indLabel}</span>
                                )}
                              </td>

                              {/* Unit — editable (P1) */}
                              <td className="py-2.5 px-2">
                                {isEditingThis ? (
                                  <input value={rowForm.unitOfMeasure} onChange={e => setRowForm({ ...rowForm, unitOfMeasure: e.target.value })} className="w-20 px-1.5 py-0.5 text-xs rounded border border-amber-300 focus:ring-1 focus:ring-amber-500 outline-none" />
                                ) : (
                                  <span className="text-xs text-gray-500">{metrics.unitOfMeasure || '\u2014'}</span>
                                )}
                              </td>

                              {/* Baseline — editable (P1) */}
                              <td className="py-2.5 px-2 text-right">
                                {isEditingThis ? (
                                  <input value={rowForm.baseline} onChange={e => setRowForm({ ...rowForm, baseline: e.target.value })} className="w-16 px-1.5 py-0.5 text-xs rounded border border-amber-300 text-right focus:ring-1 focus:ring-amber-500 outline-none" />
                                ) : (
                                  <span className="text-xs text-gray-500">{metrics.baseline !== '' ? metrics.baseline : '\u2014'}</span>
                                )}
                              </td>

                              {/* Target — editable (P1) */}
                              <td className="py-2.5 px-2 text-right">
                                {isEditingThis ? (
                                  <input value={rowForm.target} onChange={e => setRowForm({ ...rowForm, target: e.target.value })} className="w-16 px-1.5 py-0.5 text-xs rounded border border-amber-300 text-right focus:ring-1 focus:ring-amber-500 outline-none" />
                                ) : (
                                  <span className="text-xs font-medium text-gray-700">{metrics.target !== '' ? metrics.target : '\u2014'}</span>
                                )}
                              </td>

                              {/* Actual — editable (P1) */}
                              <td className="py-2.5 px-2 text-right">
                                {isEditingThis ? (
                                  <input
                                    value={rowForm.actual}
                                    onChange={e => setRowForm({ ...rowForm, actual: e.target.value })}
                                    className="w-16 px-1.5 py-0.5 text-xs rounded border border-amber-300 text-right focus:ring-1 focus:ring-amber-500 outline-none"
                                    onKeyDown={e => { if (e.key === 'Enter') saveRowEdit(); if (e.key === 'Escape') cancelRowEdit(); }}
                                  />
                                ) : (
                                  <span className="text-xs font-medium text-gray-800">{obj.actual || <span className="text-gray-300">&mdash;</span>}</span>
                                )}
                              </td>

                              {/* Progress bar */}
                              <td className="py-2.5 px-2">
                                <div className="flex items-center gap-1.5 justify-center">
                                  <div className="w-14 h-2 bg-gray-200 rounded-full overflow-hidden">
                                    <div className="h-full rounded-full transition-all" style={{ width: `${progress}%`, backgroundColor: color }} />
                                  </div>
                                  <span className="text-[10px] font-medium w-7 text-right" style={{ color }}>{progress}%</span>
                                </div>
                              </td>

                              {/* Measurements count */}
                              <td className="py-2.5 px-2 text-center">
                                <button
                                  onClick={() => setExpandedIndicator(isExpanded ? null : obj.id)}
                                  className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium transition ${objMeas.length > 0 ? 'bg-blue-100 text-blue-700 hover:bg-blue-200' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}
                                >
                                  {objMeas.length}
                                  {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                </button>
                              </td>

                              {/* Actions (P1) */}
                              <td className="py-2.5 px-1">
                                {isEditingThis ? (
                                  <div className="flex items-center gap-0.5">
                                    <button onClick={saveRowEdit} disabled={rowSaving} className="p-1 rounded hover:bg-emerald-50 text-emerald-600" title="Guardar"><Check className="w-3.5 h-3.5" /></button>
                                    <button onClick={cancelRowEdit} className="p-1 rounded hover:bg-gray-100 text-gray-400"><X className="w-3.5 h-3.5" /></button>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-0.5">
                                    <button onClick={() => startRowEdit(obj)} className="p-1 rounded hover:bg-amber-50 text-gray-400 hover:text-amber-600" title="Editar fila completa"><Pencil className="w-3.5 h-3.5" /></button>
                                    <button onClick={() => openMeasCreate(obj.id)} className="p-1 rounded hover:bg-indigo-50 text-gray-400 hover:text-indigo-600" title="Agregar medici&oacute;n"><Plus className="w-3.5 h-3.5" /></button>
                                  </div>
                                )}
                              </td>
                            </tr>

                            {/* Expanded measurements sub-rows */}
                            {isExpanded && objMeas.length > 0 && objMeas.map(m => {
                              const st = STATUS_CONFIG[m.status] || STATUS_CONFIG.reported;
                              return (
                                <tr key={m.id} className="bg-indigo-50/20 border-b border-gray-50 group">
                                  <td colSpan={4} /> {/* OE OC OP A */}
                                  <td className="py-2 px-3 text-xs text-gray-500" colSpan={2}> {/* Indicador + Unidad */}
                                    <span>{displayMeasurementPeriod(m.period)}</span>
                                    {m.source && <span className="ml-2 text-gray-400">({m.source})</span>}
                                  </td>
                                  <td className="py-2 px-2" colSpan={2}> {/* Base + Meta */}
                                    {m.notes && <span className="text-[10px] text-gray-400 italic truncate block">{m.notes}</span>}
                                  </td>
                                  <td className="py-2 px-2 text-right text-xs font-medium text-gray-800">{m.value}</td> {/* Actual */}
                                  <td className="py-2 px-2 text-center"> {/* Avance */}
                                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${st.bg} ${st.text}`}>{st.label}</span>
                                  </td>
                                  <td className="py-2 px-1" colSpan={2}> {/* Med. + Actions */}
                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition justify-end">
                                      {m.status === 'reported' && (
                                        <button onClick={() => handleMeasStatus(m.id, 'verified')} className="p-1 rounded hover:bg-emerald-50 text-gray-400 hover:text-emerald-600" title="Verificar">
                                          <CheckCircle2 className="w-3.5 h-3.5" />
                                        </button>
                                      )}
                                      <button onClick={() => handleMeasDelete(m.id)} className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-600">
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                            {isExpanded && objMeas.length === 0 && (
                              <tr className="bg-gray-50/30 border-b border-gray-50">
                                <td colSpan={12} className="py-2 px-10 text-[10px] text-gray-400 italic">Sin mediciones registradas</td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
        </div>
      </div>

      {/* Measurement Form Modal (P2 — cascading dropdowns) */}
      {showMeasForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b">
              <h2 className="text-lg font-semibold">
                {measContextObj ? 'Nueva medici\u00f3n' : 'Nueva medici\u00f3n de indicador'}
              </h2>
              <button type="button" onClick={closeMeasForm}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <form onSubmit={handleMeasSave} className="p-5 space-y-4">
              {measContextObj ? (
                <div className="rounded-lg border border-indigo-100 bg-indigo-50/60 p-3 space-y-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-indigo-800">
                    Indicador de la fila
                  </p>
                  <p className="text-sm font-medium text-gray-900 leading-snug">
                    {measContextObj.type === 'indicator'
                      ? measContextObj.title
                      : (measContextObj.indicator || measContextObj.title)}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {HIERARCHY_COLS.map((col) => {
                      const anc = (hierarchyMap.get(measContextObj.id) || {} as any)[col.key];
                      if (!anc?.code) return null;
                      return (
                        <span
                          key={col.key}
                          className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-mono text-white"
                          style={{ backgroundColor: col.color }}
                          title={anc.title}
                        >
                          {col.abbr}: {anc.code}
                        </span>
                      );
                    })}
                  </div>
                  {(() => {
                    const m = resolveIndicatorMetrics(measContextObj);
                    if (!m.unitOfMeasure && m.target === '') return null;
                    return (
                      <p className="text-xs text-gray-600">
                        {m.unitOfMeasure ? `Unidad: ${m.unitOfMeasure}` : ''}
                        {m.unitOfMeasure && m.target !== '' ? ' · ' : ''}
                        {m.target !== '' ? `Meta: ${m.target}` : ''}
                      </p>
                    );
                  })()}
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-[10px] font-medium text-gray-500 uppercase tracking-wide mb-2">Filtrar por jerarqu&iacute;a (opcional)</label>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] text-gray-400 mb-0.5">OE - Objetivo</label>
                        <select value={cascadeOE} onChange={e => { setCascadeOE(e.target.value); setCascadeOC(''); setCascadeOP(''); setCascadeA(''); }} className="w-full px-2 py-1.5 rounded-lg border text-xs">
                          <option value="">Todos</option>
                          {cascadeFiltered.oeList.map((o: any) => <option key={o.id} value={o.id}>{o.code || 'OE'}: {o.title?.substring(0, 35)}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] text-gray-400 mb-0.5">OC - Resultado</label>
                        <select value={cascadeOC} onChange={e => { setCascadeOC(e.target.value); setCascadeOP(''); setCascadeA(''); }} className="w-full px-2 py-1.5 rounded-lg border text-xs">
                          <option value="">Todos</option>
                          {cascadeFiltered.ocList.map((o: any) => <option key={o.id} value={o.id}>{o.code || 'OC'}: {o.title?.substring(0, 35)}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] text-gray-400 mb-0.5">OP - Producto</label>
                        <select value={cascadeOP} onChange={e => { setCascadeOP(e.target.value); setCascadeA(''); }} className="w-full px-2 py-1.5 rounded-lg border text-xs">
                          <option value="">Todos</option>
                          {cascadeFiltered.opList.map((o: any) => <option key={o.id} value={o.id}>{o.code || 'OP'}: {o.title?.substring(0, 35)}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] text-gray-400 mb-0.5">A - Actividad</label>
                        <select value={cascadeA} onChange={e => setCascadeA(e.target.value)} className="w-full px-2 py-1.5 rounded-lg border text-xs">
                          <option value="">Todas</option>
                          {cascadeFiltered.aList.map((o: any) => <option key={o.id} value={o.id}>{o.code || 'A'}: {o.title?.substring(0, 35)}</option>)}
                        </select>
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Indicador *</label>
                    <select required value={measForm.objectiveId} onChange={e => setMeasForm({ ...measForm, objectiveId: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-sm">
                      <option value="">Seleccionar indicador...</option>
                      {cascadeFiltered.indList.map((o: any) => (
                        <option key={o.id} value={o.id}>[{o.code || o.type}] {(o.type === 'indicator' ? o.title : o.indicator)?.substring(0, 60)}</option>
                      ))}
                    </select>
                  </div>
                </>
              )}
              <input type="hidden" value={measForm.objectiveId} readOnly />
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Fecha inicio *</label>
                  <input
                    type="date"
                    required
                    autoFocus={Boolean(measContextObj)}
                    value={measForm.periodStart}
                    onChange={e => setMeasForm({ ...measForm, periodStart: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Fecha fin *</label>
                  <input
                    type="date"
                    required
                    value={measForm.periodEnd}
                    min={measForm.periodStart || undefined}
                    onChange={e => setMeasForm({ ...measForm, periodEnd: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Valor medido *</label>
                <input required value={measForm.value} onChange={e => setMeasForm({ ...measForm, value: e.target.value })} placeholder="150, 85%, 3.2..." className="w-full px-3 py-2 rounded-lg border text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Fuente de datos</label>
                <input value={measForm.source} onChange={e => setMeasForm({ ...measForm, source: e.target.value })} placeholder="Encuesta, registro, sistema..." className="w-full px-3 py-2 rounded-lg border text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Notas / Observaciones</label>
                <textarea value={measForm.notes} onChange={e => setMeasForm({ ...measForm, notes: e.target.value })} rows={2} className="w-full px-3 py-2 rounded-lg border text-sm" placeholder="Contexto, limitaciones..." />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={closeMeasForm} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">{tr('general.cancel')}</button>
                <button type="submit" className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium flex items-center gap-2">
                  <Save className="w-4 h-4" />{tr('general.create')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
