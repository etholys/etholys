'use client';

import Link from 'next/link';
import { useApp } from '@/app/providers';
import { Settings, Shield, Building2, ArrowRight, GraduationCap } from 'lucide-react';

export default function ForgeSettingsPage() {
  const { locale } = useApp();

  const t = (pt: string, es: string, en: string) =>
    locale === 'pt' ? pt : locale === 'es' ? es : en;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
          <Settings className="h-7 w-7 text-blue-600" />
          {t('Definições FORGE', 'Ajustes FORGE', 'FORGE settings')}
        </h1>
        <p className="mt-1 text-sm text-gray-600">
          {t(
            'Preferências de cursos, certificados e gamificação. Organização e licenças ficam na administração Etholys.',
            'Preferencias de cursos, certificados y gamificación. Organización y licencias están en administración Etholys.',
            'Course, certificate, and gamification preferences. Organization and licenses live in Etholys administration.',
          )}
        </p>
      </header>

      <section className="rounded-xl border border-blue-100 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-900">{t('Módulo FORGE', 'Módulo FORGE', 'FORGE module')}</h2>
        <p className="mt-2 text-sm text-gray-600">
          {t(
            'Em breve: idioma por defeito dos cursos, regras de certificação e integração com trilhas.',
            'Próximamente: idioma por defecto de cursos, reglas de certificación e integración con rutas.',
            'Coming soon: default course language, certification rules, and trail integration.',
          )}
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <Link
          href="/hub/workspace/team"
          className="group rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:border-blue-300 hover:shadow-md"
        >
          <div className="flex items-center gap-2 text-blue-700">
            <Shield className="h-5 w-5" />
            <span className="font-semibold">{t('Acesso ao sistema', 'Acceso al sistema', 'System access')}</span>
          </div>
          <p className="mt-2 text-sm text-gray-600">
            {t(
              'Quem pode abrir FORGE e outros sistemas da empresa.',
              'Quién puede abrir FORGE y otros sistemas de la empresa.',
              'Who can open FORGE and other company systems.',
            )}
          </p>
          <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-blue-600 group-hover:underline">
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

      <div className="flex items-start gap-2 rounded-lg border border-blue-50 bg-blue-50/50 px-4 py-3 text-xs text-blue-900">
        <GraduationCap className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          {t(
            'A empresa activa e o idioma mudam na barra lateral do FORGE — não aqui.',
            'La empresa activa y el idioma se cambian en la barra lateral de FORGE.',
            'Active company and UI language are changed in the FORGE sidebar — not here.',
          )}
        </p>
      </div>
    </div>
  );
}
