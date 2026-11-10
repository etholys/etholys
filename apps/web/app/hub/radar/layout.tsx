'use client';

import { Suspense, useCallback, useMemo, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import {
  BookOpen,
  CheckSquare,
  LayoutDashboard,
  Plane,
  QrCode,
  Sparkles,
  Users,
  Workflow,
} from 'lucide-react';
import { ProductAppShell } from '@/components/etholys/ProductAppShell';
import { useApp } from '@/app/providers';
import {
  RadarClientScopeProvider,
  useRadarClientScope,
} from '@/components/radar/RadarClientScopeContext';
import { RadarClientPicker } from '@/components/radar/RadarClientPicker';
import { RadarCreatePanel } from '@/components/radar/RadarCreatePanel';
import { RadarGuidedTour } from '@/components/radar/RadarGuidedTour';
import { RadarOpsBar } from '@/components/radar/RadarOpsBar';
import { radarLoc, radarT } from '@/lib/radar/i18n';

function RadarShellInner({ children }: { children: ReactNode }) {
  const pathname = usePathname() || '';
  const { locale, activeCompanyId } = useApp();
  const { companyId, engagementId, scope } = useRadarClientScope();
  const loc = radarLoc(locale);
  const cid = companyId || activeCompanyId || '';
  /** Property map is Maps-like: icon rail + edge-to-edge canvas. */
  const onPropertyMap = pathname.includes('/radar/properties/');

  const qs = useMemo(() => {
    const q = new URLSearchParams();
    if (cid) q.set('company', cid);
    if (engagementId) q.set('engagement', engagementId);
    if (scope) q.set('client', scope);
    const s = q.toString();
    return s ? `?${s}` : '';
  }, [cid, engagementId, scope]);

  const fazer = radarT(loc, 'Fazer', 'Hacer', 'Do');
  const ver = radarT(loc, 'Ver', 'Ver', 'See');
  const nav = useMemo(
    () => [
      {
        href: '/hub/radar',
        label: radarT(loc, 'Painel', 'Panel', 'Dashboard'),
        detail: radarT(
          loc,
          'Visão geral dos lugares e alertas',
          'Vista general de lugares y alertas',
          'Overview of places and alerts',
        ),
        icon: LayoutDashboard,
        group: ver,
      },
      {
        href: '/hub/radar/cadeia',
        label: radarT(loc, 'Rastreio do lote', 'Rastreo del lote', 'Lot trace'),
        detail: radarT(
          loc,
          'Seguir o lote da produção ao destino',
          'Seguir el lote de la producción al destino',
          'Follow the lot from production to destination',
        ),
        icon: QrCode,
        group: ver,
      },
      {
        href: '/hub/radar/drone',
        label: radarT(loc, 'Drone', 'Drone', 'Drone'),
        group: fazer,
        detail: radarT(
          loc,
          'Mapeamento aéreo assistido',
          'Mapeo aéreo asistido',
          'Assisted aerial mapping',
        ),
        icon: Plane,
      },
      {
        href: '/hub/radar/caderno',
        label: radarT(loc, 'Caderno', 'Cuaderno', 'Notebook'),
        detail: radarT(
          loc,
          'Registos de campo e observações',
          'Registros de campo y observaciones',
          'Field logs and observations',
        ),
        icon: BookOpen,
        group: fazer,
      },
      {
        href: '/hub/radar/tarefas',
        label: radarT(loc, 'Tarefas', 'Tareas', 'Tasks'),
        detail: radarT(
          loc,
          'Trabalho do dia no terreno',
          'Trabajo del día en el terreno',
          'Day-to-day field work',
        ),
        icon: CheckSquare,
        group: fazer,
      },
      {
        href: '/hub/radar/assistente',
        label: radarT(loc, 'Assistente', 'Asistente', 'Assistant'),
        group: fazer,
        dataTour: 'assistant',
        detail: radarT(
          loc,
          'Conselho técnico e lembretes',
          'Consejo técnico y recordatorios',
          'Technical advice and reminders',
        ),
        icon: Sparkles,
      },
      {
        href: '/hub/radar/automatizacao',
        label: radarT(loc, 'Automatização', 'Automatización', 'Automation'),
        group: fazer,
        dataTour: 'automation',
        detail: radarT(
          loc,
          'Ligar sensores e regras',
          'Vincular sensores y reglas',
          'Bind sensors and rules',
        ),
        icon: Workflow,
      },
      {
        href: '/hub/radar/equipa',
        label: radarT(loc, 'Equipa e clientes', 'Equipo y clientes', 'Team and clients'),
        detail: radarT(
          loc,
          'Técnicos e clientes atendidos',
          'Técnicos y clientes atendidos',
          'Technicians and served clients',
        ),
        icon: Users,
      },
    ],
    [loc, fazer, ver],
  );

  const resolveNavHref = useCallback((item: { href: string }) => `${item.href}${qs}`, [qs]);

  return (
    <ProductAppShell
      product="radar"
      accent="teal"
      nav={nav}
      resolveNavHref={resolveNavHref}
      sidebarAfterCompany={<RadarClientPicker />}
      defaultCollapsed={onPropertyMap}
      canvasBleed={onPropertyMap}
    >
      <RadarOpsBar locale={loc} companyId={cid} engagementId={engagementId} tarefasHref={`/hub/radar/tarefas${qs}`} />
      <RadarCreatePanel locale={loc} />
      {cid ? <RadarGuidedTour companyId={cid} locale={loc} /> : null}
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
