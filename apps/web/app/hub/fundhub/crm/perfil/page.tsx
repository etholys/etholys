'use client';

import Link from 'next/link';
import { useApp } from '@/app/providers';
import { CrmSubnav } from '@/components/fundhub/CrmSubnav';
import { ContentLibraryPanel } from '@/components/fundhub/ContentLibraryPanel';
import { EligibilityProfileForm } from '@/components/fundhub/EligibilityProfileForm';

export default function CrmPerfilPage() {
  const { locale } = useApp();
  const t = (pt: string, es: string, en: string) =>
    locale === 'pt' ? pt : locale === 'es' ? es : en;

  return (
    <div className="space-y-6 text-gray-100">
      <CrmSubnav active="perfil" />
      <div>
        <h1 className="text-2xl font-bold text-white md:text-3xl">
          {t('Perfil institucional', 'Perfil institucional', 'Institutional profile')}
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-gray-400">
          {t(
            'Elegibilidade e voz da organização para match com financiadores e redacção.',
            'Elegibilidad y voz de la organización para match con financiadores y redacción.',
            'Org eligibility and voice for funder match and drafting.',
          )}
        </p>
        <Link
          href="/hub/fundhub/passport"
          className="mt-2 inline-block text-sm font-medium text-amber-300 hover:underline"
        >
          {t('Ver passaporte / readiness →', 'Ver pasaporte / readiness →', 'View passport / readiness →')}
        </Link>
      </div>
      <EligibilityProfileForm />
      <ContentLibraryPanel />
    </div>
  );
}
