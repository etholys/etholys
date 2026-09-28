'use client';

import { ProductAppShell } from '@/components/etholys/ProductAppShell';
import { useApp } from '@/app/providers';

export default function RadarLayout({ children }: { children: React.ReactNode }) {
  const { locale } = useApp();
  const es = locale === 'es';
  const en = locale === 'en';

  return (
    <ProductAppShell
      product="radar"
      accent="violet"
      nav={[
        {
          href: '/hub/radar',
          label: es ? 'Central' : en ? 'Home' : 'Central',
        },
      ]}
    >
      {children}
    </ProductAppShell>
  );
}
