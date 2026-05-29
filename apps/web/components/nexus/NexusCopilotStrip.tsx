'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { MessageCircle, Sparkles } from 'lucide-react';
import { useApp } from '@/app/providers';
import { stageLabel, type VentureStageId } from '@/lib/nexus-venture';
import { withNetworkPath } from '@/lib/nexus-runway';
import { cn } from '@/lib/utils';

type OverviewLite = {
  ventureStage: VentureStageId;
  metrics: {
    pendingRoadmapActions: number;
    openServiceTickets: number;
  };
};

function loc(locale: string) {
  if (locale === 'es') return 'es';
  if (locale === 'en') return 'en';
  return 'pt';
}

export function NexusCopilotStrip() {
  const { locale } = useApp();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const networkId = searchParams.get('network');
  const [data, setData] = useState<OverviewLite | null>(null);

  const hideStrip = useMemo(
    () =>
      pathname?.includes('/hub/nexus/coach') ||
      pathname === '/hub/nexus/journey' ||
      pathname?.startsWith('/hub/nexus/journey/') ||
      pathname === '/hub/nexus' ||
      pathname === '/hub/nexus/',
    [pathname],
  );

  useEffect(() => {
    if (hideStrip) return;
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
  }, [networkId, hideStrip]);

  if (hideStrip || !data) return null;

  const L = loc(locale);
  const cta = L === 'es' || L === 'pt' ? 'Abrir copiloto' : 'Open copilot';
  const stageName = stageLabel(data.ventureStage, L);
  const href = withNetworkPath('/hub/nexus/coach', networkId);
  const p = data.metrics.pendingRoadmapActions;
  const tix = data.metrics.openServiceTickets;

  return (
    <div
      className={cn(
        'mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-violet-200/60 bg-violet-50/40 px-3 py-2 text-sm text-slate-800',
      )}
    >
      <div className="flex min-w-0 items-center gap-2">
        <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-violet-600 text-white" aria-hidden>
          <Sparkles className="h-3.5 w-3.5" />
        </span>
        <p className="min-w-0 text-sm leading-snug">
          {L === 'es' ? (
            <>
              El copiloto conoce el estado: fase <strong>{stageName}</strong> · ruta: {p} abierta(s) · tickets: {tix}. Seguid
              hablando o pedid lo que falte.
            </>
          ) : L === 'en' ? (
            <>
              Your copilot sees: phase <strong>{stageName}</strong> · roadmap: {p} open · tickets: {tix}. Keep the dialogue
              going.
            </>
          ) : (
            <>
              O copiloto acompanha: fase <strong>{stageName}</strong> · rota viva: {p} em aberto · tickets: {tix}. Continuai
              a conversa ou peçam o que faltar.
            </>
          )}
        </p>
      </div>
      <Link
        href={href}
        className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-lg border border-violet-300 bg-white px-3 py-1.5 text-xs font-semibold text-violet-800 shadow-sm hover:bg-violet-50"
      >
        <MessageCircle className="h-3.5 w-3.5" />
        {cta}
      </Link>
    </div>
  );
}
