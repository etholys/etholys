'use client';

import { ProductAppShell } from '@/components/etholys/ProductAppShell';

export default function PolarisLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProductAppShell product="polaris" accent="teal" nav={[]}>
      {children}
    </ProductAppShell>
  );
}
