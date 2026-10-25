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
  if (pathname.includes('/radar/assistente')) {
    return {
      title: radarT(loc, 'Assistente', 'Asistente', 'Assistant'),
      detail: radarT(
        loc,
        'Conselho técnico, fotos e lembretes de setup.',
        'Consejo técnico, fotos y recordatorios de setup.',
        'Technical advice, photos and setup reminders.',
      ),
    };
  }
  if (pathname.includes('/radar/automatizacao')) {
    return {
      title: radarT(loc, 'Automatização', 'Automatización', 'Automation'),
      detail: radarT(
        loc,
        'Ligar aparelho ao espaço e regra humidade → válvula.',
        'Vincular equipo al espacio y regla humedad → válvula.',
        'Bind a device to a space and moisture → valve rule.',
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

  const onHome = pathname === '/hub/radar' || pathname === '/hub/radar/';

  // Home already owns status + attention — don't stack another avisos strip.
  if (onProperty || onHome) return null;

  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] pb-4">
      <div className="min-w-0">
        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-white/35">
          {radarT(loc, 'Onde estás', 'Dónde estás', 'Where you are')}
        </p>
        <p className="mt-0.5 text-sm font-semibold text-white">{place.title}</p>
        <p className="mt-0.5 max-w-xl text-xs leading-relaxed text-white/45">{place.detail}</p>
      </div>
      {count != null && count > 0 ? (
        <Link
          href={tarefasHref}
          className="inline-flex shrink-0 items-center gap-2 rounded-full border border-amber-400/30 bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-100 transition hover:bg-amber-500/15"
        >
          <Bell className="h-3.5 w-3.5" />
          {count} {radarT(loc, 'avisos', 'avisos', 'notices')}
          {top ? <span className="hidden max-w-[12rem] truncate text-amber-100/60 sm:inline">· {top}</span> : null}
        </Link>
      ) : null}
    </div>
  );
}
