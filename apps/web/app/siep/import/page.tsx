'use client';
import { useApp } from '@/app/providers';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Upload, FileText, FileSpreadsheet, File, X, Sparkles, ChevronRight,
  ChevronDown, AlertCircle, CheckCircle2, Loader2, ArrowLeft, ArrowRight,
  Edit3, Trash2, Plus, Building2, DollarSign, Target, ShieldAlert,
  Calendar, ClipboardList, Eye, Check, Info
} from 'lucide-react';
import { cn } from '@/lib/utils';

/* ─── types ─── */
type Confidence = 'high' | 'medium' | 'low';
type Step = 'upload' | 'processing' | 'preview' | 'success';

interface IndicatorItem {
  name: string; unit: string; baseline: string; target: string;
}
interface DiagnosticItem {
  type: string; code: string; title: string; description: string;
}
interface ExtractedData {
  project: {
    name: string; description: string; goal: string; donorName: string;
    country: string; region: string; currency: string;
    budget: number; startDate: string | null; endDate: string | null;
  };
  sow: { sectionKey: string; title: string; content: string; items?: string[] }[];
  objectives: ObjNode[];
  diagnostics: DiagnosticItem[];
  budgetLines: BudgetLine[];
  risks: RiskItem[];
  milestones: MilestoneItem[];
  activities?: ActivityItem[];
  confidence: Record<string, Confidence>;
}
interface ObjNode {
  type: string; code: string; title: string; description: string;
  indicator: string | null; baseline: string | null; target: string | null;
  indicators?: IndicatorItem[];
  startDate?: string | null; endDate?: string | null;
  children?: ObjNode[];
}
interface ActivityItem {
  code: string; title: string; startDate: string | null; endDate: string | null;
}
interface BudgetLine {
  category: string; description: string; unit: string;
  quantity: number; unitCost: number; total: number;
  narrative: string; fundSource: string;
}
interface RiskItem {
  title: string; description: string; level: string;
  impact: string; mitigation: string;
}
interface MilestoneItem {
  name: string; description: string | null; dueDate: string | null;
}

/* ─── helpers ─── */
const FILE_ICONS: Record<string, any> = {
  'application/pdf': FileText,
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': FileText,
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': FileSpreadsheet,
  'text/csv': FileSpreadsheet,
};
const confBadge = (c: Confidence) => {
  const map: Record<Confidence, { icon: string; cls: string; label: string }> = {
    high: { icon: '\u2705', cls: 'bg-emerald-100 text-emerald-700', label: 'Alta' },
    medium: { icon: '\u26A0\uFE0F', cls: 'bg-amber-100 text-amber-700', label: 'Media' },
    low: { icon: '\u26D4', cls: 'bg-red-100 text-red-700', label: 'Baja' },
  };
  const m = map[c] || map.low;
  return <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium', m.cls)}>{m.icon} Confianza {m.label}</span>;
};
const fmtCurrency = (n: number, cur: string) =>
  new Intl.NumberFormat('es-UY', { style: 'currency', currency: cur || 'USD', maximumFractionDigits: 0 }).format(n);
const fmtSize = (b: number) => b < 1024 ? `${b} B` : b < 1048576 ? `${(b / 1024).toFixed(1)} KB` : `${(b / 1048576).toFixed(1)} MB`;

const CATEGORY_LABELS: Record<string, string> = {
  personnel: 'Personal', fringe: 'Beneficios', travel: 'Viajes',
  equipment: 'Equipamiento', supplies: 'Suministros', contractual: 'Contractual',
  other_direct: 'Otros directos', indirect: 'Indirectos',
};
const LEVEL_COLORS: Record<string, string> = {
  LOW: 'bg-green-100 text-green-700', MEDIUM: 'bg-yellow-100 text-yellow-700',
  HIGH: 'bg-orange-100 text-orange-700', CRITICAL: 'bg-red-100 text-red-700',
};

/* ═══ MAIN PAGE ═══ */

type ML = { es: string; pt: string; en: string };
const ml = (en: string, es: string, pt: string): ML => ({ en, es, pt });
export default function SmartImportPage() {
  const { locale } = useApp();
  const L = (m: ML) => m[locale] || m.en;
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>('upload');
  const [files, setFiles] = useState<File[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [companyId, setCompanyId] = useState('');
  const [error, setError] = useState('');
  const [processing, setProcessing] = useState(false);
  const [processingMsg, setProcessingMsg] = useState('');
  const [extracted, setExtracted] = useState<ExtractedData | null>(null);
  const [activeTab, setActiveTab] = useState('project');
  const [createdProject, setCreatedProject] = useState<any>(null);
  const [createdResults, setCreatedResults] = useState<Record<string, number>>({});
  const [confirming, setConfirming] = useState(false);

  // Fetch companies
  useEffect(() => {
    fetch('/api/companies').then(r => r.json()).then(d => {
      const list = d?.companies ?? [];
      setCompanies(list);
      if (list.length === 1) setCompanyId(list[0].id);
    }).catch(() => {});
  }, []);

  /* ─── file handling ─── */
  const ACCEPTED = '.pdf,.docx,.xlsx,.csv,.txt,.doc,.xls';
  const addFiles = useCallback((incoming: FileList | File[]) => {
    const arr = Array.from(incoming);
    setFiles(prev => {
      const names = new Set(prev.map(f => f.name));
      return [...prev, ...arr.filter(f => !names.has(f.name))];
    });
    setError('');
  }, []);
  const removeFile = (name: string) => setFiles(prev => prev.filter(f => f.name !== name));

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
  }, [addFiles]);

  /* ─── analyze ─── */
  const handleAnalyze = async () => {
    if (files.length === 0) { setError('Agregue al menos un archivo'); return; }
    if (!companyId) { setError('Seleccione una organizaci\u00f3n'); return; }

    setStep('processing');
    setProcessing(true);
    setError('');

    const msgs = [
      'Leyendo documentos...',
      'Identificando estructura del proyecto...',
      'Extrayendo marco l\u00f3gico...',
      'Analizando presupuesto...',
      'Evaluando riesgos...',
      'Generando estructura completa...',
    ];
    let msgIdx = 0;
    setProcessingMsg(msgs[0]);
    const interval = setInterval(() => {
      msgIdx = Math.min(msgIdx + 1, msgs.length - 1);
      setProcessingMsg(msgs[msgIdx]);
    }, 4000);

    try {
      const fd = new FormData();
      files.forEach(f => fd.append('files', f));

      const res = await fetch('/api/import/analyze', { method: 'POST', body: fd });
      clearInterval(interval);

      if (!res.ok) {
        const err = await res.json().catch(() => ({} as Record<string, string>));
        const lines = [
          err.error,
          err.detail && `Detalhe: ${err.detail}`,
          err.rawPreview && `Prévia da resposta: ${err.rawPreview}`,
          err.geminiModel && `Modelo Gemini: ${err.geminiModel}`,
          err.hint && `Dica: ${err.hint}`,
        ].filter(Boolean);
        throw new Error(lines.length ? lines.join('\n\n') : 'Erro ao analisar arquivos');
      }

      const data = await res.json();
      setExtracted(data.extracted);
      setStep('preview');
    } catch (err: any) {
      clearInterval(interval);
      setError(err.message || 'Error inesperado');
      setStep('upload');
    } finally {
      setProcessing(false);
    }
  };

  /* ─── confirm / create ─── */
  const handleConfirm = async () => {
    if (!extracted || !companyId) return;
    setConfirming(true);
    setError('');

    try {
      const res = await fetch('/api/import/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, ...extracted }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Error al crear proyecto');
      }
      const data = await res.json();
      setCreatedProject(data.project);
      setCreatedResults(data.results || {});
      setStep('success');
    } catch (err: any) {
      setError(err.message || 'Error inesperado');
    } finally {
      setConfirming(false);
    }
  };

  /* ─── inline edit helpers ─── */
  const updateProject = (field: string, value: any) => {
    if (!extracted) return;
    setExtracted({ ...extracted, project: { ...extracted.project, [field]: value } });
  };
  const updateBudgetLine = (idx: number, field: string, value: any) => {
    if (!extracted) return;
    const lines = [...extracted.budgetLines];
    (lines[idx] as any)[field] = value;
    if (field === 'quantity' || field === 'unitCost') {
      lines[idx].total = (lines[idx].quantity || 0) * (lines[idx].unitCost || 0);
    }
    setExtracted({ ...extracted, budgetLines: lines });
  };
  const removeBudgetLine = (idx: number) => {
    if (!extracted) return;
    setExtracted({ ...extracted, budgetLines: extracted.budgetLines.filter((_, i) => i !== idx) });
  };
  const updateRisk = (idx: number, field: string, value: any) => {
    if (!extracted) return;
    const items = [...extracted.risks];
    (items[idx] as any)[field] = value;
    setExtracted({ ...extracted, risks: items });
  };
  const removeRisk = (idx: number) => {
    if (!extracted) return;
    setExtracted({ ...extracted, risks: extracted.risks.filter((_, i) => i !== idx) });
  };
  const updateMilestone = (idx: number, field: string, value: any) => {
    if (!extracted) return;
    const items = [...extracted.milestones];
    (items[idx] as any)[field] = value;
    setExtracted({ ...extracted, milestones: items });
  };
  const removeMilestone = (idx: number) => {
    if (!extracted) return;
    setExtracted({ ...extracted, milestones: extracted.milestones.filter((_, i) => i !== idx) });
  };

  /* ═══ STEP: UPLOAD ═══ */
  const renderUpload = () => (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Company selector */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Organizaci&oacute;n</label>
        <select
          value={companyId}
          onChange={e => setCompanyId(e.target.value)}
          className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
        >
          <option value="">Seleccionar organizaci&oacute;n...</option>
          {companies.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {/* Drop zone */}
      <div
        onDrop={onDrop}
        onDragOver={e => e.preventDefault()}
        onClick={() => fileInputRef.current?.click()}
        className={cn(
          'border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all',
          'hover:border-indigo-400 hover:bg-indigo-50/30',
          files.length > 0 ? 'border-indigo-300 bg-indigo-50/20' : 'border-gray-300 bg-gray-50'
        )}
      >
        <Upload className="w-12 h-12 text-indigo-400 mx-auto mb-3" />
        <p className="text-sm text-gray-600 font-medium">Arrastre archivos aqu&iacute; o haga clic para seleccionar</p>
        <p className="text-xs text-gray-400 mt-1">PDF, DOCX, XLSX, CSV &mdash; SOW, Presupuesto, Marco L&oacute;gico, Riesgos, etc.</p>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={ACCEPTED}
          className="hidden"
          onChange={e => { if (e.target.files) addFiles(e.target.files); e.target.value = ''; }}
        />
      </div>

      {/* File list */}
      {files.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 divide-y divide-gray-50">
          {files.map(f => {
            const Icon = FILE_ICONS[f.type] || File;
            return (
              <div key={f.name} className="flex items-center gap-3 px-4 py-3">
                <Icon className="w-5 h-5 text-indigo-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{f.name}</p>
                  <p className="text-xs text-gray-400">{fmtSize(f.size)}</p>
                </div>
                <button onClick={(e) => { e.stopPropagation(); removeFile(f.name); }} className="p-1 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-500 transition">
                  <X className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 text-red-600 bg-red-50 rounded-lg px-4 py-3 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span className="whitespace-pre-wrap break-words min-w-0">{error}</span>
        </div>
      )}

      <button
        onClick={handleAnalyze}
        disabled={files.length === 0 || !companyId}
        className={cn(
          'w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold transition',
          files.length > 0 && companyId
            ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white hover:from-indigo-700 hover:to-violet-700 shadow-lg shadow-indigo-200'
            : 'bg-gray-100 text-gray-400 cursor-not-allowed'
        )}
      >
        <Sparkles className="w-5 h-5" /> Analizar con IA
      </button>
    </div>
  );

  /* ═══ STEP: PROCESSING ═══ */
  const renderProcessing = () => (
    <div className="max-w-lg mx-auto text-center py-20 space-y-6">
      <div className="relative w-20 h-20 mx-auto">
        <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-indigo-500 to-violet-500 animate-spin" style={{ animationDuration: '3s' }}>
          <div className="absolute inset-1 rounded-full bg-white" />
        </div>
        <Sparkles className="absolute inset-0 m-auto w-8 h-8 text-indigo-600 animate-pulse" />
      </div>
      <div>
        <h3 className="text-lg font-semibold text-gray-800">Analizando {files.length} archivo{files.length > 1 ? 's' : ''}...</h3>
        <p className="text-sm text-indigo-600 mt-2 font-medium">{processingMsg}</p>
        <p className="text-xs text-gray-400 mt-4">Esto puede tomar 30-60 segundos seg&uacute;n el tama&ntilde;o de los documentos</p>
      </div>
      <div className="flex flex-wrap gap-2 justify-center">
        {files.map(f => (
          <span key={f.name} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 text-xs text-indigo-700">
            <FileText className="w-3 h-3" /> {f.name}
          </span>
        ))}
      </div>
    </div>
  );

  /* ═══ STEP: PREVIEW / EDIT ═══ */
  const actCount = (extracted?.activities?.length ?? 0) + (extracted?.milestones?.length ?? 0);
  const diagCount = extracted?.diagnostics?.length ?? 0;
  const tabs = [
    { key: 'project', label: 'Proyecto', icon: Building2, count: null },
    { key: 'sow', label: 'SOW', icon: ClipboardList, count: extracted?.sow?.length },
    { key: 'objectives', label: 'Marco Lógico', icon: Target, count: extracted ? countObj(extracted.objectives) : 0 },
    { key: 'diagnostics', label: 'Diagnósticos', icon: AlertCircle, count: diagCount || null },
    { key: 'budget', label: 'Presupuesto', icon: DollarSign, count: extracted?.budgetLines?.length },
    { key: 'risks', label: 'Riesgos', icon: ShieldAlert, count: extracted?.risks?.length },
    { key: 'activities', label: 'Actividades', icon: Calendar, count: actCount || null },
  ];

  const renderPreview = () => {
    if (!extracted) return null;
    const d = extracted;
    const budgetTotal = d.budgetLines.reduce((s, l) => s + (l.total || 0), 0);

    return (
      <div className="space-y-4">
        {/* Tabs */}
        <div className="flex gap-1 overflow-x-auto pb-1 border-b border-gray-100">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-2 rounded-t-lg text-sm font-medium whitespace-nowrap transition',
                activeTab === t.key
                  ? 'bg-white text-indigo-700 border border-b-0 border-gray-200 -mb-px'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              )}
            >
              <t.icon className="w-4 h-4" />
              {t.label}
              {t.count != null && t.count > 0 && (
                <span className="ml-1 text-xs bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded-full">{t.count}</span>
              )}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          {/* CONFIDENCE BADGE */}
          {d.confidence && d.confidence[activeTab] && (
            <div className="mb-4">{confBadge(d.confidence[activeTab] as Confidence)}</div>
          )}

          {activeTab === 'project' && renderProjectTab(d)}
          {activeTab === 'sow' && renderSOWTab(d)}
          {activeTab === 'objectives' && renderObjectivesTab(d.objectives)}
          {activeTab === 'diagnostics' && renderDiagnosticsTab(d)}
          {activeTab === 'budget' && renderBudgetTab(d, budgetTotal)}
          {activeTab === 'risks' && renderRisksTab(d)}
          {activeTab === 'activities' && renderActivitiesTab(d)}
        </div>

        {error && (
          <div className="flex items-start gap-2 text-red-600 bg-red-50 rounded-lg px-4 py-3 text-sm">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span className="whitespace-pre-wrap break-words min-w-0">{error}</span>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex justify-between items-center">
          <button
            onClick={() => { setStep('upload'); setExtracted(null); }}
            className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition"
          >
            <ArrowLeft className="w-4 h-4" /> Volver a subir archivos
          </button>
          <button
            onClick={handleConfirm}
            disabled={confirming || !d.project.name}
            className={cn(
              'flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold transition shadow-lg',
              confirming
                ? 'bg-gray-200 text-gray-500 cursor-wait'
                : 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white hover:from-emerald-700 hover:to-teal-700 shadow-emerald-200'
            )}
          >
            {confirming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            {confirming ? 'Creando proyecto...' : 'Crear Proyecto'}
          </button>
        </div>
      </div>
    );
  };

  /* ── project tab ── */
  const renderProjectTab = (d: ExtractedData) => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="md:col-span-2">
        <label className="block text-xs font-medium text-gray-500 mb-1">Nombre del proyecto</label>
        <input value={d.project.name} onChange={e => updateProject('name', e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
      </div>
      <div className="md:col-span-2">
        <label className="block text-xs font-medium text-gray-500 mb-1">Objetivo General / Project Goal</label>
        <textarea value={d.project.goal || ''} onChange={e => updateProject('goal', e.target.value)} rows={2} className="w-full px-3 py-2 rounded-lg border border-indigo-200 bg-indigo-50/30 text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-none" placeholder="Objetivo general del proyecto..." />
      </div>
      <div className="md:col-span-2">
        <label className="block text-xs font-medium text-gray-500 mb-1">Descripci&oacute;n</label>
        <textarea value={d.project.description} onChange={e => updateProject('description', e.target.value)} rows={3} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-none" />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Financiador</label>
        <input value={d.project.donorName} onChange={e => updateProject('donorName', e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Presupuesto</label>
        <input type="number" value={d.project.budget} onChange={e => updateProject('budget', parseFloat(e.target.value) || 0)} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Pa&iacute;s</label>
        <input value={d.project.country} onChange={e => updateProject('country', e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Regi&oacute;n</label>
        <input value={d.project.region} onChange={e => updateProject('region', e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Moneda</label>
        <select value={d.project.currency} onChange={e => updateProject('currency', e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white">
          {['USD', 'EUR', 'UYU', 'ARS', 'BRL', 'COP', 'PEN', 'MXN', 'GTQ', 'HNL'].map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Fecha inicio</label>
        <input type="date" value={d.project.startDate || ''} onChange={e => updateProject('startDate', e.target.value || null)} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Fecha fin</label>
        <input type="date" value={d.project.endDate || ''} onChange={e => updateProject('endDate', e.target.value || null)} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
      </div>
    </div>
  );

  /* ── SOW helpers ── */
  const updateSOWItem = (sowIdx: number, itemIdx: number, value: string) => {
    if (!extracted) return;
    const arr = [...extracted.sow];
    const items = [...(arr[sowIdx].items || [])];
    items[itemIdx] = value;
    arr[sowIdx] = { ...arr[sowIdx], items };
    setExtracted({ ...extracted, sow: arr });
  };
  const removeSOWItem = (sowIdx: number, itemIdx: number) => {
    if (!extracted) return;
    const arr = [...extracted.sow];
    const items = (arr[sowIdx].items || []).filter((_, j) => j !== itemIdx);
    arr[sowIdx] = { ...arr[sowIdx], items };
    setExtracted({ ...extracted, sow: arr });
  };
  const addSOWItem = (sowIdx: number) => {
    if (!extracted) return;
    const arr = [...extracted.sow];
    arr[sowIdx] = { ...arr[sowIdx], items: [...(arr[sowIdx].items || []), ''] };
    setExtracted({ ...extracted, sow: arr });
  };

  /* ── SOW tab ── */
  const renderSOWTab = (d: ExtractedData) => (
    <div className="space-y-4">
      {d.sow.length === 0 ? (
        <p className="text-sm text-gray-400 italic text-center py-8">No se encontraron secciones SOW en los documentos</p>
      ) : d.sow.map((s, i) => (
        <div key={i} className="border border-gray-100 rounded-lg p-4">
          <h4 className="text-sm font-semibold text-gray-700 mb-2">{s.title}</h4>
          {s.items && s.items.length > 0 ? (
            <div className="space-y-1.5">
              {s.items.map((item, j) => (
                <div key={j} className="flex items-start gap-2 group">
                  <span className="text-indigo-400 mt-2.5 flex-shrink-0">&bull;</span>
                  <input
                    value={item}
                    onChange={e => updateSOWItem(i, j, e.target.value)}
                    className="flex-1 px-2 py-1.5 rounded border border-transparent hover:border-gray-200 focus:border-indigo-300 focus:ring-1 focus:ring-indigo-200 text-sm outline-none transition"
                  />
                  <button onClick={() => removeSOWItem(i, j)} className="p-1 mt-1 rounded text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              <button onClick={() => addSOWItem(i)} className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700 mt-2 ml-5">
                <Plus className="w-3 h-3" />Agregar item
              </button>
            </div>
          ) : (
            <textarea
              value={s.content}
              onChange={e => {
                const arr = [...d.sow];
                arr[i] = { ...arr[i], content: e.target.value };
                setExtracted({ ...d, sow: arr });
              }}
              rows={4}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-y"
            />
          )}
        </div>
      ))}
    </div>
  );

  /* ── objectives helpers ── */
  const updateObjectiveAtIndex = (idx: number, updated: ObjNode) => {
    if (!extracted) return;
    const objs = [...extracted.objectives];
    objs[idx] = updated;
    setExtracted({ ...extracted, objectives: objs });
  };

  /* ── objectives tab (tree) ── */
  const renderObjectivesTab = (objs: ObjNode[]) => (
    <div className="space-y-2">
      {objs.length === 0 ? (
        <p className="text-sm text-gray-400 italic text-center py-8">No se encontraron objetivos en los documentos</p>
      ) : objs.map((o, i) => <ObjectiveNode key={i} node={o} depth={0} onUpdate={(n) => updateObjectiveAtIndex(i, n)} />)}
    </div>
  );

  /* ── diagnostics helpers ── */
  const DIAG_TYPES: Record<string, string> = {
    problem_statement: 'Enunciado del Problema',
    need: 'Necesidad',
    assumption: 'Supuesto',
    external_factor: 'Factor Externo',
  };
  const updateDiagnostic = (idx: number, field: string, value: any) => {
    if (!extracted) return;
    const diags = [...(extracted.diagnostics || [])];
    (diags[idx] as any)[field] = value;
    setExtracted({ ...extracted, diagnostics: diags });
  };
  const removeDiagnostic = (idx: number) => {
    if (!extracted) return;
    setExtracted({ ...extracted, diagnostics: (extracted.diagnostics || []).filter((_, i) => i !== idx) });
  };
  const addDiagnostic = () => {
    if (!extracted) return;
    setExtracted({ ...extracted, diagnostics: [...(extracted.diagnostics || []), { type: 'assumption', code: '', title: '', description: '' }] });
  };

  /* ── diagnostics tab ── */
  const renderDiagnosticsTab = (d: ExtractedData) => (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-500">Problem statements, necesidades, supuestos y factores externos</p>
        <button onClick={addDiagnostic} className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700 font-medium"><Plus className="w-3.5 h-3.5" /> Agregar</button>
      </div>
      {(d.diagnostics || []).length === 0 ? (
        <p className="text-sm text-gray-400 italic text-center py-8">No se encontraron elementos diagnósticos</p>
      ) : (d.diagnostics || []).map((diag, i) => (
        <div key={i} className="border border-gray-100 rounded-lg p-4 space-y-2">
          <div className="flex items-center gap-2">
            <select value={diag.type} onChange={e => updateDiagnostic(i, 'type', e.target.value)} className="px-2 py-1 rounded border border-gray-200 text-xs bg-white font-medium">
              {Object.entries(DIAG_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <input value={diag.code || ''} onChange={e => updateDiagnostic(i, 'code', e.target.value)} className="w-20 px-2 py-1 rounded border border-gray-200 text-xs" placeholder="Código" />
            <input value={diag.title} onChange={e => updateDiagnostic(i, 'title', e.target.value)} className="flex-1 px-2 py-1 rounded border border-gray-200 text-sm font-medium" placeholder="Título" />
            <button onClick={() => removeDiagnostic(i)} className="p-1 hover:bg-red-50 rounded text-gray-400 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
          </div>
          <textarea value={diag.description || ''} onChange={e => updateDiagnostic(i, 'description', e.target.value)} rows={2} className="w-full px-2 py-1 rounded border border-gray-200 text-xs resize-none" placeholder="Descripción..." />
        </div>
      ))}
    </div>
  );

  /* ── budget tab ── */
  const renderBudgetTab = (d: ExtractedData, total: number) => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-700">Total: {fmtCurrency(total, d.project.currency)}</span>
        <span className="text-xs text-gray-400">{d.budgetLines.length} l&iacute;neas</span>
      </div>
      {d.budgetLines.length === 0 ? (
        <p className="text-sm text-gray-400 italic text-center py-8">No se encontraron l&iacute;neas de presupuesto</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left">
                <th className="py-2 px-2 font-medium text-gray-500 text-xs">Categor&iacute;a</th>
                <th className="py-2 px-2 font-medium text-gray-500 text-xs">Descripci&oacute;n</th>
                <th className="py-2 px-2 font-medium text-gray-500 text-xs">Unidad</th>
                <th className="py-2 px-2 font-medium text-gray-500 text-xs text-right">Cant.</th>
                <th className="py-2 px-2 font-medium text-gray-500 text-xs text-right">C. Unit.</th>
                <th className="py-2 px-2 font-medium text-gray-500 text-xs text-right">Total</th>
                <th className="py-2 px-2"></th>
              </tr>
            </thead>
            <tbody>
              {d.budgetLines.map((l, i) => (
                <tr key={i} className="border-b border-gray-50 hover:bg-gray-50/50">
                  <td className="py-2 px-2">
                    <select value={l.category} onChange={e => updateBudgetLine(i, 'category', e.target.value)} className="w-full px-1 py-1 rounded border border-gray-200 text-xs bg-white">
                      {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </td>
                  <td className="py-2 px-2">
                    <input value={l.description} onChange={e => updateBudgetLine(i, 'description', e.target.value)} className="w-full px-1 py-1 rounded border border-gray-200 text-xs" />
                  </td>
                  <td className="py-2 px-2">
                    <input value={l.unit || ''} onChange={e => updateBudgetLine(i, 'unit', e.target.value)} className="w-20 px-1 py-1 rounded border border-gray-200 text-xs" placeholder="mes, viaje..." />
                  </td>
                  <td className="py-2 px-2">
                    <input type="number" value={l.quantity} onChange={e => updateBudgetLine(i, 'quantity', parseFloat(e.target.value) || 0)} className="w-16 px-1 py-1 rounded border border-gray-200 text-xs text-right" />
                  </td>
                  <td className="py-2 px-2">
                    <input type="number" value={l.unitCost} onChange={e => updateBudgetLine(i, 'unitCost', parseFloat(e.target.value) || 0)} className="w-24 px-1 py-1 rounded border border-gray-200 text-xs text-right" />
                  </td>
                  <td className="py-2 px-2 text-right font-medium text-xs">{fmtCurrency(l.total, d.project.currency)}</td>
                  <td className="py-2 px-2">
                    <button onClick={() => removeBudgetLine(i)} className="p-1 hover:bg-red-50 rounded text-gray-400 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  /* ── risks tab ── */
  const renderRisksTab = (d: ExtractedData) => (
    <div className="space-y-3">
      {d.risks.length === 0 ? (
        <p className="text-sm text-gray-400 italic text-center py-8">No se encontraron riesgos</p>
      ) : d.risks.map((r, i) => (
        <div key={i} className="border border-gray-100 rounded-lg p-4 space-y-2">
          <div className="flex items-center justify-between">
            <input value={r.title} onChange={e => updateRisk(i, 'title', e.target.value)} className="flex-1 px-2 py-1 rounded border border-gray-200 text-sm font-medium" />
            <div className="flex items-center gap-2 ml-2">
              <select value={r.level} onChange={e => updateRisk(i, 'level', e.target.value)} className={cn('px-2 py-1 rounded text-xs font-medium', LEVEL_COLORS[r.level] || 'bg-gray-100')}>
                <option value="LOW">Bajo</option>
                <option value="MEDIUM">Medio</option>
                <option value="HIGH">Alto</option>
                <option value="CRITICAL">Cr&iacute;tico</option>
              </select>
              <button onClick={() => removeRisk(i)} className="p-1 hover:bg-red-50 rounded text-gray-400 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          </div>
          <textarea value={r.mitigation} onChange={e => updateRisk(i, 'mitigation', e.target.value)} placeholder="Mitigaci&oacute;n..." rows={2} className="w-full px-2 py-1 rounded border border-gray-200 text-xs resize-none" />
        </div>
      ))}
    </div>
  );

  /* ── activities tab (activities + milestones combined) ── */
  const renderActivitiesTab = (d: ExtractedData) => (
    <div className="space-y-5">
      {/* Activities from LogFrame */}
      {(d.activities?.length ?? 0) > 0 && (
        <div>
          <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Actividades extra&iacute;das</h4>
          <div className="space-y-2">
            {d.activities!.map((a, i) => (
              <div key={i} className="flex items-center gap-3 border border-gray-100 rounded-lg px-4 py-2.5">
                <span className="text-xs font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded shrink-0">{a.code || `A${i + 1}`}</span>
                <span className="flex-1 text-sm text-gray-800">{a.title}</span>
                {a.startDate && <span className="text-[10px] text-gray-400">{a.startDate}</span>}
                {a.endDate && <span className="text-[10px] text-gray-400">&rarr; {a.endDate}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Milestones */}
      <div>
        <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Hitos</h4>
        {d.milestones.length === 0 ? (
          <p className="text-sm text-gray-400 italic text-center py-4">No se encontraron hitos</p>
        ) : (
          <div className="space-y-2">
            {d.milestones.map((m, i) => (
              <div key={i} className="flex items-center gap-3 border border-gray-100 rounded-lg px-4 py-2.5">
                <Calendar className="w-4 h-4 text-indigo-400 shrink-0" />
                <input value={m.name} onChange={e => updateMilestone(i, 'name', e.target.value)} className="flex-1 px-2 py-1 rounded border border-gray-200 text-sm" />
                <input type="date" value={m.dueDate || ''} onChange={e => updateMilestone(i, 'dueDate', e.target.value || null)} className="px-2 py-1 rounded border border-gray-200 text-xs" />
                <button onClick={() => removeMilestone(i)} className="p-1 hover:bg-red-50 rounded text-gray-400 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            ))}
          </div>
        )}
      </div>

      {(d.activities?.length ?? 0) === 0 && d.milestones.length === 0 && (
        <p className="text-sm text-gray-400 italic text-center py-8">No se encontraron actividades ni hitos</p>
      )}
    </div>
  );

  /* ═══ STEP: SUCCESS ═══ */
  const renderSuccess = () => (
    <div className="max-w-lg mx-auto text-center py-16 space-y-6">
      <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center mx-auto">
        <CheckCircle2 className="w-10 h-10 text-emerald-600" />
      </div>
      <div>
        <h3 className="text-xl font-bold text-gray-800">{'\u00A1'}Proyecto creado exitosamente!</h3>
        <p className="text-sm text-gray-500 mt-2">{createdProject?.name}</p>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-w-md mx-auto">
        {Object.entries(createdResults).map(([key, val]) => (
          <div key={key} className="bg-gray-50 rounded-lg p-3 text-center">
            <p className="text-lg font-bold text-indigo-600">{val as number}</p>
            <p className="text-xs text-gray-500 capitalize">{key === 'sow' ? 'Secciones SOW' : key === 'objectives' ? 'Objetivos' : key === 'budgetLines' ? 'L\u00edneas presup.' : key === 'risks' ? 'Riesgos' : key === 'milestones' ? 'Hitos' : key === 'tasks' ? 'Tareas' : key === 'indicators' ? 'Indicadores' : key}</p>
          </div>
        ))}
      </div>
      <div className="flex gap-3 justify-center">
        <Link
          href={`/siep/projects/${createdProject?.id}`}
          className="flex items-center gap-2 px-6 py-3 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition shadow-lg shadow-indigo-200"
        >
          <Eye className="w-4 h-4" /> Ver proyecto
        </Link>
        <button
          onClick={() => { setStep('upload'); setFiles([]); setExtracted(null); setCreatedProject(null); setCreatedResults({}); }}
          className="flex items-center gap-2 px-6 py-3 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition"
        >
          <Plus className="w-4 h-4" /> Importar otro
        </button>
      </div>
    </div>
  );

  /* ═══ RENDER ═══ */
  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <Link href="/siep/projects" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-indigo-600 mb-3 transition">
          <ArrowLeft className="w-4 h-4" /> Proyectos
        </Link>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-800">Importaci&oacute;n Inteligente</h1>
            <p className="text-sm text-gray-500">Suba documentos de proyecto y la IA extraer&aacute; toda la informaci&oacute;n autom&aacute;ticamente</p>
          </div>
        </div>

        {/* Step indicator */}
        {step !== 'success' && (
          <div className="flex items-center gap-2 mt-5">
            {(['upload', 'processing', 'preview'] as Step[]).map((s, i) => (
              <div key={s} className="flex items-center gap-2">
                <div className={cn(
                  'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition',
                  step === s ? 'bg-indigo-600 text-white' :
                  (['upload', 'processing', 'preview'].indexOf(step) > i) ? 'bg-emerald-500 text-white' :
                  'bg-gray-200 text-gray-500'
                )}>
                  {(['upload', 'processing', 'preview'].indexOf(step) > i) ? <Check className="w-3.5 h-3.5" /> : i + 1}
                </div>
                <span className={cn('text-xs font-medium', step === s ? 'text-indigo-700' : 'text-gray-400')}>
                  {s === 'upload' ? 'Subir archivos' : s === 'processing' ? 'An\u00e1lisis IA' : 'Revisar y crear'}
                </span>
                {i < 2 && <ChevronRight className="w-4 h-4 text-gray-300" />}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Content */}
      {step === 'upload' && renderUpload()}
      {step === 'processing' && renderProcessing()}
      {step === 'preview' && renderPreview()}
      {step === 'success' && renderSuccess()}
    </div>
  );
}

/* ─── Objective tree node component (editable + collapsible) ─── */
const OBJ_TYPE_OPTIONS: Record<string, string> = {
  goal: 'Goal / PG',
  outcome: 'Outcome / Resultado',
  objective: 'OE / Obj. Específico',
  output: 'Output / Producto',
  activity: 'Actividad',
  input: 'Input / Insumo',
  deliverable: 'Entregable',
  need: 'Necesidad',
  problem_statement: 'Problema',
  assumption: 'Supuesto',
  external_factor: 'Factor Externo',
  indicator: 'Indicador',
};
const OBJ_TYPE_COLORS: Record<string, string> = {
  goal: 'text-purple-700 bg-purple-50 border-purple-200',
  outcome: 'text-indigo-700 bg-indigo-50 border-indigo-200',
  objective: 'text-blue-700 bg-blue-50 border-blue-200',
  output: 'text-cyan-700 bg-cyan-50 border-cyan-200',
  activity: 'text-teal-700 bg-teal-50 border-teal-200',
  input: 'text-emerald-700 bg-emerald-50 border-emerald-200',
  deliverable: 'text-green-700 bg-green-50 border-green-200',
  need: 'text-orange-700 bg-orange-50 border-orange-200',
  problem_statement: 'text-red-700 bg-red-50 border-red-200',
  assumption: 'text-amber-700 bg-amber-50 border-amber-200',
  external_factor: 'text-rose-700 bg-rose-50 border-rose-200',
  indicator: 'text-gray-600 bg-gray-50 border-gray-200',
};

function ObjectiveNode({ node, depth, onUpdate }: { node: ObjNode; depth: number; onUpdate?: (node: ObjNode) => void }) {
  const [open, setOpen] = useState(depth < 3);
  const [editing, setEditing] = useState(false);
  const hasChildren = node.children && node.children.length > 0;
  const hasIndicators = node.indicators && node.indicators.length > 0;
  const hasContent = hasChildren || hasIndicators || (node.indicator && !hasIndicators);
  const typeColor = OBJ_TYPE_COLORS[node.type] || 'text-gray-700 bg-gray-50 border-gray-200';

  const updateField = (field: string, value: any) => {
    if (onUpdate) onUpdate({ ...node, [field]: value });
  };
  const updateChild = (idx: number, child: ObjNode) => {
    if (!onUpdate) return;
    const newChildren = [...(node.children || [])];
    newChildren[idx] = child;
    onUpdate({ ...node, children: newChildren });
  };
  const removeChild = (idx: number) => {
    if (!onUpdate) return;
    onUpdate({ ...node, children: (node.children || []).filter((_, i) => i !== idx) });
  };
  const addChild = () => {
    if (!onUpdate) return;
    // Auto-determine child type based on parent
    const childTypes: Record<string, string> = { goal: 'outcome', outcome: 'objective', objective: 'output', output: 'activity', activity: 'input' };
    const childType = childTypes[node.type] || 'activity';
    onUpdate({ ...node, children: [...(node.children || []), { type: childType, code: '', title: '', description: '', indicator: null, baseline: null, target: null, indicators: [], children: [] }] });
  };

  return (
    <div className={cn('rounded-lg', depth > 0 && 'ml-4 mt-1')}>
      <div className={cn('flex items-start gap-2 px-3 py-2 rounded-lg group', depth === 0 ? 'bg-indigo-50/30' : 'hover:bg-gray-50')}>
        {hasContent ? (
          <button onClick={() => setOpen(!open)} className="mt-0.5 p-0.5 rounded hover:bg-gray-200 flex-shrink-0">
            {open ? <ChevronDown className="w-4 h-4 text-gray-500" /> : <ChevronRight className="w-4 h-4 text-gray-500" />}
          </button>
        ) : <span className="w-5 flex-shrink-0" />}

        {/* Type dropdown (always visible) */}
        {editing && onUpdate ? (
          <select value={node.type} onChange={e => updateField('type', e.target.value)} className={cn('px-1.5 py-0.5 rounded border text-xs font-bold shrink-0 mt-0.5', typeColor)}>
            {Object.entries(OBJ_TYPE_OPTIONS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        ) : (
          <span className={cn('px-1.5 py-0.5 rounded border text-xs font-bold shrink-0 mt-0.5 cursor-pointer', typeColor)} onClick={() => { if (onUpdate) setEditing(true); }} title="Click para editar tipo">
            {node.code || OBJ_TYPE_OPTIONS[node.type] || node.type}
          </span>
        )}

        <div className="flex-1 min-w-0">
          {editing ? (
            <div className="space-y-1.5">
              <div className="flex gap-2">
                <input value={node.code || ''} onChange={e => updateField('code', e.target.value)} className="w-20 px-2 py-1 rounded border border-gray-200 text-xs font-bold" placeholder="Código" />
                <input value={node.title} onChange={e => updateField('title', e.target.value)} className="flex-1 px-2 py-1 rounded border border-indigo-200 text-sm font-medium focus:ring-1 focus:ring-indigo-300 outline-none" />
              </div>
              <textarea value={node.description || ''} onChange={e => updateField('description', e.target.value)} rows={2} className="w-full px-2 py-1 rounded border border-gray-200 text-xs focus:ring-1 focus:ring-indigo-300 outline-none resize-none" placeholder="Descripción..." />
              <div className="flex gap-2">
                <button onClick={() => setEditing(false)} className="text-xs text-indigo-600 hover:text-indigo-700 font-medium">✓ Cerrar</button>
                <button onClick={addChild} className="text-xs text-emerald-600 hover:text-emerald-700 font-medium flex items-center gap-0.5"><Plus className="w-3 h-3" /> Hijo</button>
              </div>
            </div>
          ) : (
            <div>
              <p className="text-sm font-medium text-gray-800 cursor-pointer hover:text-indigo-700" onClick={() => { if (onUpdate) setEditing(true); }}>{node.title}</p>
              {node.description && <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{node.description}</p>}
            </div>
          )}
        </div>
        {onUpdate && !editing && (
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition">
            <button onClick={() => setEditing(true)} className="p-1 rounded text-gray-300 hover:text-indigo-600 flex-shrink-0" title="Editar"><Edit3 className="w-3.5 h-3.5" /></button>
            <button onClick={() => { /* remove handled by parent */ }} className="p-1 rounded text-gray-300 hover:text-red-500 flex-shrink-0" title="Eliminar"><Trash2 className="w-3.5 h-3.5" /></button>
          </div>
        )}
      </div>
      {open && (
        <div className={hasContent ? 'border-l-2 border-indigo-100 ml-5' : ''}>
          {hasChildren && node.children!.map((c, i) => (
            <ObjectiveNode key={i} node={c} depth={depth + 1} onUpdate={onUpdate ? (child) => updateChild(i, child) : undefined} />
          ))}
          {node.indicator && !hasIndicators && (
            <div className="ml-4 mt-1 px-3 py-1.5 text-xs text-indigo-600">
              <span className="font-medium">Indicador:</span> {node.indicator}
              {node.baseline && <span className="ml-2 text-gray-400">Base: {node.baseline}</span>}
              {node.target && <span className="ml-2 text-gray-400">Meta: {node.target}</span>}
            </div>
          )}
          {hasIndicators && (
            <div className="ml-4 mt-2 mb-1 overflow-x-auto">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1 px-2">Indicadores</p>
              <table className="w-full text-xs border border-gray-100 rounded">
                <thead>
                  <tr className="bg-gray-50 text-gray-500">
                    <th className="px-2 py-1 text-left font-medium">Indicador</th>
                    <th className="px-2 py-1 text-left font-medium">Unidad</th>
                    <th className="px-2 py-1 text-right font-medium">Base</th>
                    <th className="px-2 py-1 text-right font-medium">Meta</th>
                  </tr>
                </thead>
                <tbody>
                  {node.indicators!.map((ind, j) => (
                    <tr key={j} className="border-t border-gray-50">
                      <td className="px-2 py-1 text-gray-700">{ind.name}</td>
                      <td className="px-2 py-1 text-gray-500">{ind.unit || '\u2014'}</td>
                      <td className="px-2 py-1 text-right text-gray-500">{ind.baseline || '\u2014'}</td>
                      <td className="px-2 py-1 text-right text-gray-600 font-medium">{ind.target || '\u2014'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── count all objectives in tree ─── */
function countObj(objs: ObjNode[]): number {
  return objs.reduce((s, o) => s + 1 + (o.children ? countObj(o.children) : 0), 0);
}
