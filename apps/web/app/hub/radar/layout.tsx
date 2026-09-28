'use client';

import { ProductAppShell } from '@/components/etholys/ProductAppShell';

export default function RadarLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProductAppShell product="radar" accent="violet" nav={[{ href: '/hub/radar', label: 'Central' }]}>
      {children}
    </ProductAppShell>
  );
}
