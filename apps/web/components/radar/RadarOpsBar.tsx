'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bell } from 'lucide-react';
import { radarLoc, radarT } from '@/lib/radar/i18n';

type Place = { title: string; detail: string };

function placeFor(pathname: string, loc: 'pt' | 'es' | 'en'): Place {
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
    title: radarT(loc, 'Mapa da operação', 'Mapa de la operación', 'Operations map'),
    detail: radarT(
      loc,
      'Escolhe um sítio para abrir o mapa 3D, os cultivos e os sensores.',
      'Elegí un sitio para abrir el mapa 3D, los cultivos y los sensores.',
      'Pick a site to open the 3D map, crops and sensors.',
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
  const place = placeFor(pathname, loc);
  const [count, setCount] = useState<number | null>(null);
  const [top, setTop] = useState<string | null>(null);

  useEffect(() => {
    if (!companyId) return;
    let cancelled = false;
    const q = new URLSearchParams({ companyId });
    if (engagementId) q.set('engagementId', engagementId);
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
  }, [companyId, engagementId, loc, pathname]);

  return (
    <div className="mb-4 flex flex-wrap items-stretch gap-2">
      <div className="min-w-[16rem] flex-1 rounded-xl border border-white/15 bg-slate-950 px-4 py-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
          {radarT(loc, 'Onde estás', 'Dónde estás', 'Where you are')}
        </p>
        <p className="mt-1 text-sm font-semibold text-white">{place.title}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-slate-300">{place.detail}</p>
      </div>
      <Link
        href={tarefasHref}
        className="flex min-w-[14rem] flex-1 items-center gap-3 rounded-xl border border-amber-300/40 bg-amber-50 px-4 py-3 text-amber-950"
      >
        <Bell className="h-4 w-4 shrink-0" />
        <span className="min-w-0">
          <span className="block text-[10px] font-semibold uppercase tracking-[0.14em]">
            {radarT(loc, 'Avisos', 'Avisos', 'Notices')}
            {count != null ? ` · ${count}` : ''}
          </span>
          <span className="mt-0.5 block truncate text-sm font-medium">
            {top || radarT(loc, 'Abrir a lista do que fazer', 'Abrir la lista de qué hacer', 'Open the to-do list')}
          </span>
        </span>
      </Link>
    </div>
  );
}
