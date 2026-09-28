'use client';

import { ProductAppShell } from '@/components/etholys/ProductAppShell';
import { useApp } from '@/app/providers';

export default function AuroraLayout({ children }: { children: React.ReactNode }) {
  const { locale } = useApp();
  const es = locale === 'es';
  const en = locale === 'en';
  return (
    <ProductAppShell
      product="aurora"
      accent="amber"
      nav={[
        { href: '/hub/aurora', label: es ? 'Dossier' : en ? 'Dossier' : 'Dossiê' },
        { href: '/hub/nexus/at', label: es ? 'Contratos' : en ? 'Contracts' : 'Contratos' },
        { href: '/hub/radar', label: 'RADAR' },
      ]}
    >
      {children}
    </ProductAppShell>
  );
}
