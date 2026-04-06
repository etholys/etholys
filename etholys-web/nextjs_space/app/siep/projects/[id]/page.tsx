'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useApp } from '@/app/providers';
import { formatCurrency, formatDate, getStatusColor, getPriorityColor } from '@/lib/utils';
import {
  ArrowLeft, Calendar, DollarSign, Users, Target, AlertTriangle,
  FileText, Plus, X, Edit2, Save, MapPin, ListChecks, GitBranch,
  GanttChart, Gauge, Shield, BarChart3, ChevronRight, Building2, Globe, Trash2,
} from 'lucide-react';
import Link from 'next/link';
import {
  OverviewSection,
  LogFrameSection,
  BudgetSection,
  TasksSection,
  RisksSection,
  TeamSection,
  MonitoringSection,
  SOWSection,
} from '@/components/siep/project-sections';
import type { ProjectData } from '@/components/siep/project-sections';

type TabDef = {
  id: string;
  label: string;
  icon: any;
  badge?: (p: any) => string | null;
};


type ML = { es: string; pt: string; en: string };
const ml = (en: string, es: string, pt: string): ML => ({ en, es, pt });
export default function ProjectDetailPage() {
  const { id } = useParams() ?? {};
  const router = useRouter();
  const {tr, locale } = useApp();
  const L = (m: ML) => m[locale] || m.en;
  const [project, setProject] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<any>({});
  const [mounted, setMounted] = useState(false);
  const tabsRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setMounted(true); }, []);

  const fetchProject = () => {
    fetch(`/api/projects/${id}`).then(r => r.json()).then(d => { setProject(d?.project); setLoading(false); }).catch(() => setLoading(false));
  };
  useEffect(() => { if (id) fetchProject(); }, [id]);

  const handleSave = async () => {
    const data: any = { ...editForm };
    if (data.budget !== undefined) data.budget = parseFloat(data.budget) || 0;
    if (data.startDate) data.startDate = new Date(data.startDate);
    if (data.endDate) data.endDate = new Date(data.endDate);
    await fetch(`/api/projects/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    setEditing(false);
    fetchProject();
  };

  const openEdit = () => {
    setEditForm({
      name: project?.name ?? '',
      description: project?.description ?? '',
      goal: project?.goal ?? '',
      donorName: project?.donorName ?? '',
      country: project?.country ?? '',
      region: project?.region ?? '',
      currency: project?.currency ?? 'USD',
      status: project?.status ?? 'DRAFT',
      priority: project?.priority ?? 'MEDIUM',
      progress: project?.progress ?? 0,
      budget: project?.budget ?? 0,
      startDate: project?.startDate ? new Date(project.startDate).toISOString().split('T')[0] : '',
      endDate: project?.endDate ? new Date(project.endDate).toISOString().split('T')[0] : '',
    });
    setEditing(true);
  };

  if (loading || !mounted) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-3 border-indigo-600/30 border-t-indigo-600 rounded-full animate-spin" /></div>;
  if (!project) return <div className="text-center py-12 text-gray-400">{tr('general.noData')}</div>;

  const tabs: TabDef[] = [
    { id: 'overview', label: 'Resumen', icon: Gauge },
    { id: 'sow', label: 'SOW', icon: FileText },
    { id: 'marco', label: 'Marco L\u00f3gico', icon: GitBranch, badge: (p: any) => {
      const count = (p?.objectives ?? []).length;
      return count > 0 ? String(count) : null;
    }},
    { id: 'budget', label: L(ml('Budget', 'Presupuesto', 'Orçamento')), icon: DollarSign, badge: (p: any) => {
      const spent = (p?.transactions ?? []).filter((t: any) => t?.type === 'EXPENSE').reduce((s: number, t: any) => s + (t?.amount ?? 0), 0);
      const pct = p?.budget > 0 ? Math.round((spent / p.budget) * 100) : 0;
      return pct > 0 ? `${pct}%` : null;
    }},
    { id: 'activities', label: 'Actividades', icon: ListChecks, badge: (p: any) => {
      const tasks = (p?.tasks ?? []).length;
      const milestones = (p?.milestones ?? []).length;
      const total = tasks + milestones;
      if (total === 0) return null;
      const done = (p?.tasks ?? []).filter((t: any) => t?.status === 'DONE').length + (p?.milestones ?? []).filter((m: any) => m?.completed).length;
      return `${done}/${total}`;
    }},
    { id: 'risks', label: 'Riesgos', icon: Shield, badge: (p: any) => {
      const open = (p?.risks ?? []).filter((r: any) => r?.status === 'open').length;
      return open > 0 ? String(open) : null;
    }},
    { id: 'team', label: L(ml('Team', 'Equipo', 'Equipe')), icon: Users, badge: (p: any) => {
      const count = (p?.members ?? []).length;
      return count > 0 ? String(count) : null;
    }},
    { id: 'monitoring', label: 'M&E', icon: BarChart3, badge: (p: any) => {
      const meas = (p?.indicatorMeasurements ?? []).length;
      const reps = (p?.meReports ?? []).length;
      const total = meas + reps;
      return total > 0 ? String(total) : null;
    }},
  ];

  const statusConfig: Record<string, { bg: string; text: string; label: string }> = {
    DRAFT: { bg: 'bg-gray-100', text: 'text-gray-600', label: 'Borrador' },
    PLANNING: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Planificaci\u00f3n' },
    IN_PROGRESS: { bg: 'bg-indigo-100', text: 'text-indigo-700', label: 'En Progreso' },
    ON_HOLD: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'En Pausa' },
    COMPLETED: { bg: 'bg-emerald-100', text: 'text-emerald-700', label: L(ml('Completed', 'Completado', 'Concluído')) },
    CANCELLED: { bg: 'bg-red-100', text: 'text-red-700', label: L(ml('Cancelled', 'Cancelado', 'Cancelado')) },
  };
  const st = statusConfig[project?.status] ?? statusConfig.DRAFT;

  const sectionProps = { project: project as ProjectData, onRefresh: fetchProject, tr };

  return (
    <div className="space-y-0">
      {/* Compact Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="px-4 sm:px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <button onClick={() => router.push('/siep/projects')} className="p-1.5 hover:bg-gray-100 rounded-lg transition flex-shrink-0">
                <ArrowLeft className="w-5 h-5 text-gray-500" />
              </button>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-lg font-bold text-gray-900 truncate">{project?.name}</h1>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${st.bg} ${st.text}`}>{st.label}</span>
                  {project?.code && <span className="text-xs font-mono text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">{project.code}</span>}
                </div>
                <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
                  {project?.company?.name && (
                    <span className="flex items-center gap-1"><Building2 className="w-3 h-3" />{project.company.name}</span>
                  )}
                  {project?.donorName && (
                    <span className="flex items-center gap-1"><Globe className="w-3 h-3" />{project.donorName}</span>
                  )}
                  {(project?.country || project?.region) && (
                    <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{[project.country, project.region].filter(Boolean).join(', ')}</span>
                  )}
                  {project?.startDate && (
                    <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{formatDate(project.startDate)}{project.endDate ? ` - ${formatDate(project.endDate)}` : ''}</span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <Link href={`/siep/projects/${project?.id}/gantt`} className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition">
                <GanttChart className="w-4 h-4" />
                Gantt
              </Link>
              <button onClick={openEdit} className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 transition">
                <Edit2 className="w-4 h-4" />
                <span className="hidden sm:inline">Editar</span>
              </button>
              <button
                onClick={async () => {
                  if (!confirm(`\u00bfEliminar el proyecto "${project?.name}"?\n\nSe desactivar\u00e1 el proyecto y todo su contenido.`)) return;
                  const res = await fetch(`/api/projects/${project?.id}`, { method: 'DELETE' });
                  if (res.ok) router.push('/siep/projects');
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                title="Eliminar proyecto"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Horizontal Tabs */}
        <div className="px-4 sm:px-6" ref={tabsRef}>
          <div className="flex items-center gap-0 overflow-x-auto scrollbar-hide -mb-px">
            {tabs.map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              const badge = tab.badge?.(project);
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                    isActive
                      ? 'border-indigo-600 text-indigo-700'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                  {badge && (
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ml-1 ${
                      isActive ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-500'
                    }`}>{badge}</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Content — full width */}
      <div className="p-4 sm:p-6">
        {activeTab === 'overview' && <OverviewSection {...sectionProps} />}
        {activeTab === 'sow' && <SOWSection {...sectionProps} />}
        {activeTab === 'marco' && <LogFrameSection {...sectionProps} />}
        {activeTab === 'budget' && <BudgetSection {...sectionProps} />}
        {activeTab === 'activities' && (
          <TasksSection {...sectionProps} />
        )}
        {activeTab === 'risks' && <RisksSection {...sectionProps} />}
        {activeTab === 'team' && <TeamSection {...sectionProps} />}
        {activeTab === 'monitoring' && <MonitoringSection {...sectionProps} />}
      </div>

      {/* Edit Project Modal */}
      {editing && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setEditing(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b">
              <h2 className="text-lg font-semibold">{tr('general.edit')} {tr('nav.projects')}</h2>
              <button onClick={() => setEditing(false)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">{tr('project.name')}</label>
                <input value={editForm?.name ?? ''} onChange={e => setEditForm({ ...editForm, name: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{tr('project.description')}</label>
                <textarea value={editForm?.description ?? ''} onChange={e => setEditForm({ ...editForm, description: e.target.value })} rows={3} className="w-full px-3 py-2 rounded-lg border text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Objetivo General / Project Goal</label>
                <textarea value={editForm?.goal ?? ''} onChange={e => setEditForm({ ...editForm, goal: e.target.value })} rows={2} className="w-full px-3 py-2 rounded-lg border text-sm" placeholder="El objetivo general de alto nivel del proyecto..." />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{tr('project.donor')}</label>
                <input value={editForm?.donorName ?? ''} onChange={e => setEditForm({ ...editForm, donorName: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-sm" />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Pa&iacute;s</label>
                  <input value={editForm?.country ?? ''} onChange={e => setEditForm({ ...editForm, country: e.target.value })} placeholder="Uruguay, Brasil..." className="w-full px-3 py-2 rounded-lg border text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Regi&oacute;n</label>
                  <input value={editForm?.region ?? ''} onChange={e => setEditForm({ ...editForm, region: e.target.value })} placeholder="Latinoam&eacute;rica..." className="w-full px-3 py-2 rounded-lg border text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Moneda</label>
                  <select value={editForm?.currency ?? 'USD'} onChange={e => setEditForm({ ...editForm, currency: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-sm">
                    <option value="USD">USD</option>
                    <option value="BRL">BRL</option>
                    <option value="EUR">EUR</option>
                    <option value="UYU">UYU</option>
                    <option value="ARS">ARS</option>
                    <option value="GBP">GBP</option>
                    <option value="CHF">CHF</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">{tr('general.status')}</label>
                  <select value={editForm?.status ?? ''} onChange={e => setEditForm({ ...editForm, status: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-sm">
                    {['DRAFT', 'PLANNING', 'IN_PROGRESS', 'ON_HOLD', 'COMPLETED', 'CANCELLED'].map(s => <option key={s} value={s}>{tr(`status.${s.toLowerCase()}`)}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">{tr('general.priority')}</label>
                  <select value={editForm?.priority ?? ''} onChange={e => setEditForm({ ...editForm, priority: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-sm">
                    {['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map(p => <option key={p} value={p}>{tr(`priority.${p.toLowerCase()}`)}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">{tr('project.progress')} (%)</label>
                  <input type="number" min={0} max={100} value={editForm?.progress ?? 0} onChange={e => setEditForm({ ...editForm, progress: parseInt(e.target.value) || 0 })} className="w-full px-3 py-2 rounded-lg border text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">{tr('project.budget')}</label>
                  <input type="number" value={editForm?.budget ?? 0} onChange={e => setEditForm({ ...editForm, budget: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">{tr('project.startDate')}</label>
                  <input type="date" value={editForm?.startDate ?? ''} onChange={e => setEditForm({ ...editForm, startDate: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">{tr('project.endDate')}</label>
                  <input type="date" value={editForm?.endDate ?? ''} onChange={e => setEditForm({ ...editForm, endDate: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-sm" />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button onClick={() => setEditing(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">{tr('general.cancel')}</button>
                <button onClick={handleSave} className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium flex items-center gap-2"><Save className="w-4 h-4" />{tr('general.save')}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
