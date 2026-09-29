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
        { href: '/hub/polaris/diagnosis', label: es ? 'Línea base' : en ? 'Baseline' : 'Linha base' },
        { href: '/hub/polaris', label: es ? 'Consultor' : en ? 'Consultant' : 'Consultor' },
      ]}
    >
      {children}
    </ProductAppShell>
  );
}
