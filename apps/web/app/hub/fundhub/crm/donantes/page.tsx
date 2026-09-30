'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { useApp } from '@/app/providers';
import { isLikelyDbId } from '@/lib/utils';
import { CrmSubnav } from '@/components/fundhub/CrmSubnav';
import { FunderImportPanel } from '@/components/fundhub/FunderImportPanel';

export default function CrmDonantesPage() {
  const { locale, activeCompanyId } = useApp();
  const companyId = useMemo(() => {
    const s = String(activeCompanyId ?? '').trim();
    return isLikelyDbId(s) ? s : '';
  }, [activeCompanyId]);
  const t = (pt: string, es: string, en: string) =>
    locale === 'pt' ? pt : locale === 'es' ? es : en;

  return (
    <div className="space-y-6 text-gray-100">
      <CrmSubnav active="donantes" />
      <div>
        <h1 className="text-2xl font-bold text-white md:text-3xl">
          {t('Doadores / financiadores', 'Donantes / financiadores', 'Donors / funders')}
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-gray-400">
          {t(
            'Base de financiadores conhecidos da organização — importação e ligação ao pipeline Em curso.',
            'Base de financiadores conocidos de la organización — importación y enlace al pipeline En curso.',
            'Org known-funder base — import and link to In-progress pipeline.',
          )}
        </p>
        <Link
          href="/hub/fundhub/my-funds"
          className="mt-2 inline-block text-sm font-medium text-amber-300 hover:underline"
        >
          {t('Abrir Em curso →', 'Abrir En curso →', 'Open In progress →')}
        </Link>
      </div>
      {companyId ? (
        <FunderImportPanel companyId={companyId} />
      ) : (
        <p className="text-sm text-gray-400">
          {t('Seleccione uma empresa.', 'Seleccione una empresa.', 'Select a company.')}
        </p>
      )}
    </div>
  );
}
