'use client';

import { useState, useEffect } from 'react';
import { useApp } from '@/app/providers';
import { formatCurrency, formatDate, getStatusColor } from '@/lib/utils';
import { BarChart3, FileText, Download, TrendingUp, DollarSign, CheckSquare, FolderKanban } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import ReportCharts from './_components/report-charts';
import type { Locale } from '@/lib/i18n';

const RCOLORS = ['#0D9488', '#f59e0b', '#94a3b8'];
type ML = { es: string; pt: string; en: string };
const ml = (en: string, es: string, pt: string): ML => ({ en, es, pt });

const UI = {
  subtitle: ml('Professional report generation for donors and internal management', 'Generación de reportes profesionales para donantes y gestión interna', 'Geração de relatórios profissionais para doadores e gestão interna'),
  execDesc: ml('Consolidated executive summary', 'Resumen ejecutivo consolidado', 'Resumo executivo consolidado'),
  projDesc: ml('Detailed project progress', 'Avance detallado de proyectos', 'Progresso detalhado dos projetos'),
  finDesc: ml('Financial status by project', 'Estado financiero por proyecto', 'Status financeiro por projeto'),
  taskDesc: ml('Completed and pending tasks', 'Tareas completadas y pendientes', 'Tarefas concluídas e pendentes'),
};

export default function ReportsPage() {
  const { tr, activeCompanyId, locale } = useApp();
  const L = (m: ML) => m[locale] || m.en;
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    setLoading(true);
    const params = activeCompanyId ? `?companyId=${activeCompanyId}` : '';
    fetch(`/api/reports${params}`).then(r => r.json()).then(d => { setData(d); setLoading(false); }).catch(() => setLoading(false));
  }, [activeCompanyId]);

  const exportPdf = async (type: string) => {
    setGenerating(true);
    try {
      const params = new URLSearchParams({ type });
      if (activeCompanyId) params.set('companyId', activeCompanyId);
      const res = await fetch(`/api/reports/pdf?${params}`);
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `report-${type}-${Date.now()}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (err: any) {
      console.error('PDF export error:', err);
    } finally {
      setGenerating(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-3 border-teal-600/30 border-t-teal-600 rounded-full animate-spin" /></div>;

  const reports = [
    { id: 'executive', label: tr('report.executive'), icon: BarChart3, desc: L(UI.execDesc) },
    { id: 'project', label: tr('report.projectProgress'), icon: FolderKanban, desc: L(UI.projDesc) },
    { id: 'financial', label: tr('report.financial'), icon: DollarSign, desc: L(UI.finDesc) },
    { id: 'tasks', label: tr('report.taskCompletion'), icon: CheckSquare, desc: L(UI.taskDesc) },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{tr('nav.reports')}</h1>
        <p className="text-gray-500 text-sm">{L(UI.subtitle)}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {reports.map(r => (
          <div key={r.id} className="bg-white rounded-xl p-5 shadow-sm hover:shadow-md transition">
            <div className="w-10 h-10 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center mb-3"><r.icon className="w-5 h-5" /></div>
            <h3 className="font-semibold text-gray-900 mb-1">{r.label}</h3>
            <p className="text-xs text-gray-500 mb-4">{r.desc}</p>
            <button onClick={() => exportPdf(r.id)} disabled={generating} className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-teal-50 text-teal-600 rounded-lg text-sm font-medium hover:bg-teal-100 transition disabled:opacity-50">
              {generating ? <div className="w-4 h-4 border-2 border-teal-600/30 border-t-teal-600 rounded-full animate-spin" /> : <Download className="w-4 h-4" />}
              {tr('report.exportPdf')}
            </button>
          </div>
        ))}
      </div>

      <ReportCharts data={data} />

      {data?.projectSummary && (
        <div className="bg-white rounded-xl p-5 shadow-sm">
          <h3 className="font-semibold text-gray-900 mb-4">{tr('report.projectProgress')}</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b"><th className="text-left py-2 text-gray-500 font-medium">{tr('project.name')}</th><th className="text-left py-2 text-gray-500 font-medium">{tr('auth.company')}</th><th className="text-left py-2 text-gray-500 font-medium">{tr('general.status')}</th><th className="text-right py-2 text-gray-500 font-medium">{tr('project.budget')}</th><th className="text-right py-2 text-gray-500 font-medium">{tr('project.spent')}</th><th className="text-right py-2 text-gray-500 font-medium">{tr('project.progress')}</th></tr></thead>
              <tbody>
                {(data?.projectSummary ?? []).map((p: any) => (
                  <tr key={p?.id} className="border-b border-gray-50">
                    <td className="py-2.5 font-medium">{p?.name ?? ''}</td>
                    <td>{p?.company?.shortName ?? ''}</td>
                    <td><span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: getStatusColor(p?.status ?? '') + '20', color: getStatusColor(p?.status ?? '') }}>{tr(`status.${(p?.status ?? '').toLowerCase()}`)}</span></td>
                    <td className="text-right">{formatCurrency(p?.budget)}</td>
                    <td className="text-right">{formatCurrency(p?.spent)}</td>
                    <td className="text-right font-medium">{p?.progress ?? 0}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
