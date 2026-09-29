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
  const { companyId, engagementId, role, roleLoading, clientScope } = useRadarClientScope();
  const es = locale === 'es';
  const en = locale === 'en';
  const loc = es || en ? locale : 'pt';
  const cid = companyId || activeCompanyId || '';

  const qs = useMemo(() => {
    const q = new URLSearchParams();
    if (cid) q.set('company', cid);
    if (engagementId) q.set('engagement', engagementId);
    if (role === 'provider' && clientScope) q.set('client', clientScope);
    const s = q.toString();
    return s ? `?${s}` : '';
  }, [cid, engagementId, role, clientScope]);

  const nav = useMemo(() => {
    if (roleLoading) {
      return [{ href: `/hub/radar${qs}`, label: es ? 'Central' : en ? 'Home' : 'Central' }];
    }
    if (role === 'provider') {
      return [
        {
          href: `/hub/radar/provider${qs}`,
          label: es ? 'Central' : en ? 'Home' : 'Central',
        },
      ];
    }
    if (role === 'producer') {
      return [
        {
          href: `/hub/radar/producer${qs}`,
          label: es ? 'Central' : en ? 'Home' : 'Central',
        },
      ];
    }
    return [{ href: `/hub/radar${cid ? `?company=${cid}` : ''}`, label: es ? 'Central' : en ? 'Home' : 'Central' }];
  }, [role, roleLoading, qs, cid, engagementId, es, en]);

  return (
    <ProductAppShell
      product="radar"
      accent="violet"
      nav={nav}
      sidebarAfterCompany={role === 'provider' ? <RadarClientPicker /> : null}
    >
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
