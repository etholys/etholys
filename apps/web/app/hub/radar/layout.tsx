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
        {
          href: '/hub/radar?view=empresa',
          label: es ? 'Empresa' : en ? 'Company' : 'Empresa',
        },
        {
          href: '/hub/radar?view=tecnico',
          label: es ? 'Técnico' : en ? 'Field' : 'Técnico',
        },
      ]}
    >
      {children}
    </ProductAppShell>
  );
}
