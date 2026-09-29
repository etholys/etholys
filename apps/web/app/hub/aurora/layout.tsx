'use client';

import { Suspense, useCallback, type ReactNode } from 'react';
import { ProductAppShell } from '@/components/etholys/ProductAppShell';
import { useApp } from '@/app/providers';
import {
  AuroraAttendedProvider,
  useAuroraAttended,
} from '@/components/etholys/AuroraAttendedContext';
import { AuroraAttendedPicker } from '@/components/etholys/AuroraAttendedPicker';

function AuroraShellInner({ children }: { children: ReactNode }) {
  const { locale } = useApp();
  const es = locale === 'es';
  const en = locale === 'en';
  const { diagnosticHref, dossierHref, hasSelection } = useAuroraAttended();

  const nav = [
    { href: '/hub/aurora', label: es ? 'Cartera' : en ? 'Portfolio' : 'Carteira' },
    {
      href: '/hub/aurora/diagnostico',
      label: es ? 'Diagnóstico' : en ? 'Diagnostic' : 'Diagnóstico',
      requiresAttended: true,
    },
    {
      href: '/hub/aurora/dossie',
      label: es ? 'Dossier' : en ? 'Dossier' : 'Dossiê',
      requiresAttended: true,
    },
    { href: '/hub/aurora/programas', label: es ? 'Programas' : en ? 'Programs' : 'Programas' },
    { href: '/hub/aurora/contratos', label: es ? 'Contratos' : en ? 'Contracts' : 'Contratos' },
    { href: '/hub/radar', label: 'RADAR' },
  ];

  const resolveNavHref = useCallback(
    (item: { href: string; requiresAttended?: boolean }) => {
      if (item.href === '/hub/aurora/diagnostico') {
        return hasSelection ? diagnosticHref : '/hub/aurora?pick=1';
      }
      if (item.href === '/hub/aurora/dossie') {
        return hasSelection ? dossierHref : '/hub/aurora?pick=1';
      }
      return item.href;
    },
    [diagnosticHref, dossierHref, hasSelection],
  );

  return (
    <ProductAppShell
      product="aurora"
      accent="amber"
      nav={nav}
      sidebarAfterCompany={<AuroraAttendedPicker />}
      resolveNavHref={resolveNavHref}
    >
      {children}
    </ProductAppShell>
  );
}

export default function AuroraLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-[#07111A]" />}>
      <AuroraAttendedProvider>
        <AuroraShellInner>{children}</AuroraShellInner>
      </AuroraAttendedProvider>
    </Suspense>
  );
}
