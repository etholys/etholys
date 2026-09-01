'use client';

import Link from 'next/link';
import { useApp } from '@/app/providers';
import { EtholysSettingsContent } from '@/components/etholys-admin/EtholysSettingsContent';
import { BillingOverview } from '@/components/etholys-admin/BillingOverview';
import { LicenseOverviewPanel } from '@/components/etholys-admin/LicenseOverviewPanel';
import { ArrowRight } from 'lucide-react';

export default function EtholysAdminPage() {
  const { locale, activeCompanyId } = useApp();

  const title =
    locale === 'pt' ? 'Conta e organização' : locale === 'es' ? 'Cuenta y organización' : 'Account & organization';

  const subtitle =
    locale === 'pt'
      ? 'Empresas, utilizadores, licenças e perfil da organização.'
      : locale === 'es'
        ? 'Empresas, usuarios, licencias y perfil de la organización.'
        : 'Companies, users, licenses, and organization profile.';

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-slate-900">
            {locale === 'pt' ? 'Licenciamento e pagamentos' : locale === 'es' ? 'Licencias y pagos' : 'Licensing & billing'}
          </h2>
          <Link href="/hub/billing" className="text-sm font-medium text-teal-700 hover:underline">
            {locale === 'pt' ? 'Contratar produtos' : locale === 'es' ? 'Contratar productos' : 'Subscribe to products'}
          </Link>
        </div>
        <BillingOverview companyId={activeCompanyId} />
      </div>

      <LicenseOverviewPanel />

      <EtholysSettingsContent
        accent="slate"
        title={title}
        subtitle={subtitle}
        sections={['profile', 'language', 'companies', 'invitations', 'systems', 'danger']}
      />

      <div className="max-w-3xl rounded-xl border border-slate-200 bg-white p-4 text-sm">
        <Link href="/hub/setup" className="inline-flex items-center gap-1 font-medium text-teal-700 hover:underline">
          {locale === 'pt' ? 'Perfil da organização' : locale === 'es' ? 'Perfil de la organización' : 'Organization profile'}
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}
