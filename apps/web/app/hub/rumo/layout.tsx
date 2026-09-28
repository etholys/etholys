'use client';

import { ProductAppShell } from '@/components/etholys/ProductAppShell';
import { useApp } from '@/app/providers';

export default function RumoLayout({ children }: { children: React.ReactNode }) {
  const { locale } = useApp();
  const es = locale === 'es';
  const en = locale === 'en';
  return (
    <ProductAppShell
      product="rumo"
      accent="teal"
      nav={[
        { href: '/hub/rumo', label: es ? 'Mapa' : en ? 'Map' : 'Mapa' },
        { href: '/hub/pulso', label: 'PULSO' },
      ]}
    >
      {children}
    </ProductAppShell>
  );
}
