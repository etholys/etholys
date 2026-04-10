'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import ReactDOM from 'react-dom';
import { SectionProps } from './types';
import { SectionTooltip } from './SectionTooltip';
import { formatDate } from '@/lib/utils';
import {
  BarChart3, Plus, X, Save, Edit2, Trash2, ChevronDown, ChevronRight,
  Target, TrendingUp, FileText, AlertCircle, CheckCircle2, Clock,
  Eye, Filter, Pencil, Check, Info,
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

interface MEReportItem {
  id: string;
  title: string;
  type: string;
  period: string | null;
  content: string;
  findings: string | null;
  recommendations: string | null;
  status: string;
  reportDate: string;
}

const REPORT_TYPES = [
  { value: 'progress', label: 'Informe de Progreso', icon: '\ud83d\udcc8' },
  { value: 'midterm', label: 'Evaluaci\u00f3n de Medio T\u00e9rmino', icon: '\ud83d\udccb' },
  { value: 'final', label: 'Evaluaci\u00f3n Final', icon: '\ud83c\udfc1' },
  { value: 'evaluation', label: 'Evaluaci\u00f3n de Impacto', icon: '\ud83d\udd0d' },
  { value: 'lessons_learned', label: 'Lecciones Aprendidas', icon: '\ud83d\udca1' },
];

const getReportTypeInfo = (type: string) => REPORT_TYPES.find(t => t.value === type) || REPORT_TYPES[0];

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
  const [activeTab, setActiveTab] = useState<'indicators' | 'reports'>('indicators');

  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [measLoading, setMeasLoading] = useState(true);
  const [showMeasForm, setShowMeasForm] = useState(false);
  const [measForm, setMeasForm] = useState<any>({ objectiveId: '', period: '', value: '', notes: '', source: '' });
  const [filterObjId, setFilterObjId] = useState<string>('');

  const [reports, setReports] = useState<MEReportItem[]>([]);
  const [reportsLoading, setReportsLoading] = useState(true);
  const [showReportForm, setShowReportForm] = useState(false);
  const [editReport, setEditReport] = useState<MEReportItem | null>(null);
  const [reportForm, setReportForm] = useState<any>({
    title: '', type: 'progress', period: '', content: '', findings: '', recommendations: '', reportDate: '',
  });
  const [expandedReport, setExpandedReport] = useState<string | null>(null);
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

  // Build hierarchy map + typed lists for cascading
  const { allObjectives, indicatorObjs, hierarchyMap, byType } = useMemo(() => {
    const all: any[] = [];
    const hmap = new Map<string, Record<string, { code: string; title: string }>>(); // objId -> { objective: {code,title}, outcome: ... }
    const byTypeMap: Record<string, any[]> = { objective: [], outcome: [], output: [], activity: [], indicator: [], deliverable: [] };
    const walk = (objs: any[], depth: number, ancestors: Record<string, { code: string; title: string; id: string }>) => {
      (objs ?? []).forEach((o: any) => {
        const myAncestors = { ...ancestors };
        if (o.type && o.type !== 'indicator') {
          myAncestors[o.type] = { code: o.code || '', title: o.title || '', id: o.id };
        }
        all.push({ ...o, depth, ancestors: myAncestors });
        hmap.set(o.id, myAncestors);
        if (byTypeMap[o.type]) byTypeMap[o.type].push({ ...o, ancestors: myAncestors });
        if (o.children?.length) walk(o.children, depth + 1, myAncestors);
      });
    };
    walk(project?.objectives ?? [], 0, {});
    /* Show only actual indicators — type==='indicator' or legacy nodes with an indicator text field */
    const trackable = all.filter(o => o.type === 'indicator' || (o.indicator && o.indicator.trim()));
    return { allObjectives: all, indicatorObjs: trackable, hierarchyMap: hmap, byType: byTypeMap };
  }, [project?.objectives]);

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

  const fetchReports = useCallback(() => {
    fetch(`/api/me-reports?projectId=${project.id}`)
      .then(r => r.json())
      .then(d => { setReports(d?.reports ?? []); setReportsLoading(false); })
      .catch(() => setReportsLoading(false));
  }, [project.id]);

  useEffect(() => { fetchMeasurements(); }, [fetchMeasurements]);
  useEffect(() => { fetchReports(); }, [fetchReports]);

  /* ---- Row editing helpers (P1) ---- */
  const startRowEdit = (obj: any) => {
    setEditingRow(obj.id);
    setRowForm({
      indicator: obj.type === 'indicator' ? obj.title : (obj.indicator || obj.title || ''),
      unitOfMeasure: obj.unitOfMeasure || '',
      baseline: obj.baseline || '',
      target: obj.target || '',
      actual: obj.actual || '',
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
  const openMeasCreate = (objId?: string) => {
    // Reset cascade
    setCascadeOE(''); setCascadeOC(''); setCascadeOP(''); setCascadeA('');
    setMeasForm({ objectiveId: objId || '', period: '', value: '', notes: '', source: '' });
    setShowMeasForm(true);
  };

  const handleMeasSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch('/api/indicator-measurements', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId: project.id, ...measForm }),
    });
    setShowMeasForm(false);
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

  /* ---- Report CRUD ---- */
  const openReportCreate = () => {
    setEditReport(null);
    setReportForm({ title: '', type: 'progress', period: '', content: '', findings: '', recommendations: '', reportDate: '' });
    setShowReportForm(true);
  };

  const openReportEdit = (r: MEReportItem) => {
    setEditReport(r);
    setReportForm({
      title: r.title, type: r.type, period: r.period || '',
      content: r.content, findings: r.findings || '',
      recommendations: r.recommendations || '',
      reportDate: r.reportDate ? new Date(r.reportDate).toISOString().split('T')[0] : '',
    });
    setShowReportForm(true);
  };

  const handleReportSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editReport) {
      await fetch('/api/me-reports', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: editReport.id, ...reportForm }) });
    } else {
      await fetch('/api/me-reports', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ projectId: project.id, ...reportForm }) });
    }
    setShowReportForm(false);
    fetchReports();
  };

  const handleReportDelete = async (id: string) => {
    if (!confirm('\u00bfEliminar este reporte?')) return;
    await fetch(`/api/me-reports?id=${id}`, { method: 'DELETE' });
    fetchReports();
  };

  const handleReportStatus = async (id: string, status: string) => {
    await fetch('/api/me-reports', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, status }) });
    fetchReports();
  };

  /* ---- Stats ---- */
  const indicatorStats = useMemo(() => {
    const total = indicatorObjs.length;
    const withMeasurements = new Set(measurements.map(m => m.objectiveId)).size;
    const onTrack = indicatorObjs.filter(o => {
      const target = parseFloat(o.target);
      const actual = parseFloat(o.actual);
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
          <p className="text-[10px] uppercase tracking-wide text-gray-500 font-medium">Reportes M&amp;E</p>
          <p className="text-2xl font-bold text-purple-600 mt-1">{reports.length}</p>
          <p className="text-[10px] text-gray-400">{reports.filter(r => r.status === 'approved').length} aprobados</p>
        </div>
      </div>

      {/* Tab Switcher */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setActiveTab('indicators')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition ${activeTab === 'indicators' ? 'text-indigo-700 border-b-2 border-indigo-600 bg-indigo-50/50' : 'text-gray-500 hover:text-gray-700'}`}
          >
            <Target className="w-4 h-4 inline mr-1.5" />Indicadores y Mediciones
            {measurements.length > 0 && <span className="ml-1.5 text-[10px] bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded-full">{measurements.length}</span>}
          </button>
          <button
            onClick={() => setActiveTab('reports')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition ${activeTab === 'reports' ? 'text-indigo-700 border-b-2 border-indigo-600 bg-indigo-50/50' : 'text-gray-500 hover:text-gray-700'}`}
          >
            <FileText className="w-4 h-4 inline mr-1.5" />Reportes M&amp;E
            {reports.length > 0 && <span className="ml-1.5 text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full">{reports.length}</span>}
          </button>
        </div>

        <div className="p-5">
          {/* === INDICATORS TAB === */}
          {activeTab === 'indicators' && (
            <div>
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
                        const target = parseFloat(obj.target) || 0;
                        const actual = parseFloat(obj.actual) || 0;
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
                                  <span className="text-xs text-gray-500">{obj.unitOfMeasure || '\u2014'}</span>
                                )}
                              </td>

                              {/* Baseline — editable (P1) */}
                              <td className="py-2.5 px-2 text-right">
                                {isEditingThis ? (
                                  <input value={rowForm.baseline} onChange={e => setRowForm({ ...rowForm, baseline: e.target.value })} className="w-16 px-1.5 py-0.5 text-xs rounded border border-amber-300 text-right focus:ring-1 focus:ring-amber-500 outline-none" />
                                ) : (
                                  <span className="text-xs text-gray-500">{obj.baseline || '\u2014'}</span>
                                )}
                              </td>

                              {/* Target — editable (P1) */}
                              <td className="py-2.5 px-2 text-right">
                                {isEditingThis ? (
                                  <input value={rowForm.target} onChange={e => setRowForm({ ...rowForm, target: e.target.value })} className="w-16 px-1.5 py-0.5 text-xs rounded border border-amber-300 text-right focus:ring-1 focus:ring-amber-500 outline-none" />
                                ) : (
                                  <span className="text-xs font-medium text-gray-700">{obj.target || '\u2014'}</span>
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
                                    <span className="font-mono">{m.period}</span>
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
          )}

          {/* === REPORTS TAB === */}
          {activeTab === 'reports' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-gray-900">Reportes de M&amp;E</h3>
                  <SectionTooltip content="Documentaci&oacute;n de informes peri&oacute;dicos, evaluaciones intermedias/finales y lecciones aprendidas." />
                </div>
                <button onClick={openReportCreate} className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 transition">
                  <Plus className="w-4 h-4" />Reporte
                </button>
              </div>

              {reportsLoading ? (
                <div className="flex items-center justify-center py-8"><div className="w-6 h-6 border-2 border-indigo-600/30 border-t-indigo-600 rounded-full animate-spin" /></div>
              ) : reports.length === 0 ? (
                <div className="text-center py-10">
                  <FileText className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-400">Sin reportes M&amp;E a&uacute;n.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {reports.map(r => {
                    const typeInfo = getReportTypeInfo(r.type);
                    const st = STATUS_CONFIG[r.status] || STATUS_CONFIG.draft;
                    const isExpanded = expandedReport === r.id;
                    return (
                      <div key={r.id} className="border border-gray-100 rounded-lg overflow-hidden">
                        <button
                          onClick={() => setExpandedReport(isExpanded ? null : r.id)}
                          className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition group"
                        >
                          <span className="text-lg flex-shrink-0">{typeInfo.icon}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">{r.title}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[10px] text-gray-400">{typeInfo.label}</span>
                              {r.period && <span className="text-[10px] text-gray-400">&middot; {r.period}</span>}
                              <span className="text-[10px] text-gray-400">&middot; {formatDate(r.reportDate)}</span>
                            </div>
                          </div>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${st.bg} ${st.text}`}>{st.label}</span>
                          {isExpanded ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                        </button>
                        {isExpanded && (
                          <div className="border-t border-gray-100 px-5 py-4 space-y-3">
                            {r.content && (
                              <div>
                                <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wide mb-1">Contenido</p>
                                <div className="text-sm text-gray-700 whitespace-pre-wrap bg-gray-50 rounded-lg p-3">{r.content}</div>
                              </div>
                            )}
                            {r.findings && (
                              <div>
                                <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wide mb-1">Hallazgos</p>
                                <div className="text-sm text-gray-700 whitespace-pre-wrap bg-blue-50 rounded-lg p-3 border border-blue-100">{r.findings}</div>
                              </div>
                            )}
                            {r.recommendations && (
                              <div>
                                <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wide mb-1">Recomendaciones</p>
                                <div className="text-sm text-gray-700 whitespace-pre-wrap bg-amber-50 rounded-lg p-3 border border-amber-100">{r.recommendations}</div>
                              </div>
                            )}
                            <div className="flex justify-between items-center pt-2 border-t border-gray-100">
                              <div className="flex gap-2">
                                {r.status === 'draft' && <button onClick={() => handleReportStatus(r.id, 'submitted')} className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"><TrendingUp className="w-3 h-3" />Enviar</button>}
                                {r.status === 'submitted' && <button onClick={() => handleReportStatus(r.id, 'approved')} className="text-xs text-emerald-600 hover:text-emerald-700 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" />Aprobar</button>}
                              </div>
                              <div className="flex gap-2">
                                <button onClick={() => openReportEdit(r)} className="text-xs text-indigo-600 hover:text-indigo-700 flex items-center gap-1"><Edit2 className="w-3 h-3" />Editar</button>
                                <button onClick={() => handleReportDelete(r.id)} className="text-xs text-red-400 hover:text-red-600 flex items-center gap-1"><Trash2 className="w-3 h-3" />Eliminar</button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Measurement Form Modal (P2 — cascading dropdowns) */}
      {showMeasForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b">
              <h2 className="text-lg font-semibold">Nueva Medici&oacute;n de Indicador</h2>
              <button onClick={() => setShowMeasForm(false)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <form onSubmit={handleMeasSave} className="p-5 space-y-4">
              {/* Cascading dropdowns (P2) */}
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
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Per&iacute;odo *</label>
                  <input required value={measForm.period} onChange={e => setMeasForm({ ...measForm, period: e.target.value })} placeholder="2025-Q1, Y1, Mar-2025..." className="w-full px-3 py-2 rounded-lg border text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Valor medido *</label>
                  <input required value={measForm.value} onChange={e => setMeasForm({ ...measForm, value: e.target.value })} placeholder="150, 85%, 3.2..." className="w-full px-3 py-2 rounded-lg border text-sm" />
                </div>
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
                <button type="button" onClick={() => setShowMeasForm(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">{tr('general.cancel')}</button>
                <button type="submit" className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium flex items-center gap-2">
                  <Save className="w-4 h-4" />{tr('general.create')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Report Form Modal */}
      {showReportForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b">
              <h2 className="text-lg font-semibold">{editReport ? 'Editar' : 'Nuevo'} Reporte M&amp;E</h2>
              <button onClick={() => setShowReportForm(false)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <form onSubmit={handleReportSave} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">T&iacute;tulo *</label>
                <input required value={reportForm.title} onChange={e => setReportForm({ ...reportForm, title: e.target.value })} placeholder="Informe de Progreso Q1 2025" className="w-full px-3 py-2 rounded-lg border text-sm" />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Tipo</label>
                  <select value={reportForm.type} onChange={e => setReportForm({ ...reportForm, type: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-sm">
                    {REPORT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Per&iacute;odo</label>
                  <input value={reportForm.period} onChange={e => setReportForm({ ...reportForm, period: e.target.value })} placeholder="Q1 2025" className="w-full px-3 py-2 rounded-lg border text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Fecha</label>
                  <input type="date" value={reportForm.reportDate} onChange={e => setReportForm({ ...reportForm, reportDate: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Contenido</label>
                <textarea value={reportForm.content} onChange={e => setReportForm({ ...reportForm, content: e.target.value })} rows={5} className="w-full px-3 py-2 rounded-lg border text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Hallazgos Clave</label>
                <textarea value={reportForm.findings} onChange={e => setReportForm({ ...reportForm, findings: e.target.value })} rows={3} className="w-full px-3 py-2 rounded-lg border text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Recomendaciones</label>
                <textarea value={reportForm.recommendations} onChange={e => setReportForm({ ...reportForm, recommendations: e.target.value })} rows={3} className="w-full px-3 py-2 rounded-lg border text-sm" />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowReportForm(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">{tr('general.cancel')}</button>
                <button type="submit" className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium flex items-center gap-2">
                  <Save className="w-4 h-4" />{editReport ? tr('general.save') : tr('general.create')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
