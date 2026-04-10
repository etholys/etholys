'use client';

import { useState, useEffect, useMemo } from 'react';
import { useApp } from '@/app/providers';
import { formatCurrency, formatDate, getStatusColor } from '@/lib/utils';
import { BarChart3, TrendingUp, AlertTriangle, DollarSign, FolderKanban, Target, Users, Filter, Search, ChevronDown, ChevronRight, ExternalLink, Shield, Clock } from 'lucide-react';
import Link from 'next/link';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

const STATUS_COLORS: Record<string, string> = {
  DRAFT: '#94a3b8', PLANNING: '#6366f1', IN_PROGRESS: '#0d9488',
  ON_HOLD: '#f59e0b', COMPLETED: '#10b981', CANCELLED: '#ef4444',
};

const RISK_COLORS: Record<string, string> = { LOW: '#10b981', MEDIUM: '#f59e0b', HIGH: '#f97316', CRITICAL: '#ef4444' };
const TIMELINE_LABELS: Record<string, string> = { on_track: 'En tiempo', at_risk: 'En riesgo', overdue: 'Atrasado' };
const TIMELINE_COLORS: Record<string, string> = { on_track: 'text-emerald-600 bg-emerald-50', at_risk: 'text-amber-600 bg-amber-50', overdue: 'text-red-600 bg-red-50' };

function KpiCard({ icon: Icon, label, value, sub, color }: { icon: any; label: string; value: string | number; sub?: string; color: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-start gap-4">
      <div className={`w-11 h-11 rounded-lg flex items-center justify-center ${color}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
        <p className="text-2xl font-bold text-gray-900 mt-0.5">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function ProgressBar({ value, max, color, label }: { value: number; max: number; color: string; label?: string }) {
  const pct = max > 0 ? Math.min(Math.round((value / max) * 100), 100) : 0;
  return (
    <div className="w-full">
      {label && <div className="flex justify-between text-xs mb-1"><span className="text-gray-500">{label}</span><span className="font-medium text-gray-700">{pct}%</span></div>}
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

export default function PortfolioPage() {
  const { tr, locale, activeCompanyId } = useApp();
  type ML = { es: string; pt: string; en: string };
  const ml = (en: string, es: string, pt: string): ML => ({ en, es, pt });
  const L = (m: ML) => m[locale] || m.en;
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [donorFilter, setDonorFilter] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'progress' | 'budget' | 'financialExec' | 'riskScore'>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');

  const fetchData = () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (activeCompanyId) params.set('companyId', activeCompanyId);
    if (statusFilter) params.set('status', statusFilter);
    if (donorFilter) params.set('donorName', donorFilter);
    fetch(`/api/portfolio?${params}`).then(r => r.json()).then(d => { setData(d); setLoading(false); }).catch(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, [activeCompanyId, statusFilter, donorFilter]);

  const filtered = useMemo(() => {
    if (!data?.projects) return [];
    let list = [...data.projects];
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((p: any) => p.name?.toLowerCase().includes(q) || p.donorName?.toLowerCase().includes(q) || p.code?.toLowerCase().includes(q));
    }
    list.sort((a: any, b: any) => {
      let cmp = 0;
      if (sortBy === 'name') cmp = (a.name || '').localeCompare(b.name || '');
      else if (sortBy === 'progress') cmp = (a.progress || 0) - (b.progress || 0);
      else if (sortBy === 'budget') cmp = (a.budget || 0) - (b.budget || 0);
      else if (sortBy === 'financialExec') cmp = (a.financialExec || 0) - (b.financialExec || 0);
      else if (sortBy === 'riskScore') {
        const rOrder: Record<string, number> = { LOW: 0, MEDIUM: 1, HIGH: 2, CRITICAL: 3 };
        cmp = (rOrder[a.riskScore] || 0) - (rOrder[b.riskScore] || 0);
      }
      return sortDir === 'desc' ? -cmp : cmp;
    });
    return list;
  }, [data, search, sortBy, sortDir]);

  const s = data?.summary;
  const statuses = ['DRAFT', 'PLANNING', 'IN_PROGRESS', 'ON_HOLD', 'COMPLETED', 'CANCELLED'];
  const statusLabels: Record<string, string> = {
    DRAFT: 'Borrador', PLANNING: 'Planificaci\u00f3n', IN_PROGRESS: 'En Progreso',
    ON_HOLD: 'Pausado', COMPLETED: 'Completado', CANCELLED: 'Cancelado',
  };

  const statusPieData = useMemo(() => {
    if (!s?.statusCounts) return [];
    return Object.entries(s.statusCounts).map(([k, v]) => ({ name: statusLabels[k] || k, value: v as number, fill: STATUS_COLORS[k] || '#94a3b8' }));
  }, [s]);

  const budgetBarData = useMemo(() => {
    if (!data?.projects) return [];
    return data.projects.slice(0, 10).map((p: any) => ({
      name: p.name?.length > 18 ? p.name.substring(0, 18) + '...' : p.name,
      budget: p.budget || 0,
      spent: p.spent || 0,
    }));
  }, [data]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-gray-200 rounded animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-28 bg-gray-100 rounded-xl animate-pulse" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-indigo-600" />
            {locale === 'es' ? 'Portafolio de Proyectos' : locale === 'pt' ? 'Portf\u00f3lio de Projetos' : 'Project Portfolio'}
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">{locale === 'es' ? 'Vista consolidada de todos los proyectos' : locale === 'pt' ? 'Vis\u00e3o consolidada de todos os projetos' : 'Consolidated view of all projects'}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setViewMode('cards')} className={`px-3 py-1.5 text-xs rounded-lg font-medium transition ${viewMode === 'cards' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-500 hover:bg-gray-50'}`}>
            Tarjetas
          </button>
          <button onClick={() => setViewMode('table')} className={`px-3 py-1.5 text-xs rounded-lg font-medium transition ${viewMode === 'table' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-500 hover:bg-gray-50'}`}>
            Tabla
          </button>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard icon={FolderKanban} label="Total Proyectos" value={s?.totalProjects ?? 0} sub={`${s?.highCriticalRisks ?? 0} con riesgo alto`} color="bg-teal-50 text-indigo-600" />
        <KpiCard icon={DollarSign} label="Presupuesto Total" value={formatCurrency(s?.totalBudget ?? 0)} sub={`${formatCurrency(s?.totalSpent ?? 0)} ejecutado`} color="bg-blue-50 text-blue-600" />
        <KpiCard icon={TrendingUp} label="Progreso Promedio" value={`${s?.avgProgress ?? 0}%`} sub={`${s?.taskCompletion ?? 0}% tareas completadas`} color="bg-emerald-50 text-emerald-600" />
        <KpiCard icon={AlertTriangle} label="Riesgos Activos" value={s?.highCriticalRisks ?? 0} sub={`${s?.totalRisks ?? 0} riesgos totales`} color="bg-amber-50 text-amber-600" />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Status Distribution Pie */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">{locale === 'es' ? 'Distribuci\u00f3n por Estado' : locale === 'pt' ? 'Distribui\u00e7\u00e3o por Estado' : 'Distribution by Status'}</h3>
          {statusPieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={statusPieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" paddingAngle={2}>
                  {statusPieData.map((entry: any, idx: number) => <Cell key={idx} fill={entry.fill} />)}
                </Pie>
                <Tooltip formatter={(v: any) => `${v} proyectos`} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
              </PieChart>
            </ResponsiveContainer>
          ) : <p className="text-sm text-gray-400 text-center py-8">{tr('general.noData')}</p>}
        </div>

        {/* Budget vs Spent Bar */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">{locale === 'es' ? 'Presupuesto vs Ejecutado' : locale === 'pt' ? 'Or\u00e7amento vs Executado' : 'Budget vs Spent'}</h3>
          {budgetBarData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={budgetBarData} layout="vertical" margin={{ left: 10, right: 10 }}>
                <XAxis type="number" tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`} style={{ fontSize: '10px' }} />
                <YAxis type="category" dataKey="name" width={100} style={{ fontSize: '10px' }} />
                <Tooltip formatter={(v: any) => formatCurrency(v)} />
                <Bar dataKey="budget" fill="#cbd5e1" name="Presupuesto" radius={[0, 4, 4, 0]} />
                <Bar dataKey="spent" fill="#0d9488" name="Ejecutado" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <p className="text-sm text-gray-400 text-center py-8">{tr('general.noData')}</p>}
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar proyecto..." className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500" />
          </div>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20">
            <option value="">{L(ml('All statuses','Todos los estados','Todos os status'))}</option>
            {statuses.map(st => <option key={st} value={st}>{statusLabels[st]}</option>)}
          </select>
          {s?.donors?.length > 0 && (
            <select value={donorFilter} onChange={e => setDonorFilter(e.target.value)} className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20">
              <option value="">{L(ml('All donors','Todos los donantes','Todos os doadores'))}</option>
              {(s.donors as string[]).map((d: string) => <option key={d} value={d}>{d}</option>)}
            </select>
          )}
          <select value={sortBy} onChange={e => setSortBy(e.target.value as any)} className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20">
            <option value="name">{L(ml('Sort: Name','Ordenar: Nombre','Ordenar: Nome'))}</option>
            <option value="progress">{L(ml('Sort: Progress','Ordenar: Progreso','Ordenar: Progresso'))}</option>
            <option value="budget">{L(ml('Sort: Budget','Ordenar: Presupuesto','Ordenar: Orçamento'))}</option>
            <option value="financialExec">{'Ordenar: Ejecuci\u00f3n Financiera'}</option>
            <option value="riskScore">{L(ml('Sort: Risk','Ordenar: Riesgo','Ordenar: Risco'))}</option>
          </select>
          <button onClick={() => setSortDir(d => d === 'asc' ? 'desc' : 'asc')} className="px-3 py-2 border border-gray-200 rounded-lg text-sm hover:bg-gray-50 transition">
            {sortDir === 'asc' ? '\u2191' : '\u2193'}
          </button>
        </div>
      </div>

      {/* Project List */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-400">{tr('general.noData')}</div>
      ) : viewMode === 'cards' ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filtered.map((p: any) => (
            <Link key={p.id} href={`/siep/projects/${p.id}`} className="bg-white rounded-xl border border-gray-200 p-5 hover:border-indigo-300 hover:shadow-sm transition block">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: p.color || '#0d9488' }} />
                    <h3 className="font-semibold text-gray-900 truncate">{p.name}</h3>
                    {p.code && <span className="text-[10px] font-mono text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded">{p.code}</span>}
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                    {p.company?.shortName && <span className="bg-gray-50 px-1.5 py-0.5 rounded">{p.company.shortName}</span>}
                    {p.donorName && <span>{`\u00b7 ${p.donorName}`}</span>}
                  </div>
                </div>
                <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${getStatusColor(p.status)}`}>{statusLabels[p.status] || p.status}</span>
              </div>

              {/* KPI Bars */}
              <div className="space-y-2.5">
                <ProgressBar value={p.progress} max={100} color="#0d9488" label={'Ejecuci\u00f3n F\u00edsica'} />
                <ProgressBar value={p.financialExec} max={100} color="#3b82f6" label={'Ejecuci\u00f3n Financiera'} />
                <ProgressBar value={p.milestoneCompletion} max={100} color="#8b5cf6" label="Hitos" />
              </div>

              {/* Bottom Stats */}
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
                <div className="flex items-center gap-3 text-xs text-gray-500">
                  <span className="flex items-center gap-1"><DollarSign className="w-3 h-3" />{formatCurrency(p.budget, p.currency)}</span>
                  <span className="flex items-center gap-1"><Users className="w-3 h-3" />{p.membersCount}</span>
                  <span className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${TIMELINE_COLORS[p.timelineStatus] || ''}`}>
                    <Clock className="w-3 h-3" />{TIMELINE_LABELS[p.timelineStatus] || p.timelineStatus}
                  </span>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded`} style={{ backgroundColor: (RISK_COLORS[p.riskScore] || '#10b981') + '20', color: RISK_COLORS[p.riskScore] || '#10b981' }}>
                  <Shield className="w-3 h-3 inline mr-0.5" />{'Riesgo: ' + p.riskScore}
                </span>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        /* Table View */
        <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 font-semibold text-gray-600">{L(ml('Project','Proyecto','Projeto'))}</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">{L(ml('Status','Estado','Status'))}</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-600">{L(ml('Budget','Presupuesto','Orçamento'))}</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-600">{'Ejec. F\u00edsica'}</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-600">{L(ml('Financial Exec.','Ejec. Financiera','Exec. Financeira'))}</th>
                <th className="text-center px-4 py-3 font-semibold text-gray-600">{L(ml('Milestones','Hitos','Marcos'))}</th>
                <th className="text-center px-4 py-3 font-semibold text-gray-600">{L(ml('Time','Tiempo','Tempo'))}</th>
                <th className="text-center px-4 py-3 font-semibold text-gray-600">{L(ml('Risk','Riesgo','Risco'))}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p: any) => (
                <tr key={p.id} className="border-b border-gray-100 hover:bg-gray-50 transition">
                  <td className="px-4 py-3">
                    <Link href={`/siep/projects/${p.id}`} className="font-medium text-gray-900 hover:text-indigo-600 transition">{p.name}</Link>
                    <div className="text-xs text-gray-400">{p.company?.shortName} {p.donorName ? `\u00b7 ${p.donorName}` : ''}</div>
                  </td>
                  <td className="px-4 py-3"><span className={`text-[10px] font-bold px-2 py-1 rounded-full ${getStatusColor(p.status)}`}>{statusLabels[p.status] || p.status}</span></td>
                  <td className="px-4 py-3 text-right font-medium">{formatCurrency(p.budget, p.currency)}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden"><div className="h-full bg-teal-500 rounded-full" style={{ width: `${p.progress}%` }} /></div>
                      <span className="text-xs font-medium w-8 text-right">{p.progress}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden"><div className="h-full bg-blue-500 rounded-full" style={{ width: `${Math.min(p.financialExec, 100)}%` }} /></div>
                      <span className="text-xs font-medium w-8 text-right">{p.financialExec}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center text-xs">{p.milestoneCompletion}%</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${TIMELINE_COLORS[p.timelineStatus] || ''}`}>{TIMELINE_LABELS[p.timelineStatus]}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded" style={{ backgroundColor: (RISK_COLORS[p.riskScore] || '#10b981') + '20', color: RISK_COLORS[p.riskScore] || '#10b981' }}>{p.riskScore}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
