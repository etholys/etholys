'use client';

import { useCallback, useState } from 'react';
import Link from 'next/link';
import { useApp } from '@/app/providers';
import { EtholysSettingsContent } from '@/components/etholys-admin/EtholysSettingsContent';
import { BillingOverview } from '@/components/etholys-admin/BillingOverview';
import {
  AdminSetupGuide,
  type AdminSetupStepId,
} from '@/components/etholys-admin/AdminSetupGuide';
import { ArrowRight, Building2, CreditCard, Shield, User } from 'lucide-react';

type AdminTab = 'organization' | 'account';

export default function EtholysAdminPage() {
  const { locale, activeCompanyId } = useApp();
  const t = (pt: string, es: string, en: string) =>
    locale === 'pt' ? pt : locale === 'es' ? es : en;

  const [tab, setTab] = useState<AdminTab>('organization');
  const [focusSection, setFocusSection] = useState<string | null>(null);

  const goToStep = useCallback((step: AdminSetupStepId) => {
    setTab('organization');
    if (step === 'organization') setFocusSection('companies');
    else if (step === 'team') setFocusSection('invitations');
    else if (step === 'systems') setFocusSection('systems');
    else if (step === 'billing') setFocusSection('billing');
    requestAnimationFrame(() => {
      const el = document.getElementById(`admin-section-${step === 'organization' ? 'companies' : step === 'team' ? 'invitations' : step}`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white">
          {t('Administração', 'Administración', 'Administration')}
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-white/55">
          {t(
            'Organize a empresa e a equipa numa sequência clara. O perfil pessoal fica noutra área.',
            'Organice la empresa y el equipo en una secuencia clara. El perfil personal está en otra área.',
            'Set up the company and team in a clear sequence. Personal profile lives in a separate area.',
          )}
        </p>
      </div>

      <div
        className="inline-flex rounded-xl border border-white/10 bg-white/[0.04] p-1"
        role="tablist"
        aria-label={t('Áreas', 'Áreas', 'Areas')}
      >
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'organization'}
          onClick={() => setTab('organization')}
          className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition ${
            tab === 'organization'
              ? 'bg-teal-500/20 text-teal-100'
              : 'text-white/55 hover:bg-white/5 hover:text-white'
          }`}
        >
          <Building2 className="h-4 w-4" />
          {t('Organização', 'Organización', 'Organization')}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'account'}
          onClick={() => setTab('account')}
          className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition ${
            tab === 'account'
              ? 'bg-teal-500/20 text-teal-100'
              : 'text-white/55 hover:bg-white/5 hover:text-white'
          }`}
        >
          <User className="h-4 w-4" />
          {t('Conta pessoal', 'Cuenta personal', 'Personal account')}
        </button>
      </div>

      {tab === 'organization' ? (
        <div className="space-y-6">
          <AdminSetupGuide companyId={activeCompanyId} onGoToStep={goToStep} />

          <section id="admin-section-companies" className="scroll-mt-24">
            <EtholysSettingsContent
              accent="slate"
              hideHeader
              title=""
              sections={['companies']}
              highlight={focusSection === 'companies'}
            />
            <div className="mt-3">
              <Link
                href="/hub/setup"
                className="inline-flex items-center gap-1 text-sm font-medium text-teal-300/90 hover:text-teal-200 hover:underline"
              >
                {t(
                  'Perfil da organização (contexto Advisor)',
                  'Perfil de la organización (contexto Advisor)',
                  'Organization profile (Advisor context)',
                )}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </section>

          <section id="admin-section-invitations" className="scroll-mt-24">
            <EtholysSettingsContent
              accent="slate"
              hideHeader
              title=""
              sections={['invitations']}
              highlight={focusSection === 'invitations'}
            />
          </section>

          <section
            id="admin-section-systems"
            className={`scroll-mt-24 rounded-xl border p-5 shadow-sm transition ${
              focusSection === 'systems'
                ? 'border-teal-400/40 bg-teal-500/10'
                : 'border-white/10 bg-white/[0.04]'
            }`}
          >
            <h3 className="mb-2 flex items-center gap-2 font-semibold text-white">
              <Shield className="h-4 w-4 text-teal-300/80" />
              {t('Sistemas e permissões', 'Sistemas y permisos', 'Systems & permissions')}
            </h3>
            <p className="mb-4 text-sm text-white/55">
              {t(
                'Atribua módulos Etholys (ATLAS, SIEP, FundHub, etc.) a cada membro. Licenças de produto e lugares gerem-se em pagamentos.',
                'Asigne módulos Etholys (ATLAS, SIEP, FundHub, etc.) a cada miembro. Las licencias de producto y plazas se gestionan en pagos.',
                'Assign Etholys modules (ATLAS, SIEP, FundHub, etc.) to each member. Product licenses and seats are managed under billing.',
              )}
            </p>
            <Link
              href="/hub/workspace/team"
              className="inline-flex items-center gap-2 rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-900 transition hover:bg-white"
            >
              {t('Gerir equipa e acesso', 'Gestionar equipo y acceso', 'Manage team & access')}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </section>

          <section
            id="admin-section-billing"
            className={`scroll-mt-24 rounded-xl border p-5 shadow-sm transition ${
              focusSection === 'billing'
                ? 'border-teal-400/40 bg-teal-500/10'
                : 'border-white/10 bg-white/[0.04]'
            }`}
          >
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h3 className="flex items-center gap-2 font-semibold text-white">
                <CreditCard className="h-4 w-4 text-teal-300/80" />
                {t('Licenças e pagamentos', 'Licencias y pagos', 'Licenses & billing')}
              </h3>
              <Link
                href="/hub/billing"
                className="text-sm font-medium text-teal-300/90 hover:text-teal-200 hover:underline"
              >
                {t('Abrir loja', 'Abrir tienda', 'Open store')}
              </Link>
            </div>
            <BillingOverview companyId={activeCompanyId} />
          </section>
        </div>
      ) : (
        <div className="space-y-6">
          <p className="text-sm text-white/55">
            {t(
              'Dados da sua conta Etholys — não confundir com a organização.',
              'Datos de su cuenta Etholys — no confundir con la organización.',
              'Your Etholys account details — separate from the organization.',
            )}
          </p>
          <EtholysSettingsContent
            accent="slate"
            hideHeader
            title=""
            sections={['profile', 'language', 'danger']}
          />
        </div>
      )}
    </div>
  );
}
