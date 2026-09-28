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
        { href: '/hub/aurora', label: es ? 'Cartera' : en ? 'Portfolio' : 'Carteira' },
        { href: '/hub/aurora/dossie', label: es ? 'Dossier' : en ? 'Dossier' : 'Dossiê' },
        { href: '/hub/aurora/programas', label: es ? 'Programas' : en ? 'Programs' : 'Programas' },
        { href: '/hub/aurora/contratos', label: es ? 'Contratos' : en ? 'Contracts' : 'Contratos' },
        { href: '/hub/radar', label: 'RADAR' },
      ]}
    >
      {children}
    </ProductAppShell>
  );
}
