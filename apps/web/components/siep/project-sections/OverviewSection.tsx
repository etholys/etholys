'use client';

import { useMemo } from 'react';
import { SectionProps } from './types';
import SectionTooltip from './SectionTooltip';
import { formatCurrency, formatDate, getStatusColor, getPriorityColor, getInitials } from '@/lib/utils';
import { TrendingUp, DollarSign, Target, CheckCircle2, Clock, FileText, Shield, MapPin, Calendar, Users, AlertTriangle } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';

const PCOLORS = ['#4f46e5', '#f59e0b', '#94a3b8'];

export default function OverviewSection({ project, tr }: SectionProps) {
  const taskStats = useMemo(() => ({
    total: project?.tasks?.length ?? 0,
    done: (project?.tasks ?? []).filter((t: any) => t?.status === 'DONE')?.length ?? 0,
  }), [project?.tasks]);

  const { totalExpense, totalIncome, remaining, burnRate } = useMemo(() => {
    const inc = (project?.transactions ?? []).filter((t: any) => t?.type === 'INCOME' && t?.executionStatus === 'EXECUTED').reduce((s: number, t: any) => s + (t?.amount ?? 0), 0);
    const exp = (project?.transactions ?? []).filter((t: any) => (t?.type === 'EXPENSE' || t?.type === 'TRANSFER_OUT') && t?.executionStatus === 'EXECUTED').reduce((s: number, t: any) => s + (t?.amount ?? 0), 0);
    return { totalIncome: inc, totalExpense: exp, remaining: (project?.budget ?? 0) - exp, burnRate: project?.budget > 0 ? Math.round((exp / project.budget) * 100) : 0 };
  }, [project?.transactions, project?.budget]);

  const kpis = useMemo(() => {
    const physExec = project?.progress ?? 0;
    const finExec = project?.budget > 0 ? Math.round((totalExpense / project.budget) * 100) : 0;
    const msTotal = project?.milestones?.length ?? 0;
    const msDone = (project?.milestones ?? []).filter((m: any) => m?.completed).length;
    const msRate = msTotal > 0 ? Math.round((msDone / msTotal) * 100) : 0;
    const taskRate = taskStats.total > 0 ? Math.round((taskStats.done / taskStats.total) * 100) : 0;
    const risksOpen = (project?.risks ?? []).filter((r: any) => r?.status === 'open').length;
    const risksHigh = (project?.risks ?? []).filter((r: any) => (r?.level === 'HIGH' || r?.level === 'CRITICAL') && r?.status === 'open').length;
    return [
      { label: 'Ejecuci\u00f3n F\u00edsica', value: physExec, color: '#4f46e5', icon: TrendingUp, desc: 'Progreso general del proyecto' },
      { label: 'Ejecuci\u00f3n Financiera', value: finExec, color: '#3b82f6', icon: DollarSign, desc: `${formatCurrency(totalExpense)} de ${formatCurrency(project?.budget)}` },
      { label: 'Hitos', value: msRate, color: '#8b5cf6', icon: Target, desc: `${msDone}/${msTotal} completados` },
      { label: 'Tareas', value: taskRate, color: '#0d9488', icon: CheckCircle2, desc: `${taskStats.done}/${taskStats.total} completadas` },
      { label: 'Riesgos Abiertos', value: risksOpen, color: risksHigh > 0 ? '#ef4444' : '#10b981', icon: AlertTriangle, desc: risksHigh > 0 ? `${risksHigh} alto/cr\u00edtico` : 'Controlado', isCount: true },
      { label: 'Equipo', value: project?.members?.length ?? 0, color: '#6366f1', icon: Users, desc: 'miembros activos', isCount: true },
    ];
  }, [project, totalExpense, taskStats]);

  const finPieData = [
    { name: 'Ejecutado', value: totalExpense },
    { name: 'Restante', value: Math.max(remaining, 0) },
  ].filter(d => d.value > 0);

  return (
    <div className="space-y-6">
      {/* Project Info Header */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-start justify-between gap-4 mb-5">
          <div>
            <p className="text-sm text-gray-500 mb-1 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: project?.company?.color ?? '#4f46e5' }} />
              {project?.company?.name}
              {project?.donorName && <span>&middot; {project.donorName}</span>}
            </p>
            {project?.description && <p className="text-sm text-gray-600 leading-relaxed mt-2 max-w-2xl">{project.description}</p>}
            {(project as any)?.goal && (
              <div className="mt-3 p-3 bg-indigo-50/60 rounded-lg border border-indigo-100">
                <p className="text-xs font-semibold text-indigo-600 mb-1 uppercase tracking-wide">Objetivo General / Project Goal</p>
                <p className="text-sm text-gray-700 leading-relaxed">{(project as any).goal}</p>
              </div>
            )}
          </div>
          <SectionTooltip title="Resumen" content="Panel general con las m&eacute;tricas clave del proyecto. Los indicadores se actualizan autom&aacute;ticamente seg&uacute;n los datos ingresados en cada secci&oacute;n." />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-[10px] uppercase tracking-wide text-gray-500 font-medium flex items-center gap-1"><Calendar className="w-3 h-3" />Inicio</p>
            <p className="text-sm font-semibold text-gray-800 mt-0.5">{formatDate(project?.startDate) || '&mdash;'}</p>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-[10px] uppercase tracking-wide text-gray-500 font-medium flex items-center gap-1"><Calendar className="w-3 h-3" />Fin</p>
            <p className="text-sm font-semibold text-gray-800 mt-0.5">{formatDate(project?.endDate) || '&mdash;'}</p>
          </div>
          {project?.country && (
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-[10px] uppercase tracking-wide text-gray-500 font-medium flex items-center gap-1"><MapPin className="w-3 h-3" />Ubicaci&oacute;n</p>
              <p className="text-sm font-semibold text-gray-800 mt-0.5">{project.country}{project?.region ? ` \u00b7 ${project.region}` : ''}</p>
            </div>
          )}
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-[10px] uppercase tracking-wide text-gray-500 font-medium flex items-center gap-1"><DollarSign className="w-3 h-3" />Presupuesto</p>
            <p className="text-sm font-semibold text-gray-800 mt-0.5">{formatCurrency(project?.budget)} {project?.currency}</p>
          </div>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {kpis.map((kpi, idx) => (
          <div key={idx} className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition">
            <div className="flex items-center gap-1.5 mb-2">
              <kpi.icon className="w-3.5 h-3.5" style={{ color: kpi.color }} />
              <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">{kpi.label}</span>
            </div>
            {(kpi as any).isCount ? (
              <p className="text-2xl font-bold text-gray-900">{kpi.value}</p>
            ) : (
              <div className="flex items-end gap-2">
                <div className="relative w-12 h-12">
                  <svg viewBox="0 0 36 36" className="w-12 h-12 -rotate-90">
                    <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#e5e7eb" strokeWidth="3.5" />
                    <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke={kpi.color} strokeWidth="3.5" strokeDasharray={`${kpi.value}, 100`} strokeLinecap="round" />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-sm font-bold text-gray-900">{kpi.value}%</span>
                  </div>
                </div>
              </div>
            )}
            <p className="text-[10px] text-gray-400 mt-1">{kpi.desc}</p>
          </div>
        ))}
      </div>

      {/* Budget Snapshot + Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h4 className="text-sm font-semibold text-gray-700 mb-4">Resumen Financiero</h4>
          <div className="flex items-center gap-6">
            <div className="w-32 h-32 flex-shrink-0">
              {finPieData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart><Pie data={finPieData} cx="50%" cy="50%" innerRadius={30} outerRadius={50} dataKey="value">{finPieData.map((_: any, i: number) => <Cell key={i} fill={PCOLORS[i % PCOLORS.length]} />)}</Pie><Tooltip formatter={(v: any) => formatCurrency(v)} /></PieChart>
                </ResponsiveContainer>
              ) : <div className="flex items-center justify-center h-full text-gray-300 text-xs">Sin datos</div>}
            </div>
            <div className="flex-1 space-y-2">
              <div className="flex justify-between items-center"><span className="text-xs text-gray-500">Presupuesto</span><span className="text-sm font-semibold text-gray-800">{formatCurrency(project?.budget)}</span></div>
              <div className="flex justify-between items-center"><span className="text-xs text-gray-500">Ejecutado</span><span className="text-sm font-semibold text-indigo-600">{formatCurrency(totalExpense)}</span></div>
              <div className="flex justify-between items-center"><span className="text-xs text-gray-500">Ingresos</span><span className="text-sm font-semibold text-emerald-600">+{formatCurrency(totalIncome)}</span></div>
              <div className="flex justify-between items-center border-t pt-2"><span className="text-xs text-gray-500 font-medium">Restante</span><span className={`text-sm font-bold ${remaining >= 0 ? 'text-gray-900' : 'text-red-600'}`}>{formatCurrency(remaining)}</span></div>
              <div className="w-full bg-gray-100 rounded-full h-1.5 mt-1">
                <div className="h-1.5 rounded-full bg-indigo-500 transition-all" style={{ width: `${Math.min(burnRate, 100)}%` }} />
              </div>
              <p className="text-[10px] text-gray-400 text-right">{burnRate}% ejecutado</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h4 className="text-sm font-semibold text-gray-700 mb-4">&Uacute;ltimas Tareas</h4>
          <div className="space-y-1.5">
            {(project?.tasks ?? []).slice(0, 6).map((t: any) => (
              <div key={t?.id} className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-gray-50 transition">
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: getStatusColor(t?.status ?? '') }} />
                <span className="text-sm text-gray-700 flex-1 truncate">{t?.title}</span>
                <span className="text-[10px] text-gray-400">{t?.assignee?.name ?? ''}</span>
                <span className="px-1.5 py-0.5 rounded text-[9px] font-medium" style={{ backgroundColor: getStatusColor(t?.status ?? '') + '15', color: getStatusColor(t?.status ?? '') }}>{t?.status}</span>
              </div>
            ))}
            {(project?.tasks ?? []).length === 0 && <p className="text-xs text-gray-400 text-center py-4">Sin tareas a&uacute;n</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
