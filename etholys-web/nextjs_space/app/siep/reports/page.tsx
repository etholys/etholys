'use client';

import { useState, useEffect } from 'react';
import { useApp } from '@/app/providers';
import { formatDate } from '@/lib/utils';
import {
  BarChart3, FileText, TrendingUp, CheckCircle2, Clock,
  AlertCircle, ChevronRight, Filter, FolderKanban,
} from 'lucide-react';

export const dynamic = 'force-dynamic';

const STATUS_CFG: Record<string, { label: string; color: string; icon: any }> = {
  draft: { label: 'Borrador', color: '#94a3b8', icon: FileText },
  submitted: { label: 'Enviado', color: '#3b82f6', icon: Clock },
  approved: { label: 'Aprobado', color: '#10b981', icon: CheckCircle2 },
  rejected: { label: 'Rechazado', color: '#ef4444', icon: AlertCircle },
};

const TYPE_CFG: Record<string, { label: string; color: string }> = {
  quarterly: { label: 'Trimestral', color: '#6366f1' },
  annual: { label: 'Anual', color: '#8b5cf6' },
  final: { label: 'Final', color: '#0ea5e9' },
  adhoc: { label: 'Ad-hoc', color: '#f59e0b' },
};


type ML = { es: string; pt: string; en: string };
const ml = (en: string, es: string, pt: string): ML => ({ en, es, pt });
export default function SiepReportsPage() {
  const {tr, activeCompanyId, locale } = useApp();
  const L = (m: ML) => m[locale] || m.en;
  const [projects, setProjects] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterProject, setFilterProject] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  useEffect(() => {
    const params = new URLSearchParams();
    if (activeCompanyId) params.set('companyId', activeCompanyId);
    Promise.all([
      fetch(`/api/projects?${params}`).then(r => r.json()),
      fetch(`/api/me-reports?${params}`).then(r => r.json()),
    ]).then(([pData, rData]) => {
      setProjects(pData?.projects ?? []);
      setReports(rData?.reports ?? []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [activeCompanyId]);

  const filtered = reports.filter(r => {
    if (filterProject && r.projectId !== filterProject) return false;
    if (filterStatus && r.status !== filterStatus) return false;
    return true;
  });

  const stats = {
    total: reports.length,
    approved: reports.filter(r => r.status === 'approved').length,
    pending: reports.filter(r => r.status === 'submitted').length,
    draft: reports.filter(r => r.status === 'draft').length,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-3 border-indigo-600/30 border-t-indigo-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <BarChart3 className="w-6 h-6 text-indigo-600" />
          Reportes M&amp;E
        </h1>
        <p className="text-gray-500 text-sm mt-1">Reportes de monitoreo y evaluaci&oacute;n de todos los proyectos SIEP</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <p className="text-[10px] uppercase tracking-wide text-gray-500 font-medium">Total</p>
          <p className="text-2xl font-bold text-gray-800 mt-1">{stats.total}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <p className="text-[10px] uppercase tracking-wide text-gray-500 font-medium">Aprobados</p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">{stats.approved}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <p className="text-[10px] uppercase tracking-wide text-gray-500 font-medium">Pendientes</p>
          <p className="text-2xl font-bold text-blue-600 mt-1">{stats.pending}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <p className="text-[10px] uppercase tracking-wide text-gray-500 font-medium">Borradores</p>
          <p className="text-2xl font-bold text-gray-400 mt-1">{stats.draft}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Filter className="w-4 h-4 text-gray-400" />
        <select
          value={filterProject}
          onChange={e => setFilterProject(e.target.value)}
          className="text-xs border border-gray-200 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
        >
          <option value="">Todos los proyectos</option>
          {projects.map((p: any) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className="text-xs border border-gray-200 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
        >
          <option value="">Todos los estados</option>
          {Object.entries(STATUS_CFG).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
      </div>

      {/* Reports list */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
          <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500">No hay reportes M&amp;E a&uacute;n.</p>
          <p className="text-xs text-gray-400 mt-1">Los reportes se crean desde la secci&oacute;n M&amp;E de cada proyecto.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(r => {
            const st = STATUS_CFG[r.status] || STATUS_CFG.draft;
            const tp = TYPE_CFG[r.type] || TYPE_CFG.adhoc;
            const proj = projects.find((p: any) => p.id === r.projectId);
            const StIcon = st.icon;
            return (
              <div
                key={r.id}
                className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition cursor-pointer"
                onClick={() => {
                  if (proj) window.location.href = `/siep/projects/${proj.id}?tab=monitoring`;
                }}
              >
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: tp.color + '15' }}>
                    <FileText className="w-4 h-4" style={{ color: tp.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-sm font-semibold text-gray-800 truncate">{r.title || 'Sin t\u00edtulo'}</h3>
                      <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full" style={{ backgroundColor: tp.color + '15', color: tp.color }}>
                        {tp.label}
                      </span>
                      <span className="flex items-center gap-1 text-[9px] font-medium px-1.5 py-0.5 rounded-full" style={{ backgroundColor: st.color + '15', color: st.color }}>
                        <StIcon className="w-3 h-3" />{st.label}
                      </span>
                    </div>
                    {proj && (
                      <p className="text-[10px] text-gray-400 flex items-center gap-1 mb-1">
                        <FolderKanban className="w-3 h-3" />{proj.name}
                      </p>
                    )}
                    <p className="text-xs text-gray-500 line-clamp-2">{r.findings || r.narrative || ''}</p>
                    <div className="flex items-center gap-3 mt-2 text-[10px] text-gray-400">
                      {r.period && <span>Per&iacute;odo: {r.period}</span>}
                      {r.createdAt && <span>Creado: {formatDate(r.createdAt)}</span>}
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0 mt-2" />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
