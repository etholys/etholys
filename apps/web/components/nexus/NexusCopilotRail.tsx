'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { MessageCircle, PanelRightClose, PanelRightOpen, Sparkles } from 'lucide-react';
import { useApp } from '@/app/providers';
import { stageLabel, type VentureStageId } from '@/lib/nexus-venture';
import {
  NEXUS_RUNWAY_CHAPTERS,
  activeRunwayId,
  isAtClientDiagnosisPath,
  isChapterComplete,
  isNexusDeliverPath,
  runwayChapterLabel,
  withNetworkPath,
} from '@/lib/nexus-runway';
import { useNexusRunway } from './NexusRunwayContext';
import { cn } from '@/lib/utils';

type OverviewLite = {
  ventureStage: VentureStageId;
  metrics: {
    pendingRoadmapActions: number;
    openServiceTickets: number;
  };
};

const STORAGE_KEY = 'nexus-copilot-rail-collapsed';

/**
 * Painel direito do NEXUS — copiloto + progresso curto.
 * Não empilha banners no conteúdo.
 */
export function NexusCopilotRail() {
  const { locale, activeCompanyId } = useApp();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const networkId = searchParams.get('network');
  const { touch, metrics, percent, done, total } = useNexusRunway();
  const [data, setData] = useState<OverviewLite | null>(null);
  const [collapsed, setCollapsed] = useState(false);

  const hide = useMemo(() => {
    if (isNexusDeliverPath(pathname)) return true;
    if (isAtClientDiagnosisPath(pathname, searchParams, activeCompanyId)) return true;
    if (pathname?.includes('/hub/nexus/coach')) return true;
    if (pathname === '/hub/nexus' || pathname === '/hub/nexus/') return true;
    return false;
  }, [pathname, searchParams, activeCompanyId]);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(STORAGE_KEY) === '1');
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (hide) return;
    const qs = networkId ? `?networkId=${encodeURIComponent(networkId)}` : '';
    let cancelled = false;
    fetch(`/api/nexus/overview${qs}`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled || d.error || !d.ventureStage || !d.metrics) return;
        setData({ ventureStage: d.ventureStage, metrics: d.metrics });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [networkId, hide]);

  const toggle = () => {
    setCollapsed((v) => {
      const next = !v;
      try {
        localStorage.setItem(STORAGE_KEY, next ? '1' : '0');
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  if (hide) return null;

  const L = locale === 'es' ? 'es' : locale === 'en' ? 'en' : 'pt';
  const coachHref = withNetworkPath('/hub/nexus/coach', networkId);
  const stageName = data ? stageLabel(data.ventureStage, L) : '—';
  const active = activeRunwayId(pathname);
  const m = metrics || data?.metrics
    ? {
        pendingRoadmapActions:
          metrics?.pendingRoadmapActions ?? data?.metrics.pendingRoadmapActions ?? 0,
        completedRoadmapActions: metrics?.completedRoadmapActions ?? 0,
        openServiceTickets: metrics?.openServiceTickets ?? data?.metrics.openServiceTickets ?? 0,
      }
    : null;

  if (collapsed) {
    return (
      <aside className="hidden w-12 shrink-0 flex-col border-l border-white/10 bg-[#07111A]/88 lg:flex">
        <button
          type="button"
          onClick={toggle}
          className="flex h-12 w-full items-center justify-center text-teal-200 hover:bg-white/5"
          title={L === 'es' ? 'Abrir panel' : L === 'en' ? 'Open panel' : 'Abrir painel'}
        >
          <PanelRightOpen className="h-5 w-5" />
        </button>
        <Link
          href={coachHref}
          className="mx-auto mt-2 flex h-9 w-9 items-center justify-center rounded-lg bg-teal-500/15 text-teal-100 hover:bg-teal-500/25"
          title={L === 'es' || L === 'pt' ? 'Copiloto' : 'Copilot'}
        >
          <Sparkles className="h-4 w-4" />
        </Link>
      </aside>
    );
  }

  return (
    <aside className="hidden w-64 shrink-0 flex-col border-l border-white/10 bg-[#07111A]/88 lg:flex xl:w-72">
      <div className="flex items-center justify-between border-b border-white/10 px-3 py-2.5">
        <div className="flex items-center gap-2 text-sm font-semibold text-white">
          <Sparkles className="h-4 w-4 text-teal-300" />
          {L === 'es' || L === 'pt' ? 'Copiloto' : 'Copilot'}
        </div>
        <button
          type="button"
          onClick={toggle}
          className="rounded-lg p-1.5 text-white/50 hover:bg-white/5 hover:text-white"
          title={L === 'es' ? 'Minimizar' : L === 'en' ? 'Collapse' : 'Minimizar'}
        >
          <PanelRightClose className="h-4 w-4" />
        </button>
      </div>

      <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-3">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-white/50">
            {L === 'es' ? 'Fase' : L === 'en' ? 'Phase' : 'Fase'}
          </p>
          <p className="mt-1 text-sm font-medium text-white">{stageName}</p>
        </div>

        <Link
          href={coachHref}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-teal-500/15 px-3 py-2.5 text-sm font-medium text-teal-100 hover:bg-teal-500/25"
        >
          <MessageCircle className="h-4 w-4 text-teal-300" />
          {L === 'es' || L === 'pt' ? 'Abrir chat' : 'Open chat'}
        </Link>

        <div>
          <div className="mb-2 flex items-center justify-between text-[11px] text-white/60">
            <span className="font-medium uppercase tracking-wide">
              {L === 'es' ? 'Progreso' : L === 'en' ? 'Progress' : 'Progresso'}
            </span>
            <span>
              {done}/{total} · {percent}%
            </span>
          </div>
          <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-teal-400 transition-all" style={{ width: `${percent}%` }} />
          </div>
          <ul className="space-y-1">
            {NEXUS_RUNWAY_CHAPTERS.map((c) => {
              const complete = isChapterComplete(c.id, touch, m);
              const on = active === c.id;
              return (
                <li key={c.id}>
                  <Link
                    href={withNetworkPath(c.path, networkId)}
                    className={cn(
                      'flex items-center gap-2 rounded-md px-2 py-1.5 text-xs transition',
                      on ? 'bg-teal-500/15 font-medium text-teal-100' : 'text-white/70 hover:bg-white/5 hover:text-white'
                    )}
                  >
                    <span
                      className={cn(
                        'h-1.5 w-1.5 shrink-0 rounded-full',
                        complete ? 'bg-emerald-400' : on ? 'bg-teal-400' : 'bg-white/25'
                      )}
                    />
                    {runwayChapterLabel(c, L)}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </aside>
  );
}
