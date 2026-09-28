'use client';

import { ProductAppShell } from '@/components/etholys/ProductAppShell';
import { useApp } from '@/app/providers';

export default function PulsoLayout({ children }: { children: React.ReactNode }) {
  const { locale } = useApp();
  const es = locale === 'es';
  return (
    <ProductAppShell
      product="pulso"
      accent="violet"
      nav={[
        { href: '/hub/pulso', label: es ? 'Central' : 'Central' },
        { href: '/hub/rumo', label: 'RUMO' },
        { href: '/hub/nido', label: 'NIDO' },
      ]}
    >
      {children}
    </ProductAppShell>
  );
}
