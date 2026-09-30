'use client';

import { Suspense, useMemo, type ReactNode } from 'react';
import { ProductAppShell } from '@/components/etholys/ProductAppShell';
import { useApp } from '@/app/providers';
import {
  RadarClientScopeProvider,
  useRadarClientScope,
} from '@/components/radar/RadarClientScopeContext';
import { RadarClientPicker } from '@/components/radar/RadarClientPicker';
import { RadarCreatePanel } from '@/components/radar/RadarCreatePanel';

function RadarShellInner({ children }: { children: ReactNode }) {
  const { locale, activeCompanyId } = useApp();
  const { companyId, engagementId, scope } = useRadarClientScope();
  const es = locale === 'es';
  const en = locale === 'en';
  const loc = es || en ? locale : 'pt';
  const cid = companyId || activeCompanyId || '';

  const qs = useMemo(() => {
    const q = new URLSearchParams();
    if (cid) q.set('company', cid);
    if (engagementId) q.set('engagement', engagementId);
    if (scope) q.set('client', scope);
    const s = q.toString();
    return s ? `?${s}` : '';
  }, [cid, engagementId, scope]);

  const nav = useMemo(
    () => [
      {
        href: `/hub/radar${qs}`,
        label: es ? 'Central' : en ? 'Home' : 'Central',
      },
    ],
    [qs, es, en],
  );

  return (
    <ProductAppShell product="radar" accent="violet" nav={nav} sidebarAfterCompany={<RadarClientPicker />}>
      <RadarCreatePanel locale={loc} />
      {children}
    </ProductAppShell>
  );
}

export default function RadarLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-[#07111A]" />}>
      <RadarClientScopeProvider>
        <RadarShellInner>{children}</RadarShellInner>
      </RadarClientScopeProvider>
    </Suspense>
  );
}
