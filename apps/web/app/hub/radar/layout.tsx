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
import { RadarOpsBar } from '@/components/radar/RadarOpsBar';

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
        href: '/hub/radar',
        label: es ? 'Panel' : en ? 'Dashboard' : 'Painel',
      },
      {
        href: '/hub/radar/cadeia',
        label: es ? 'Rastreo del lote' : en ? 'Lot trace' : 'Rastreio do lote',
      },
      {
        href: '/hub/radar/caderno',
        label: es ? 'Cuaderno' : en ? 'Notebook' : 'Caderno',
      },
      {
        href: '/hub/radar/tarefas',
        label: es ? 'Tareas' : en ? 'Tasks' : 'Tarefas',
      },
      {
        href: '/hub/radar/equipa',
        label: es ? 'Equipo y clientes' : en ? 'Team and clients' : 'Equipa e clientes',
      },
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
      <RadarOpsBar locale={loc} companyId={cid} engagementId={engagementId} tarefasHref={`/hub/radar/tarefas${qs}`} />
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
