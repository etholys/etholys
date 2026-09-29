'use client';

import Link from 'next/link';
import { ArrowLeft, ShieldCheck, Building2, ArrowRight, Radar, Network } from 'lucide-react';
import { useApp } from '@/app/providers';
import { MonitoredSourcesPanel } from '@/components/opportunity/MonitoredSourcesPanel';
import { EligibilityProfileForm } from '@/components/fundhub/EligibilityProfileForm';

export default function FundHubSettingsPage() {
  const { locale } = useApp();
  const t = (pt: string, es: string, en: string) =>
    locale === 'pt' ? pt : locale === 'es' ? es : en;

  return (
    <div className="space-y-6">
      <main>
        <div className="mb-8">
          <Link href="/hub/fundhub" className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900">
            <ArrowLeft className="h-4 w-4" />
            FundHub
          </Link>
          <h1 className="mt-3 text-3xl font-bold text-gray-900">
            {t('Definições', 'Ajustes', 'Settings')}
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            {t('Elegibilidade, fontes e acesso.', 'Elegibilidad, fuentes y acceso.', 'Eligibility, sources, and access.')}
          </p>
        </div>

        <div className="mb-8">
          <EligibilityProfileForm />
          <Link
            href="/hub/fundhub/crm"
            className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-amber-800 hover:underline"
          >
            <Network className="h-4 w-4" />
            {t('Abrir CRM de captação', 'Abrir CRM de captación', 'Open capture CRM')}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <section className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
            {t('Extras opcionais', 'Extras opcionales', 'Optional extras')}
          </h2>
          <MonitoredSourcesPanel />
        </section>

        <section className="mt-8 grid gap-4 sm:grid-cols-2">
          <Link
            href="/hub/workspace/team"
            className="group rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition hover:border-amber-300 hover:shadow-md"
          >
            <div className="flex items-center gap-2 text-amber-800">
              <ShieldCheck className="h-5 w-5" />
              <span className="font-semibold">{t('Acesso ao sistema', 'Acceso al sistema', 'System access')}</span>
            </div>
            <p className="mt-2 text-sm text-gray-600">
              {t(
                'Quem pode abrir o FundHub e outros sistemas.',
                'Quién puede abrir FundHub y otros sistemas.',
                'Who can open FundHub and other systems.',
              )}
            </p>
          </Link>

          <Link
            href="/hub/fundhub/discover"
            className="group rounded-2xl border border-amber-200 bg-amber-50/50 p-5 shadow-sm transition hover:border-amber-300 hover:shadow-md"
          >
            <div className="flex items-center gap-2 text-amber-800">
              <Radar className="h-5 w-5" />
              <span className="font-semibold">{t('Buscar', 'Buscar', 'Search')}</span>
            </div>
            <p className="mt-2 text-sm text-gray-600">
              {t('Critérios e atalhos de busca.', 'Criterios y atajos de búsqueda.', 'Search criteria and shortcuts.')}
            </p>
          </Link>

          <Link
            href="/hub/admin"
            className="group rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition hover:border-slate-400 hover:shadow-md"
          >
            <div className="flex items-center gap-2 text-slate-800">
              <Building2 className="h-5 w-5" />
              <span className="font-semibold">
                {t('Administração Etholys', 'Administración Etholys', 'Etholys administration')}
              </span>
            </div>
          </Link>
        </section>
      </main>
    </div>
  );
}
