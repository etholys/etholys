'use client';

import Link from 'next/link';
import { useApp } from '@/app/providers';
import { Settings, Shield, Building2, ArrowRight, Target } from 'lucide-react';

export default function PrismSettingsPage() {
  const { locale } = useApp();

  const t = (pt: string, es: string, en: string) =>
    locale === 'pt' ? pt : locale === 'es' ? es : en;

  return (
    <div className="min-h-screen bg-gradient-to-b from-rose-50/80 to-slate-50">
      <header className="border-b border-rose-100 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <Link
            href="/hub/prism"
            className="inline-flex items-center gap-2 text-sm font-medium text-rose-900 hover:text-rose-700"
          >
            <ArrowRight className="h-4 w-4 rotate-180" />
            {t('Voltar ao PRISM', 'Volver a PRISM', 'Back to PRISM')}
          </Link>
          <div className="flex items-center gap-2 text-rose-700">
            <Target className="h-5 w-5" />
            <span className="text-sm font-bold">PRISM</span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-6 px-4 py-10 sm:px-6">
        <header>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
            <Settings className="h-7 w-7 text-rose-600" />
            {t('Definições PRISM', 'Ajustes PRISM', 'PRISM settings')}
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            {t(
              'Preferências ESG, referenciais e relatórios para financiadores. Organização e licenças ficam na administração Etholys.',
              'Preferencias ESG, marcos de referencia e informes a financiadores. Organización y licencias están en administración Etholys.',
              'ESG preferences, frameworks, and funder reports. Organization and licenses live in Etholys administration.',
            )}
          </p>
        </header>

        <section className="rounded-xl border border-rose-100 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-900">{t('Módulo PRISM', 'Módulo PRISM', 'PRISM module')}</h2>
          <p className="mt-2 text-sm text-gray-600">
            {t(
              'Em breve: idioma de relatórios ESG, templates para financiadores e ligação ao ledger de evidências.',
              'Próximamente: idioma de informes ESG, plantillas para financiadores y vínculo al ledger de evidencias.',
              'Coming soon: ESG report language, funder templates, and evidence ledger defaults.',
            )}
          </p>
        </section>

        <section className="grid gap-4 sm:grid-cols-2">
          <Link
            href="/hub/workspace/team"
            className="group rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:border-rose-300 hover:shadow-md"
          >
            <div className="flex items-center gap-2 text-rose-700">
              <Shield className="h-5 w-5" />
              <span className="font-semibold">{t('Acesso ao sistema', 'Acceso al sistema', 'System access')}</span>
            </div>
            <p className="mt-2 text-sm text-gray-600">
              {t(
                'Quem pode abrir PRISM e outros sistemas da empresa.',
                'Quién puede abrir PRISM y otros sistemas de la empresa.',
                'Who can open PRISM and other company systems.',
              )}
            </p>
            <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-rose-600 group-hover:underline">
              {t('Gerir', 'Gestionar', 'Manage')}
              <ArrowRight className="h-4 w-4" />
            </span>
          </Link>

          <Link
            href="/hub/admin"
            className="group rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:border-slate-400 hover:shadow-md"
          >
            <div className="flex items-center gap-2 text-slate-800">
              <Building2 className="h-5 w-5" />
              <span className="font-semibold">{t('Administração Etholys', 'Administración Etholys', 'Etholys administration')}</span>
            </div>
            <p className="mt-2 text-sm text-gray-600">
              {t(
                'Empresas, convites, perfil e licenças de sistemas.',
                'Empresas, invitaciones, perfil y licencias de sistemas.',
                'Companies, invitations, profile, and system licenses.',
              )}
            </p>
            <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-slate-700 group-hover:underline">
              {t('Abrir', 'Abrir', 'Open')}
              <ArrowRight className="h-4 w-4" />
            </span>
          </Link>
        </section>
      </main>
    </div>
  );
}
