'use client';

import Link from 'next/link';
import { ArrowLeft, Settings2, Bell, UserCog, ShieldCheck, Building2, ArrowRight, Radar } from 'lucide-react';
import { useApp } from '@/app/providers';
import { MonitoredSourcesPanel } from '@/components/opportunity/MonitoredSourcesPanel';

export default function FundHubSettingsPage() {
  const { locale } = useApp();
  const t = (pt: string, es: string, en: string) =>
    locale === 'pt' ? pt : locale === 'es' ? es : en;

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Link href="/hub/fundhub" className="text-sm text-gray-600 hover:text-gray-900 inline-flex items-center gap-1">
              <ArrowLeft className="w-4 h-4" />
              {t('Voltar ao OPPORTUNITY', 'Volver a OPPORTUNITY', 'Back to OPPORTUNITY')}
            </Link>
            <h1 className="mt-3 text-3xl font-bold text-gray-900">
              {t('Configurações OPPORTUNITY', 'Configuración OPPORTUNITY', 'OPPORTUNITY settings')}
            </h1>
            <p className="text-sm text-gray-600 mt-2">
              {t(
                'Briefing, fontes monitorizadas, alertas e perfil da organização.',
                'Briefing, fuentes monitoreadas, alertas y perfil.',
                'Briefing, monitored sources, alerts, and organization profile.',
              )}
            </p>
          </div>
          <div className="inline-flex items-center gap-3 rounded-3xl bg-white px-4 py-3 text-sm text-gray-700 shadow-sm ring-1 ring-gray-200">
            <Settings2 className="w-5 h-5 text-amber-600" />
            Ajustes do sistema
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <UserCog className="w-6 h-6 text-gray-700" />
              <h2 className="text-lg font-semibold text-gray-900">Perfil da organização</h2>
            </div>
            <p className="text-sm text-gray-600">Atualize nome, setor, localização e contatos para que suas propostas tenham informações corretas.</p>
          </div>
          <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <Bell className="w-6 h-6 text-amber-600" />
              <h2 className="text-lg font-semibold text-gray-900">Notificações</h2>
            </div>
            <p className="text-sm text-gray-600">Configure alertas de prazos, novas oportunidades e atualizações de compliance.</p>
          </div>
          <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <ShieldCheck className="w-6 h-6 text-emerald-600" />
              <h2 className="text-lg font-semibold text-gray-900">Permissões</h2>
            </div>
            <p className="text-sm text-gray-600">Defina quem do seu time pode acessar rascunhos, fundos salvos e relatórios de compliance.</p>
          </div>
        </div>

        <section className="mt-8 space-y-2">
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
                'Quem pode abrir OPPORTUNITY e outros sistemas da empresa.',
                'Quién puede abrir OPPORTUNITY y otros sistemas de la empresa.',
                'Who can open OPPORTUNITY and other company systems.',
              )}
            </p>
            <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-amber-700 group-hover:underline">
              {t('Gerir', 'Gestionar', 'Manage')}
              <ArrowRight className="h-4 w-4" />
            </span>
          </Link>

          <Link
            href="/hub/fundhub/discover"
            className="group rounded-2xl border border-amber-200 bg-amber-50/50 p-5 shadow-sm transition hover:border-amber-300 hover:shadow-md"
          >
            <div className="flex items-center gap-2 text-amber-800">
              <Radar className="h-5 w-5" />
              <span className="font-semibold">{t('Varredura e briefing', 'Barrido y briefing', 'Scan & briefing')}</span>
            </div>
            <p className="mt-2 text-sm text-gray-600">
              {t(
                'Configure o que procura e inicie varreduras de oportunidades.',
                'Configure qué busca e inicie barridos.',
                'Configure what you need and run opportunity scans.',
              )}
            </p>
            <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-amber-700 group-hover:underline">
              {t('Abrir varredura', 'Abrir barrido', 'Open scan')}
              <ArrowRight className="h-4 w-4" />
            </span>
          </Link>

          <Link
            href="/hub/admin"
            className="group rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition hover:border-slate-400 hover:shadow-md"
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

        <div className="mt-10 rounded-[2rem] border border-gray-200 bg-white p-8 shadow-sm">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            {t('Configurações rápidas', 'Ajustes rápidos', 'Quick settings')}
          </h2>
          <div className="space-y-4">
            <div className="rounded-3xl border border-gray-200 bg-gray-50 p-4">
              <p className="font-semibold text-gray-900">1. Atualizar nome e dados da organização</p>
              <p className="text-sm text-gray-600 mt-1">Mantenha seu perfil empresarial alinhado com requerimentos dos editais.</p>
            </div>
            <div className="rounded-3xl border border-gray-200 bg-gray-50 p-4">
              <p className="font-semibold text-gray-900">2. Notificações de novos editais</p>
              <p className="text-sm text-gray-600 mt-1">Ative alertas por setor e região para não perder prazos importantes.</p>
            </div>
            <div className="rounded-3xl border border-gray-200 bg-gray-50 p-4">
              <p className="font-semibold text-gray-900">3. Preferências de relatórios</p>
              <p className="text-sm text-gray-600 mt-1">Escolha o formato de relatórios e frequência de entregas.</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
