'use client';

import { ProductAppShell } from '@/components/etholys/ProductAppShell';
import { useApp } from '@/app/providers';

export default function RadarLayout({ children }: { children: React.ReactNode }) {
  const { locale, activeCompanyId } = useApp();
  const es = locale === 'es';
  const en = locale === 'en';
  const q = activeCompanyId ? `?company=${activeCompanyId}` : '';

  return (
    <ProductAppShell
      product="radar"
      accent="violet"
      nav={[
        {
          href: `/hub/radar${q}`,
          label: es ? 'Central' : en ? 'Home' : 'Central',
        },
        {
          href: `/hub/radar/producer${q}`,
          label: es ? 'Productor' : en ? 'Producer' : 'Produtor',
        },
        {
          href: `/hub/radar/provider${q}`,
          label: es ? 'Prestadora' : en ? 'Provider' : 'Prestadora',
        },
      ]}
    >
      {children}
    </ProductAppShell>
  );
}
