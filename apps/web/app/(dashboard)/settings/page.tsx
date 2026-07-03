'use client';

import Link from 'next/link';
import { useApp } from '@/app/providers';
import { EtholysSettingsContent } from '@/components/etholys-admin/EtholysSettingsContent';
import { ArrowRight, Layers } from 'lucide-react';

export default function SettingsPage() {
  const { tr, locale } = useApp();

  const t = (pt: string, es: string, en: string) =>
    locale === 'pt' ? pt : locale === 'es' ? es : en;

  return (
    <div className="space-y-4">
      <div className="max-w-3xl rounded-xl border border-teal-100 bg-teal-50/60 px-4 py-3 text-sm text-teal-900">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-2">
            <Layers className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-medium">{t('Definições ATLAS', 'Ajustes ATLAS', 'ATLAS settings')}</p>
              <p className="text-teal-800/90">
                {t(
                  'Departamentos e funções do ERP. Perfil, empresas, convites e licenças de sistemas estão na administração Etholys.',
                  'Departamentos y roles del ERP. Perfil, empresas, invitaciones y licencias están en la administración Etholys.',
                  'ERP departments and roles. Profile, companies, invitations, and system licenses live in Etholys administration.',
                )}
              </p>
            </div>
          </div>
          <Link
            href="/hub/admin"
            className="inline-flex items-center gap-1 rounded-lg bg-teal-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-teal-800"
          >
            {t('Administração Etholys', 'Administración Etholys', 'Etholys administration')}
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      <EtholysSettingsContent
        accent="teal"
        title={tr('nav.settings')}
        subtitle={t(
          'Estrutura interna do ATLAS (departamentos e funções)',
          'Estructura interna de ATLAS (departamentos y roles)',
          'ATLAS internal structure (departments and roles)',
        )}
        sections={['departments', 'roles']}
      />
    </div>
  );
}
