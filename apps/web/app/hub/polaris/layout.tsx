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
        { href: '/hub/polaris/portrait', label: es ? 'Retrato' : en ? 'Portrait' : 'Retrato' },
        { href: '/hub/polaris/diagnosis', label: es ? 'Diagnóstico' : en ? 'Diagnosis' : 'Diagnóstico' },
        { href: '/hub/polaris/roadmap', label: es ? 'Hoja de ruta' : en ? 'Roadmap' : 'Roteiro' },
        { href: '/hub/polaris/coach', label: es ? 'Coach' : en ? 'Coach' : 'Coach' },
      ]}
    >
      {children}
    </ProductAppShell>
  );
}
