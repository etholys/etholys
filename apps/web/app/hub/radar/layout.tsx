'use client';

import { Suspense, useCallback, useMemo, type ReactNode } from 'react';
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
      { href: '/hub/radar', label: es ? 'Sitio' : en ? 'Site' : 'Sítio' },
      { href: '/hub/radar/cadeia', label: es ? 'Lotes' : en ? 'Lots' : 'Lotes' },
      { href: '/hub/radar/tarefas', label: es ? 'Avisos' : en ? 'Alerts' : 'Avisos' },
      { href: '/hub/radar/equipa', label: es ? 'Personas' : en ? 'People' : 'Pessoas' },
    ],
    [es, en],
  );

  const resolveNavHref = useCallback((item: { href: string }) => `${item.href}${qs}`, [qs]);

  return (
    <ProductAppShell
      product="radar"
      accent="teal"
      nav={nav}
      resolveNavHref={resolveNavHref}
      sidebarAfterCompany={<RadarClientPicker />}
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
