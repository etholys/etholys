'use client';

import { ProductAppShell } from '@/components/etholys/ProductAppShell';
import { useApp } from '@/app/providers';

export default function PolarisLayout({ children }: { children: React.ReactNode }) {
  const { locale } = useApp();
  const es = locale === 'es';
  const en = locale === 'en';
  return (
    <ProductAppShell
      product="polaris"
      accent="teal"
      nav={[
        { href: '/hub/polaris', label: es ? 'Mapa' : en ? 'Map' : 'Mapa' },
        { href: '/hub/radar', label: 'RADAR' },
      ]}
    >
      {children}
    </ProductAppShell>
  );
}
