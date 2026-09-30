'use client';

import { Suspense, useCallback, useEffect, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
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
  const pathname = usePathname();
  const router = useRouter();
  const {
    diagnosticHref,
    dossierHref,
    avanceHref,
    hasSelection,
    isAttendedViewer,
    loading,
  } = useAuroraAttended();

  // Negócio atendido: só Avance — redireciona ferramentas de técnico
  useEffect(() => {
    if (loading || !isAttendedViewer) return;
    const techPaths = ['/hub/aurora/diagnostico', '/hub/aurora/dossie', '/hub/aurora/programas', '/hub/aurora/contratos'];
    if (pathname === '/hub/aurora' || techPaths.some((p) => pathname?.startsWith(p))) {
      router.replace(hasSelection ? avanceHref : '/hub/aurora/avance');
    }
  }, [loading, isAttendedViewer, pathname, router, avanceHref, hasSelection]);

  const incubatorNav = [
    { href: '/hub/aurora', label: es ? 'Cartera' : en ? 'Portfolio' : 'Carteira' },
    {
      href: '/hub/aurora/diagnostico',
      label: es ? 'Acompañamiento' : en ? 'Accompaniment' : 'Acompanhamento',
      requiresAttended: true,
    },
    {
      href: '/hub/aurora/avance',
      label: es ? 'Avance' : en ? 'Progress' : 'Avanço',
      requiresAttended: true,
    },
    {
      href: '/hub/aurora/dossie',
      label: es ? 'Dossier' : en ? 'Dossier' : 'Dossiê',
      requiresAttended: true,
    },
    { href: '/hub/aurora/programas', label: es ? 'Programas' : en ? 'Programs' : 'Programas' },
    { href: '/hub/aurora/contratos', label: es ? 'Contratos' : en ? 'Contracts' : 'Contratos' },
  ];

  const attendedNav = [
    {
      href: '/hub/aurora/avance',
      label: es ? 'Mi avance' : en ? 'My progress' : 'O meu avanço',
    },
  ];

  const nav = isAttendedViewer ? attendedNav : incubatorNav;

  const resolveNavHref = useCallback(
    (item: { href: string; requiresAttended?: boolean }) => {
      if (isAttendedViewer) {
        return hasSelection ? avanceHref : '/hub/aurora/avance';
      }
      if (item.href === '/hub/aurora/diagnostico') {
        return hasSelection ? diagnosticHref : '/hub/aurora?pick=1';
      }
      if (item.href === '/hub/aurora/dossie') {
        return hasSelection ? dossierHref : '/hub/aurora?pick=1';
      }
      if (item.href === '/hub/aurora/avance') {
        return hasSelection ? avanceHref : '/hub/aurora?pick=1';
      }
      return item.href;
    },
    [isAttendedViewer, hasSelection, avanceHref, diagnosticHref, dossierHref],
  );

  return (
    <ProductAppShell
      product="aurora"
      accent="amber"
      nav={nav}
      sidebarAfterCompany={isAttendedViewer ? null : <AuroraAttendedPicker />}
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
