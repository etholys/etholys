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

  const fazer = es ? 'Hacer' : en ? 'Do' : 'Fazer';
  const ver = es ? 'Ver' : en ? 'See' : 'Ver';
  const nav = useMemo(
    () => [
      {
        href: '/hub/radar',
        label: es ? 'Panel' : en ? 'Dashboard' : 'Painel',
        group: ver,
      },
      {
        href: '/hub/radar/cadeia',
        label: es ? 'Rastreo del lote' : en ? 'Lot trace' : 'Rastreio do lote',
        group: ver,
      },
      {
        href: '/hub/radar/caderno',
        label: es ? 'Cuaderno' : en ? 'Notebook' : 'Caderno',
        group: fazer,
      },
      {
        href: '/hub/radar/tarefas',
        label: es ? 'Tareas' : en ? 'Tasks' : 'Tarefas',
        group: fazer,
      },
      {
        href: '/hub/radar/assistente',
        label: es ? 'Asistente' : en ? 'Assistant' : 'Assistente',
        group: fazer,
        detail: es
          ? 'Consejo técnico y recordatorios'
          : en
            ? 'Technical advice and reminders'
            : 'Conselho técnico e lembretes',
      },
      {
        href: '/hub/radar/automatizacao',
        label: es ? 'Automatización' : en ? 'Automation' : 'Automatização',
        group: fazer,
        detail: es
          ? 'Vincular sensores y reglas'
          : en
            ? 'Bind sensors and rules'
            : 'Ligar sensores e regras',
      },
      {
        href: '/hub/radar/equipa',
        label: es ? 'Equipo y clientes' : en ? 'Team and clients' : 'Equipa e clientes',
      },
    ],
    [es, en, fazer, ver],
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
