'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowRight,
  Building2,
  ClipboardList,
  CreditCard,
  Users,
} from 'lucide-react';
import { useApp } from '@/app/providers';
import { EtholysSettingsContent } from '@/components/etholys-admin/EtholysSettingsContent';
import { BillingConsole } from '@/components/etholys-admin/BillingConsole';
import { AdminSetupGuide, type AdminSetupStepId } from '@/components/etholys-admin/AdminSetupGuide';
import { WorkspaceAccessManager } from '@/components/workspace/WorkspaceAccessManager';
import { parseAdminSection, adminHref, type AdminSection } from '@/lib/admin-control';

function SectionTitle({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="mb-6">
      <h1 className="text-2xl font-semibold tracking-tight text-white">{title}</h1>
      {subtitle ? <p className="mt-1 max-w-2xl text-sm text-white/55">{subtitle}</p> : null}
    </div>
  );
}

function OverviewPanel() {
  const { locale, activeCompanyId } = useApp();
  const router = useRouter();
  const t = (pt: string, es: string, en: string) =>
    locale === 'pt' ? pt : locale === 'es' ? es : en;

  const goStep = (step: AdminSetupStepId) => {
    const map: Record<AdminSetupStepId, AdminSection> = {
      organization: 'companies',
      team: 'users',
      systems: 'users',
      billing: 'billing',
    };
    router.push(adminHref(map[step]));
  };

  const cards: { s: AdminSection; icon: typeof Building2; title: string; body: string }[] = [
    {
      s: 'companies',
      icon: Building2,
      title: t('1. Empresas', '1. Empresas', '1. Companies'),
      body: t(
        'Crie ou edite a organização que usa o Etholys.',
        'Cree o edite la organización que usa Etholys.',
        'Create or edit the organization that uses Etholys.',
      ),
    },
    {
      s: 'users',
      icon: Users,
      title: t('2. Utilizadores', '2. Usuarios', '2. Users'),
      body: t(
        'Equipa, convites e permissões (sistemas e Tools) num só sítio.',
        'Equipo, invitaciones y permisos (sistemas y Tools) en un solo lugar.',
        'Team, invites and permissions (systems and Tools) in one place.',
      ),
    },
    {
      s: 'billing',
      icon: CreditCard,
      title: t('3. Licenças', '3. Licencias', '3. Licenses'),
      body: t(
        'Contrate produtos e gerencie faturas.',
        'Contrate productos y gestione facturas.',
        'Subscribe to products and manage invoices.',
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <SectionTitle
        title={t('Central de controlo', 'Centro de control', 'Control center')}
        subtitle={t(
          'Tudo o que é configuração da empresa e administração fica aqui — um só sítio, com menu à esquerda.',
          'Todo lo de configuración de la empresa y administración está aquí — un solo lugar, con menú a la izquierda.',
          'All company configuration and administration lives here — one place, with a left menu.',
        )}
      />

      <AdminSetupGuide companyId={activeCompanyId} onGoToStep={goStep} />

      <div className="grid gap-3 sm:grid-cols-2">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <Link
              key={c.s}
              href={adminHref(c.s)}
              className="rounded-xl border border-white/10 bg-white/[0.04] p-4 transition hover:border-teal-400/35 hover:bg-white/[0.07]"
            >
              <p className="flex items-center gap-2 text-sm font-semibold text-white">
                <Icon className="h-4 w-4 text-teal-300/90" />
                {c.title}
              </p>
              <p className="mt-1.5 text-xs leading-relaxed text-white/50">{c.body}</p>
              <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-teal-300/90">
                {t('Abrir', 'Abrir', 'Open')}
                <ArrowRight className="h-3.5 w-3.5" />
              </span>
            </Link>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-3 text-sm">
        <Link href={adminHref('org-profile')} className="text-white/55 hover:text-teal-200 hover:underline">
          {t('Perfil da organização', 'Perfil de la organización', 'Organization profile')}
        </Link>
        <span className="text-white/20">·</span>
        <Link href={adminHref('areas')} className="text-white/55 hover:text-teal-200 hover:underline">
          {t('Áreas / sectores', 'Áreas / sectores', 'Areas / sectors')}
        </Link>
        <span className="text-white/20">·</span>
        <Link href={adminHref('account')} className="text-white/55 hover:text-teal-200 hover:underline">
          {t('Conta pessoal', 'Cuenta personal', 'Personal account')}
        </Link>
      </div>
    </div>
  );
}

function AdminSectionBody() {
  const { locale, activeCompanyId } = useApp();
  const search = useSearchParams();
  const section = parseAdminSection(search.get('s'));
  const t = (pt: string, es: string, en: string) =>
    locale === 'pt' ? pt : locale === 'es' ? es : en;

  if (section === 'overview') return <OverviewPanel />;

  if (section === 'companies') {
    return (
      <div>
        <SectionTitle
          title={t('Empresas', 'Empresas', 'Companies')}
          subtitle={t(
            'Crie empresas e escolha a activa no Hub.',
            'Cree empresas y elija la activa en el Hub.',
            'Create companies and pick the active one in the Hub.',
          )}
        />
        <EtholysSettingsContent accent="slate" hideHeader title="" sections={['companies']} />
      </div>
    );
  }

  if (section === 'org-profile') {
    return (
      <div className="space-y-4">
        <SectionTitle
          title={t('Perfil da organização', 'Perfil de la organización', 'Organization profile')}
          subtitle={t(
            'Contexto que o Advisor e outros sistemas usam para priorizar.',
            'Contexto que Advisor y otros sistemas usan para priorizar.',
            'Context Advisor and other systems use for priorities.',
          )}
        />
        <div className="rounded-xl border border-white/10 bg-white/[0.04] p-5">
          <p className="flex items-center gap-2 text-sm font-medium text-white">
            <ClipboardList className="h-4 w-4 text-teal-300/90" />
            {t('Assistente de perfil', 'Asistente de perfil', 'Profile wizard')}
          </p>
          <p className="mt-2 text-sm text-white/55">
            {t(
              'Sector, objectivos e módulos recomendados — 2–3 minutos.',
              'Sector, objetivos y módulos recomendados — 2–3 minutos.',
              'Sector, goals and recommended modules — 2–3 minutes.',
            )}
          </p>
          <Link
            href="/hub/setup"
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-teal-500/90 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-teal-400"
          >
            {t('Abrir assistente', 'Abrir asistente', 'Open wizard')}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    );
  }

  if (section === 'areas') {
    return (
      <div>
        <SectionTitle
          title={t('Áreas / sectores', 'Áreas / sectores', 'Areas / sectors')}
          subtitle={t(
            'Estrutura interna de cada empresa (departamentos).',
            'Estructura interna de cada empresa (departamentos).',
            'Internal structure of each company (departments).',
          )}
        />
        <EtholysSettingsContent accent="slate" hideHeader title="" sections={['departments']} />
      </div>
    );
  }

  if (section === 'users') {
    return (
      <div className="space-y-4">
        <SectionTitle
          title={t('Utilizadores', 'Usuarios', 'Users')}
          subtitle={t(
            'Equipa da empresa activa: convide, veja o resumo e administre permissões de cada pessoa.',
            'Equipo de la empresa activa: invite, vea el resumen y administre permisos de cada persona.',
            'Active company team: invite, review summaries, and manage each person’s permissions.',
          )}
        />
        <WorkspaceAccessManager embedded />
      </div>
    );
  }

  if (section === 'billing') {
    return (
      <div>
        <SectionTitle
          title={t('Licenças e pagamentos', 'Licencias y pagos', 'Licenses & billing')}
          subtitle={t(
            'Contratos, faturas e renovação da empresa activa.',
            'Contratos, facturas y renovación de la empresa activa.',
            'Contracts, invoices and renewal for the active company.',
          )}
        />
        {!activeCompanyId ? (
          <p className="text-sm text-white/55">
            {t('Selecione uma empresa no Hub.', 'Seleccione una empresa en el Hub.', 'Select a company in the Hub.')}
          </p>
        ) : (
          <Suspense
            fallback={
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-teal-400/30 border-t-teal-300" />
            }
          >
            <BillingConsole companyId={activeCompanyId} />
          </Suspense>
        )}
      </div>
    );
  }

  // account
  return (
    <div>
      <SectionTitle
        title={t('Conta pessoal', 'Cuenta personal', 'Personal account')}
        subtitle={t(
          'O seu perfil Etholys — separado da organização.',
          'Su perfil Etholys — separado de la organización.',
          'Your Etholys profile — separate from the organization.',
        )}
      />
      <EtholysSettingsContent accent="slate" hideHeader title="" sections={['profile', 'language', 'danger']} />
    </div>
  );
}

export default function EtholysAdminPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-teal-400/30 border-t-teal-300" />
        </div>
      }
    >
      <AdminSectionBody />
    </Suspense>
  );
}
