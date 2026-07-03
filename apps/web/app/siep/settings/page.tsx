'use client';

import Link from 'next/link';
import { useApp } from '@/app/providers';
import { Settings, Shield, Building2, Sprout, ArrowRight } from 'lucide-react';

export default function SiepSettingsPage() {
  const { locale } = useApp();

  const t = (pt: string, es: string, en: string) =>
    locale === 'pt' ? pt : locale === 'es' ? es : en;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
          <Settings className="h-7 w-7 text-indigo-600" />
          {t('Definições SIEP', 'Ajustes SIEP', 'SIEP settings')}
        </h1>
        <p className="mt-1 text-sm text-gray-600">
          {t(
            'Preferências do módulo de gestão de projetos. Organização, utilizadores e licenças de sistemas ficam na administração Etholys.',
            'Preferencias del módulo de gestión de proyectos. Organización, usuarios y licencias están en la administración Etholys.',
            'Project management module preferences. Organization, users and system licenses live in Etholys administration.',
          )}
        </p>
      </header>

      <section className="rounded-xl border border-indigo-100 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-900">{t('Módulo SIEP', 'Módulo SIEP', 'SIEP module')}</h2>
        <p className="mt-2 text-sm text-gray-600">
          {t(
            'Em breve: idioma de relatórios, templates de marco lógico, regras de aprovação de actividades e integração com orçamento ATLAS.',
            'Próximamente: idioma de informes, plantillas de marco lógico y reglas de aprobación de actividades.',
            'Coming soon: report language, logframe templates, activity approval rules, and ATLAS budget integration.',
          )}
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <Link
          href="/hub/workspace/team"
          className="group rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:border-indigo-300 hover:shadow-md"
        >
          <div className="flex items-center gap-2 text-indigo-700">
            <Shield className="h-5 w-5" />
            <span className="font-semibold">{t('Permissões SIEP', 'Permisos SIEP', 'SIEP permissions')}</span>
          </div>
          <p className="mt-2 text-sm text-gray-600">
            {t(
              'Quem vê orçamento, valores, relatórios e aprovações no SIEP.',
              'Quién ve presupuesto, montos e informes en SIEP.',
              'Who can view budget amounts, reports, and approvals in SIEP.',
            )}
          </p>
          <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-indigo-600 group-hover:underline">
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
              'Empresas, convites, perfil e quais sistemas cada utilizador pode abrir.',
              'Empresas, invitaciones, perfil y qué sistemas puede abrir cada usuario.',
              'Companies, invitations, profile, and which systems each user can open.',
            )}
          </p>
          <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-slate-700 group-hover:underline">
            {t('Abrir', 'Abrir', 'Open')}
            <ArrowRight className="h-4 w-4" />
          </span>
        </Link>
      </section>

      <div className="flex items-start gap-2 rounded-lg border border-indigo-50 bg-indigo-50/50 px-4 py-3 text-xs text-indigo-900">
        <Sprout className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          {t(
            'A empresa activa e o idioma da interface mudam na barra lateral do SIEP — não aqui.',
            'La empresa activa y el idioma se cambian en la barra lateral de SIEP.',
            'Active company and UI language are changed in the SIEP sidebar — not here.',
          )}
        </p>
      </div>
    </div>
  );
}
