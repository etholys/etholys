'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { ChevronRight, Play } from 'lucide-react';
import { useApp } from '@/app/providers';
import {
  NEXUS_RUNWAY_CHAPTERS,
  activeRunwayId,
  isChapterComplete,
  runwayChapterLabel,
  withNetworkPath,
} from '@/lib/nexus-runway';
import { useNexusRunway } from './NexusRunwayContext';
import { cn } from '@/lib/utils';

function copy(locale: string) {
  if (locale === 'es') {
    return {
      title: 'Onde ficas no processo',
      detail:
        'NEXUS é um fluxo contínuo: fase, diagnóstico, rota viva, apoio, método. Abaixo, atalhos — sem voltar a tratar a incubação como “módulo 1”.',
      continue: 'Seguinte',
      allDone: 'Rever fase e metas',
    };
  }
  if (locale === 'en') {
    return {
      title: 'Where you are in the process',
      detail:
        'NEXUS is one flow: phase, diagnosis, live roadmap, support, method. Shortcuts below—incubation is the whole process, not “step 1.”',
      continue: 'Next',
      allDone: 'Review phase & goals',
    };
  }
  return {
    title: 'Onde ficas no processo',
    detail:
      'NEXUS é um fluxo contínuo: fase, diagnóstico, rota, apoio, método. Atalhos abaixo — a incubação é o processo todo, não “etapa 1”.',
    continue: 'Seguinte',
    allDone: 'Rever fase e metas',
  };
}

/** Barra mínima: sem “5 caixas” a competir com o ecrã. */
export function NexusRunwayBar() {
  const { locale } = useApp();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const networkId = searchParams.get('network');
  const { touch, metrics, continueHref, percent, done, total, loading } = useNexusRunway();
  const t = copy(locale);
  const L = locale === 'en' ? 'en' : locale === 'es' ? 'es' : 'pt';
  const active = activeRunwayId(pathname);
  const allComplete = NEXUS_RUNWAY_CHAPTERS.every((c) => isChapterComplete(c.id, touch, metrics));

  const isNexusHome = pathname === '/hub/nexus' || pathname === '/hub/nexus/';
  if (isNexusHome) {
    return null;
  }

  const isJourney = pathname === '/hub/nexus/journey' || pathname?.startsWith('/hub/nexus/journey/');

  if (isJourney) {
    return (
      <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2 text-center text-sm text-slate-600">
        {locale === 'es' ? (
          <>Para ver toda la trilha, volvé al resumen. Aquí ajustas solo la fase y el foco.</>
        ) : locale === 'en' ? (
          <>See the full path on the overview. Here you only adjust phase and focus.</>
        ) : (
          <>Para vês a trilha completa, usa a visão geral. Aqui ajustas só a fase e o foco.</>
        )}{' '}
        <Link href={withNetworkPath('/hub/nexus', networkId)} className="font-medium text-violet-700 underline">
          {locale === 'en' ? 'Overview' : locale === 'es' ? 'Resumen' : 'Visão geral'}
        </Link>
      </div>
    );
  }

  return (
    <section
      className="mb-4 rounded-xl border border-slate-200/90 bg-white px-3 py-3 shadow-sm sm:px-4"
      aria-label={t.title}
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-slate-900">{t.title}</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            {loading ? '…' : `${done}/${total} · ${percent}%`}{' '}
            <span className="text-slate-400">|</span>{' '}
            {NEXUS_RUNWAY_CHAPTERS.map((c, i) => {
              const href = withNetworkPath(c.path, networkId);
              const isOn = active === c.id;
              return (
                <span key={c.id}>
                  {i > 0 && <span className="text-slate-300"> · </span>}
                  <Link
                    href={href}
                    className={cn('font-medium', isOn ? 'text-violet-700' : 'text-slate-600 hover:text-violet-600')}
                  >
                    {runwayChapterLabel(c, L)}
                  </Link>
                </span>
              );
            })}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <div className="hidden h-1.5 w-24 overflow-hidden rounded-full bg-slate-200 sm:block sm:w-32" title={`${percent}%`}>
            <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${percent}%` }} />
          </div>
          <Link
            href={allComplete ? withNetworkPath('/hub/nexus/journey', networkId) : continueHref}
            className="inline-flex items-center justify-center gap-1 rounded-lg bg-violet-600 px-3 py-2 text-sm font-semibold text-white hover:bg-violet-700"
          >
            {allComplete ? t.allDone : t.continue}
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
      <details className="mt-2 border-t border-slate-100 pt-2 text-xs text-slate-500">
        <summary className="cursor-pointer select-none text-slate-500 hover:text-slate-700">
          {locale === 'es' ? 'Qué es esto' : locale === 'en' ? 'What is this' : 'O que é isto'}
        </summary>
        <p className="mt-1 leading-relaxed">{t.detail}</p>
      </details>
    </section>
  );
}

export function NexusRunwayContinueLink({
  collapsed,
  networkId,
  onNavigate,
}: {
  collapsed: boolean;
  networkId: string | null;
  onNavigate?: () => void;
}) {
  const { locale } = useApp();
  const { continueHref, touch, metrics } = useNexusRunway();
  const allComplete = NEXUS_RUNWAY_CHAPTERS.every((c) => isChapterComplete(c.id, touch, metrics));
  const href = allComplete ? withNetworkPath('/hub/nexus/journey', networkId) : continueHref;
  const label =
    locale === 'es' ? (allComplete ? 'Revisar' : 'Seguir') : locale === 'en' ? (allComplete ? 'Review' : 'Next') : allComplete ? 'Rever' : 'Seguinte';
  return (
    <Link
      href={href}
      title={label}
      onClick={() => onNavigate?.()}
      className={cn(
        'mb-1 flex items-center rounded-lg text-sm font-semibold transition',
        collapsed ? 'justify-center px-2 py-2.5' : 'gap-2 px-3 py-2.5',
        'bg-violet-600 text-white shadow-sm hover:bg-violet-700',
      )}
    >
      {collapsed ? <Play className="h-4 w-4 flex-shrink-0" /> : <ChevronRight className="h-4 w-4 flex-shrink-0" />}
      {!collapsed && <span>{label}</span>}
    </Link>
  );
}
