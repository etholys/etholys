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
        group: es ? 'Ver' : en ? 'Look' : 'Ver',
        label: es ? 'Mapa de la operación' : en ? 'Operations map' : 'Mapa da operação',
        detail: es ? 'Entrá a un sitio para el mapa 3D' : en ? 'Open a site for the 3D map' : 'Entra num sítio para o mapa 3D',
      },
      {
        href: '/hub/radar/cadeia',
        group: es ? 'Seguir' : en ? 'Follow' : 'Seguir',
        label: es ? 'Rastreo del lote' : en ? 'Lot trace' : 'Rastreio do lote',
        detail: es ? 'Camino del producto y lo que pasó' : en ? 'Product path and what happened' : 'Caminho do produto e o que aconteceu',
      },
      {
        href: '/hub/radar/tarefas',
        group: es ? 'Hacer' : en ? 'Do' : 'Fazer',
        label: es ? 'Tareas' : en ? 'Tasks' : 'Tarefas',
        detail: es ? 'Qué hay que hacer ahora' : en ? 'What to do now' : 'O que há para fazer agora',
      },
      {
        href: '/hub/radar/equipa',
        group: es ? 'Quién' : en ? 'Who' : 'Quem',
        label: es ? 'Equipo y clientes' : en ? 'Team and clients' : 'Equipa e clientes',
        detail: es ? 'Técnicos y quién atiende cada sitio' : en ? 'Technicians and who covers each site' : 'Técnicos e quem trata de cada sítio',
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
