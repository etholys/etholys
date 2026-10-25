'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bell } from 'lucide-react';
import { useRadarClientScopeOptional } from '@/components/radar/RadarClientScopeContext';
import { RADAR_SCOPE_OWN } from '@/lib/radar/client-scope';
import { radarLoc, radarT } from '@/lib/radar/i18n';

type Place = { title: string; detail: string };

function placeFor(
  pathname: string,
  loc: 'pt' | 'es' | 'en',
  contextLabel: string | null,
): Place {
  if (pathname.includes('/radar/properties/')) {
    return {
      title: radarT(loc, 'Dentro de um sítio', 'Dentro de un sitio', 'Inside a site'),
      detail: radarT(
        loc,
        'Mapa 3D no centro. Cultivos, espaços e sensores estão nos botões por cima do mapa.',
        'Mapa 3D en el centro. Cultivos, espacios y sensores están en los botones sobre el mapa.',
        '3D map in the center. Crops, spaces and sensors are the buttons above the map.',
      ),
    };
  }
  if (pathname.includes('/radar/empresas/')) {
    return {
      title: contextLabel || radarT(loc, 'Empresa', 'Empresa', 'Company'),
      detail: radarT(
        loc,
        'Avisos desta empresa e lista de lugares para abrir.',
        'Avisos de esta empresa y lista de lugares para abrir.',
        'Notices for this company and places to open.',
      ),
    };
  }
  if (pathname.includes('/radar/cadeia') || pathname.includes('/radar/lote')) {
    return {
      title: radarT(loc, 'Rastreio do lote', 'Rastreo del lote', 'Lot trace'),
      detail: radarT(
        loc,
        'O caminho do produto e o que aconteceu em cada etapa.',
        'El camino del producto y lo que pasó en cada etapa.',
        'The product path and what happened at each step.',
      ),
    };
  }
  if (pathname.includes('/radar/caderno')) {
    return {
      title: radarT(loc, 'Caderno', 'Cuaderno', 'Notebook'),
      detail: radarT(
        loc,
        'O gesto diário: o que aconteceu no sítio.',
        'El gesto diario: qué pasó en el sitio.',
        'The daily gesture: what happened on site.',
      ),
    };
  }
  if (pathname.includes('/radar/tarefas')) {
    return {
      title: radarT(loc, 'Tarefas', 'Tareas', 'Tasks'),
      detail: radarT(
        loc,
        'O que precisa de uma ação agora.',
        'Lo que necesita una acción ahora.',
        'What needs an action now.',
      ),
    };
  }
  if (pathname.includes('/radar/equipa')) {
    return {
      title: radarT(loc, 'Equipa', 'Equipo', 'Team'),
      detail: radarT(
        loc,
        'Quem entra nos sítios e nos clientes.',
        'Quién entra a los sitios y a los clientes.',
        'Who can open sites and clients.',
      ),
    };
  }
  return {
    title: radarT(loc, 'Painel da operação', 'Panel de la operación', 'Operations dashboard'),
    detail: contextLabel
      ? contextLabel
      : radarT(
          loc,
          'Onde estás, o que precisa atenção, e como abrir um lugar.',
          'Dónde estás, qué necesita atención, y cómo abrir un lugar.',
          'Where you are, what needs attention, and how to open a place.',
        ),
  };
}

export function RadarOpsBar({
  locale,
  companyId,
  engagementId,
  tarefasHref,
}: {
  locale: string;
  companyId: string;
  engagementId?: string | null;
  tarefasHref: string;
}) {
  const loc = radarLoc(locale);
  const pathname = usePathname() || '';
  const scopeCtx = useRadarClientScopeOptional();
  const scope = scopeCtx?.scope || RADAR_SCOPE_OWN;
  const contextLabel =
    scope === RADAR_SCOPE_OWN
      ? radarT(loc, 'Minha operação', 'Mi operación', 'My operation')
      : scope === 'all'
        ? radarT(loc, 'Toda a carteira', 'Toda la cartera', 'Full portfolio')
        : scopeCtx?.selectedClient?.name || null;

  const place = placeFor(pathname, loc, contextLabel);
  const onProperty = pathname.includes('/radar/properties/');
  const [count, setCount] = useState<number | null>(null);
  const [top, setTop] = useState<string | null>(null);

  useEffect(() => {
    if (!companyId) return;
    let cancelled = false;
    const q = new URLSearchParams({ companyId });
    if (engagementId) q.set('engagementId', engagementId);
    if (scope) q.set('clientId', scope);
    void fetch(`/api/radar/alerts?${q}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => {
        if (cancelled || !d || typeof d.count !== 'number') return;
        setCount(d.count);
        const first = Array.isArray(d.alerts) ? d.alerts[0] : null;
        const msg = first?.message?.[loc] || first?.message?.pt;
        setTop(typeof msg === 'string' ? msg : null);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [companyId, engagementId, loc, pathname, scope]);

  if (onProperty) return null;

  return (
    <div className="mb-4 flex flex-wrap items-stretch gap-2">
      <div className="min-w-[16rem] flex-1 rounded-xl border border-white/20 bg-slate-950 px-4 py-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
          {radarT(loc, 'Onde estás', 'Dónde estás', 'Where you are')}
        </p>
        <p className="mt-1 text-sm font-semibold text-white">{place.title}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-slate-300">{place.detail}</p>
      </div>
      <Link
        href={tarefasHref}
        className="flex min-w-[14rem] flex-1 items-center gap-3 rounded-xl border border-amber-400/40 bg-amber-950 px-4 py-3 text-amber-50"
      >
        <Bell className="h-4 w-4 shrink-0 text-amber-200" />
        <span className="min-w-0">
          <span className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-200/80">
            {radarT(loc, 'Avisos', 'Avisos', 'Notices')}
            {count != null ? ` · ${count}` : ''}
          </span>
          <span className="mt-0.5 block truncate text-sm font-medium text-amber-50">
            {top || radarT(loc, 'Abrir a lista do que fazer', 'Abrir la lista de qué hacer', 'Open the to-do list')}
          </span>
        </span>
      </Link>
    </div>
  );
}
