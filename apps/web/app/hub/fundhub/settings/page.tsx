'use client';

import Link from 'next/link';
import { ArrowLeft, ShieldCheck, Building2, ArrowRight, Radar, Network, ChevronDown } from 'lucide-react';
import { useApp } from '@/app/providers';
import { MonitoredSourcesPanel } from '@/components/opportunity/MonitoredSourcesPanel';
import { EligibilityProfileForm } from '@/components/fundhub/EligibilityProfileForm';
import { CompanyIdentityForm } from '@/components/fundhub/CompanyIdentityForm';
import { SuccessFeePanel } from '@/components/fundhub/SuccessFeePanel';

export default function FundHubSettingsPage() {
  const { locale } = useApp();
  const t = (pt: string, es: string, en: string) =>
    locale === 'pt' ? pt : locale === 'es' ? es : en;

  return (
    <div className="space-y-6 text-gray-100">
      <main>
        <div className="mb-8">
          <Link href="/hub/fundhub" className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-gray-100">
            <ArrowLeft className="h-4 w-4" />
            FundHub
          </Link>
          <h1 className="mt-3 text-3xl font-bold text-white">
            {t('Definições', 'Ajustes', 'Settings')}
          </h1>
          <p className="mt-2 text-sm text-gray-400">
            {t(
              'Quem somos e a elegibilidade ficam à vista. O resto abre só quando precisares.',
              'Quiénes somos y la elegibilidad quedan a la vista. El resto se abre solo cuando lo necesitas.',
              'Who we are and eligibility stay in view. The rest opens only when you need it.',
            )}
          </p>
        </div>

        <div className="space-y-4">
          <CompanyIdentityForm />
          <EligibilityProfileForm />
          <Link
            href="/hub/fundhub/crm"
            className="inline-flex items-center gap-1 text-sm font-medium text-amber-300 hover:underline"
          >
            <Network className="h-4 w-4" />
            {t('Abrir Rede (perfil · aliados · doadores)', 'Abrir Red (perfil · aliados · donantes)', 'Open Network (profile · allies · donors)')}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <details className="group mt-8 rounded-2xl border border-gray-200 bg-white">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4">
            <span>
              <span className="block text-sm font-semibold text-gray-900">
                {t('Extras opcionais', 'Extras opcionales', 'Optional extras')}
              </span>
              <span className="mt-0.5 block text-xs text-gray-500">
                {t(
                  'Success fee e portais oficiais — fechados para a página caber num olhar.',
                  'Success fee y portales oficiales — cerrados para que la página se lea de un vistazo.',
                  'Success fee and official portals — closed so the page stays scannable.',
                )}
              </span>
            </span>
            <ChevronDown className="h-4 w-4 shrink-0 text-gray-400 transition group-open:rotate-180" />
          </summary>
          <div className="space-y-4 border-t border-gray-100 px-5 py-4">
            <SuccessFeePanel />
            <MonitoredSourcesPanel />
          </div>
        </details>

        <section className="mt-6 grid gap-4 sm:grid-cols-2">
          <Link
            href="/hub/admin?s=access"
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
            href="/hub/admin?s=org-profile"
            className="group rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition hover:border-slate-400 hover:shadow-md sm:col-span-2"
          >
            <div className="flex items-center gap-2 text-slate-800">
              <Building2 className="h-5 w-5" />
              <span className="font-semibold">
                {t('Administração Etholys', 'Administración Etholys', 'Etholys administration')}
              </span>
            </div>
            <p className="mt-2 text-sm text-gray-600">
              {t(
                'O mesmo perfil da empresa — quem somos, missão e visão.',
                'El mismo perfil de la empresa — quiénes somos, misión y visión.',
                'The same company profile — who we are, mission, and vision.',
              )}
            </p>
          </Link>
        </section>
      </main>
    </div>
  );
}
