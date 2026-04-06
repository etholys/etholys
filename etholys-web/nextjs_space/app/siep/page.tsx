'use client';

import { useState, useEffect } from 'react';
import { useApp } from '@/app/providers';
import { formatCurrency } from '@/lib/utils';
import { FolderKanban, DollarSign, TrendingUp, Users, ArrowRight } from 'lucide-react';
import Link from 'next/link';

export default function SiepDashboardPage() {
  const { locale, activeCompanyId } = useApp();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams();
    if (activeCompanyId) params.set('companyId', activeCompanyId);
    fetch(`/api/portfolio?${params}`).then(r => r.json()).then(d => { setData(d); setLoading(false); }).catch(() => setLoading(false));
  }, [activeCompanyId]);

  const s = data?.summary;

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
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          {locale === 'es' ? 'Panel SIEP' : locale === 'pt' ? 'Painel SIEP' : 'SIEP Dashboard'}
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          {locale === 'es' ? 'Resumen de proyectos y ejecuci\u00f3n' : locale === 'pt' ? 'Resumo de projetos e execu\u00e7\u00e3o' : 'Project and execution summary'}
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-start gap-4">
          <div className="w-11 h-11 rounded-lg flex items-center justify-center bg-indigo-50 text-indigo-600">
            <FolderKanban className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{locale === 'es' ? 'Total Proyectos' : locale === 'pt' ? 'Total Projetos' : 'Total Projects'}</p>
            <p className="text-2xl font-bold text-gray-900 mt-0.5">{s?.totalProjects ?? 0}</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-start gap-4">
          <div className="w-11 h-11 rounded-lg flex items-center justify-center bg-blue-50 text-blue-600">
            <DollarSign className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{locale === 'es' ? 'Presupuesto Total' : locale === 'pt' ? 'Or\u00e7amento Total' : 'Total Budget'}</p>
            <p className="text-2xl font-bold text-gray-900 mt-0.5">{formatCurrency(s?.totalBudget ?? 0)}</p>
            <p className="text-xs text-gray-400 mt-0.5">{formatCurrency(s?.totalSpent ?? 0)} {locale === 'es' ? 'ejecutado' : locale === 'pt' ? 'executado' : 'spent'}</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-start gap-4">
          <div className="w-11 h-11 rounded-lg flex items-center justify-center bg-emerald-50 text-emerald-600">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{locale === 'es' ? 'Progreso Promedio' : locale === 'pt' ? 'Progresso M\u00e9dio' : 'Average Progress'}</p>
            <p className="text-2xl font-bold text-gray-900 mt-0.5">{s?.avgProgress ?? 0}%</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-start gap-4">
          <div className="w-11 h-11 rounded-lg flex items-center justify-center bg-amber-50 text-amber-600">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{locale === 'es' ? 'Stakeholders' : locale === 'pt' ? 'Stakeholders' : 'Stakeholders'}</p>
            <p className="text-2xl font-bold text-gray-900 mt-0.5">{s?.highCriticalRisks ?? 0}</p>
            <p className="text-xs text-gray-400 mt-0.5">{locale === 'es' ? 'riesgos activos' : locale === 'pt' ? 'riscos ativos' : 'active risks'}</p>
          </div>
        </div>
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link href="/siep/projects" className="bg-white rounded-xl border border-gray-200 p-5 hover:border-indigo-300 hover:shadow-sm transition group">
          <h3 className="font-semibold text-gray-900 mb-1 group-hover:text-indigo-600 transition">{locale === 'es' ? 'Proyectos' : locale === 'pt' ? 'Projetos' : 'Projects'}</h3>
          <p className="text-sm text-gray-500 mb-3">{locale === 'es' ? 'Gestiona todos tus proyectos de desarrollo' : locale === 'pt' ? 'Gerencie todos os seus projetos de desenvolvimento' : 'Manage all your development projects'}</p>
          <span className="text-sm text-indigo-600 font-medium flex items-center gap-1 group-hover:gap-2 transition-all">
            {locale === 'es' ? 'Ver proyectos' : locale === 'pt' ? 'Ver projetos' : 'View projects'} <ArrowRight className="w-4 h-4" />
          </span>
        </Link>
        <Link href="/siep/portfolio" className="bg-white rounded-xl border border-gray-200 p-5 hover:border-indigo-300 hover:shadow-sm transition group">
          <h3 className="font-semibold text-gray-900 mb-1 group-hover:text-indigo-600 transition">{locale === 'es' ? 'Portafolio' : locale === 'pt' ? 'Portf\u00f3lio' : 'Portfolio'}</h3>
          <p className="text-sm text-gray-500 mb-3">{locale === 'es' ? 'Vista consolidada y an\u00e1lisis del portafolio' : locale === 'pt' ? 'Vis\u00e3o consolidada e an\u00e1lise do portf\u00f3lio' : 'Consolidated portfolio view and analysis'}</p>
          <span className="text-sm text-indigo-600 font-medium flex items-center gap-1 group-hover:gap-2 transition-all">
            {locale === 'es' ? 'Ver portafolio' : locale === 'pt' ? 'Ver portf\u00f3lio' : 'View portfolio'} <ArrowRight className="w-4 h-4" />
          </span>
        </Link>
        <Link href="/siep/stakeholders" className="bg-white rounded-xl border border-gray-200 p-5 hover:border-indigo-300 hover:shadow-sm transition group">
          <h3 className="font-semibold text-gray-900 mb-1 group-hover:text-indigo-600 transition">{locale === 'es' ? 'Alianzas y Stakeholders' : locale === 'pt' ? 'Alian\u00e7as e Stakeholders' : 'Alliances & Stakeholders'}</h3>
          <p className="text-sm text-gray-500 mb-3">{locale === 'es' ? 'Red de aliados, donantes y socios' : locale === 'pt' ? 'Rede de aliados, doadores e parceiros' : 'Network of allies, donors, and partners'}</p>
          <span className="text-sm text-indigo-600 font-medium flex items-center gap-1 group-hover:gap-2 transition-all">
            {locale === 'es' ? 'Ver alianzas' : locale === 'pt' ? 'Ver alian\u00e7as' : 'View alliances'} <ArrowRight className="w-4 h-4" />
          </span>
        </Link>
      </div>
    </div>
  );
}
