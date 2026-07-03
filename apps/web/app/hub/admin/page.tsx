'use client';

import Link from 'next/link';
import { useApp } from '@/app/providers';
import { EtholysSettingsContent } from '@/components/etholys-admin/EtholysSettingsContent';
import { LicenseOverviewPanel } from '@/components/etholys-admin/LicenseOverviewPanel';
import { ArrowRight } from 'lucide-react';

export default function EtholysAdminPage() {
  const { locale } = useApp();

  const title =
    locale === 'pt' ? 'Conta e organização' : locale === 'es' ? 'Cuenta y organización' : 'Account & organization';

  const subtitle =
    locale === 'pt'
      ? 'Configurações da plataforma Etholys — empresas, utilizadores, sistemas licenciados e perfil. Cada módulo (ATLAS, SIEP, etc.) tem as suas próprias definições internas.'
      : locale === 'es'
        ? 'Ajustes de la plataforma Etholys — empresas, usuarios, sistemas licenciados y perfil. Cada módulo (ATLAS, SIEP, etc.) tiene sus propios ajustes.'
        : 'Etholys platform settings — companies, users, licensed systems, and profile. Each module (ATLAS, SIEP, etc.) has its own settings.';

  const workspaceNote =
    locale === 'pt'
      ? 'Utilizadores com vários sistemas podem usar o centro integrado como ponto de entrada diário.'
      : locale === 'es'
        ? 'Usuarios con varios sistemas pueden usar el centro integrado como punto de entrada.'
        : 'Users with multiple systems can use the integrated workspace as their daily entry point.';

  return (
    <div className="space-y-6">
      <LicenseOverviewPanel />

      <EtholysSettingsContent
        accent="slate"
        title={title}
        subtitle={subtitle}
        sections={['profile', 'language', 'companies', 'invitations', 'systems', 'danger']}
      />

      <div className="max-w-3xl rounded-xl border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-600">
        <p>{workspaceNote}</p>
        <Link href="/hub/workspace" className="mt-2 inline-flex items-center gap-1 font-medium text-slate-800 hover:underline">
          {locale === 'pt' ? 'Abrir centro integrado' : locale === 'es' ? 'Abrir centro integrado' : 'Open integrated workspace'}
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}
