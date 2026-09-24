'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { ChevronRight, Play } from 'lucide-react';
import { useApp } from '@/app/providers';
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

function copy(locale: string) {
  if (locale === 'es') {
    return {
      title: 'Proceso de tu empresa activa',
      detail:
        'Esta barra sigue solo la empresa del selector (tu organización), no las MIPYMEs atendidas en Asistencia técnica. Cada cliente AT tiene su propio proceso en la ficha del contrato.',
      continue: 'Seguir',
      allDone: 'Revisar fase y metas',
    };
  }
  if (locale === 'en') {
    return {
      title: 'Active company process',
      detail:
        'This bar tracks only the company in the switcher (your org), not AT client MSMEs. Each assisted company has its own process on the contract page.',
      continue: 'Next',
      allDone: 'Review phase & goals',
    };
  }
  return {
    title: 'Processo da empresa ativa',
    detail:
      'Esta barra segue só a empresa do seletor (a tua organização), não as MIPYMEs atendidas em Assistência técnica. Cada cliente AT tem o seu processo na ficha do contrato.',
    continue: 'Seguinte',
    allDone: 'Rever fase e metas',
  };
}

/** Barra da jornada interna da empresa ativa — nunca na AT multi-cliente. */
export function NexusRunwayBar() {
  const { locale, activeCompanyId } = useApp();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const networkId = searchParams.get('network');
  const { touch, metrics, continueHref, percent, done, total, loading } = useNexusRunway();
  const active = activeRunwayId(pathname);
  const allComplete = NEXUS_RUNWAY_CHAPTERS.every((c) => isChapterComplete(c.id, touch, metrics));

  const isNexusHome = pathname === '/hub/nexus' || pathname === '/hub/nexus/';
  if (
    isNexusHome ||
    isNexusDeliverPath(pathname) ||
    isAtClientDiagnosisPath(pathname, searchParams, activeCompanyId)
  ) {
    return null;
  }

  const t = copy(locale);
  const L = locale === 'en' ? 'en' : locale === 'es' ? 'es' : 'pt';

  const isJourney = pathname === '/hub/nexus/journey' || pathname?.startsWith('/hub/nexus/journey/');

  if (isJourney) {
    return (
      <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2 text-center text-sm text-slate-600">
        {locale === 'es' ? (
          <>
            Aquí ajustas fase y foco de <strong>tu empresa activa</strong> (selector). La AT a clientes está en Asistencia
            técnica.
          </>
        ) : locale === 'en' ? (
          <>
            Adjust phase and focus for your <strong>active company</strong>. Client AT lives under Technical assistance.
          </>
        ) : (
          <>
            Aqui ajustas fase e foco da <strong>empresa ativa</strong> (seletor). A AT a clientes está em Assistência
            técnica.
          </>
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
            href={allComplete ? withNetworkPath('/hub/nexus/campo', networkId) : continueHref}
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
  const { locale, activeCompanyId } = useApp();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { continueHref, touch, metrics } = useNexusRunway();

  if (
    isNexusDeliverPath(pathname) ||
    isAtClientDiagnosisPath(pathname, searchParams, activeCompanyId)
  ) {
    return null;
  }

  const allComplete = NEXUS_RUNWAY_CHAPTERS.every((c) => isChapterComplete(c.id, touch, metrics));
  const href = allComplete ? withNetworkPath('/hub/nexus/campo', networkId) : continueHref;
  const label =
    locale === 'es'
      ? allComplete
        ? 'Revisar'
        : 'Seguir (mi empresa)'
      : locale === 'en'
        ? allComplete
          ? 'Review'
          : 'Next (my company)'
        : allComplete
          ? 'Rever'
          : 'Seguinte (minha empresa)';
  return (
    <Link
      href={href}
      title={label}
      onClick={() => onNavigate?.()}
      className={cn(
        'mb-1 flex items-center rounded-lg text-sm font-semibold transition',
        collapsed ? 'justify-center px-2 py-2.5' : 'gap-2 px-3 py-2.5',
        'bg-violet-600 text-white shadow-sm hover:bg-violet-700'
      )}
    >
      {collapsed ? <Play className="h-4 w-4 flex-shrink-0" /> : <ChevronRight className="h-4 w-4 flex-shrink-0" />}
      {!collapsed && <span>{label}</span>}
    </Link>
  );
}
