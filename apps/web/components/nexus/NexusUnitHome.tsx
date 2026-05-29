'use client';

import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { useApp } from '@/app/providers';
import { getNexusHybridCopy } from '@/lib/nexus-hybrid';
import { stageLabel, type VentureStageId } from '@/lib/nexus-venture';
import { NEXUS_RUNWAY_CHAPTERS, isChapterComplete } from '@/lib/nexus-runway';
import { useNexusRunway } from '@/components/nexus/NexusRunwayContext';
import type { NexusQuickStep } from '@/lib/nexus-guides';
import { NexusHomeChatTeaser } from '@/components/nexus/NexusHomeChatTeaser';
import { cn } from '@/lib/utils';

type Props = {
  withNet: (path: string) => string;
  networkId: string | null;
  ventureStage: VentureStageId;
  quickNextSteps: NexusQuickStep[];
  adjustStageLabel: string;
  pickStepText: (loc: string, s: NexusQuickStep) => { title: string; hint: string };
  loc: string;
  /** Coluna ao lado do copiloto: sem teaser de chat (conversa já está na esquerda) */
  density?: 'default' | 'split';
};

function pickLoc(loc: string) {
  if (loc === 'en') return 'en';
  if (loc === 'es') return 'es';
  return 'pt';
}

/**
 * Uma "lição" contínua: fase, progresso, continuar, passos em linha, conversa no mesmo fio
 * (espírito Duolingo: um caminho, não grelha gestão vs desenvolvimento).
 */
export function NexusUnitHome({
  withNet,
  networkId,
  ventureStage,
  quickNextSteps,
  adjustStageLabel,
  pickStepText,
  loc,
  density = 'default',
}: Props) {
  const { locale } = useApp();
  const t = getNexusHybridCopy(locale);
  const L = pickLoc(loc);
  const split = density === 'split';

  const railEyebrow =
    L === 'es'
      ? 'Tu posición en NEXUS'
      : L === 'en'
        ? 'Where you stand in NEXUS'
        : 'Onde estás na NEXUS';
  const { continueHref, percent, done, total, touch, metrics, loading: runwayLoading } = useNexusRunway();

  const allComplete = NEXUS_RUNWAY_CHAPTERS.every((c) => isChapterComplete(c.id, touch, metrics));
  const primaryHref = (() => {
    const high = quickNextSteps.find((s) => s.emphasis === 'high');
    if (high?.path) return high.path;
    if (allComplete) return withNet('/hub/nexus/journey');
    return continueHref;
  })();

  const continueLabel =
    L === 'es' ? (allComplete ? 'Revisar fase' : 'Continuar trilha') : L === 'en' ? (allComplete ? 'Review phase' : 'Continue path') : allComplete ? 'Rever fase' : 'Continuar a trilha';

  const stage = stageLabel(ventureStage, L);

  const focusStep = quickNextSteps.find((s) => s.emphasis === 'high') ?? quickNextSteps[0];
  const focusTx = focusStep ? pickStepText(loc, focusStep) : null;

  return (
    <div
      className={cn(
        'w-full space-y-1 pb-2',
        split ? 'max-w-none' : 'mx-auto max-w-md sm:max-w-xl md:max-w-2xl',
      )}
    >
      <div className={cn(split ? 'text-left' : 'text-center')}>
        {!split && (
          <p className="text-4xl" aria-hidden>
            🎯
          </p>
        )}
        {split ? (
          <div className="flex gap-3">
            <span className="text-2xl" aria-hidden>
              🎯
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-wider text-violet-700">{railEyebrow}</p>
              <h2 className="mt-0.5 text-xl font-extrabold tracking-tight text-slate-900 sm:text-2xl">{stage}</h2>
              <p className="mt-1 text-xs leading-relaxed text-slate-600 sm:text-sm">{t.unifiedTagline}</p>
            </div>
          </div>
        ) : (
          <>
            <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">{stage}</h1>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">{t.unifiedTagline}</p>
          </>
        )}
      </div>

      <div className={cn('pt-2', split && 'pt-4')}>
        <div className="mb-1 flex items-center justify-between text-xs text-slate-500">
          <span>{L === 'es' ? 'Trilha' : L === 'en' ? 'Path' : 'Trilha NEXUS'}</span>
          <span>
            {runwayLoading ? '…' : `${done}/${total}`} · {runwayLoading ? '…' : `${percent}%`}
          </span>
        </div>
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200/90">
          <div
            className="h-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 transition-all duration-500"
            style={{ width: `${runwayLoading ? 0 : percent}%` }}
          />
        </div>
      </div>

      {focusStep && focusTx && (
        <Link
          href={focusStep.path}
          className="mt-3 block rounded-2xl border border-violet-200/95 bg-white p-4 text-left shadow-sm ring-1 ring-violet-100/90 transition hover:border-violet-300 hover:shadow-md"
        >
          <p className="text-[11px] font-bold uppercase tracking-wider text-violet-700">{t.conductorEyebrow}</p>
          <p className="mt-1 text-base font-bold leading-snug text-slate-900">{focusTx.title}</p>
          <p className="mt-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">{t.conductorWhyLabel}</p>
          <p className="mt-1 text-sm leading-relaxed text-slate-700">{focusTx.hint}</p>
        </Link>
      )}

      <Link
        href={primaryHref}
        className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl bg-violet-600 py-3.5 text-base font-bold text-white shadow-md transition hover:bg-violet-700 active:scale-[0.99]"
      >
        {continueLabel}
        <ChevronRight className="h-5 w-5" />
      </Link>

      <p className={cn('pt-1 text-xs text-slate-500', split ? 'text-left' : 'text-center')}>
        <Link href={withNet('/hub/nexus/journey')} className="font-medium text-violet-700 underline-offset-2 hover:underline">
          {adjustStageLabel}
        </Link>
        {' · '}
        {t.oneFlowNote}
      </p>

      <div className="pt-4">
        <h2 className={cn('text-sm font-bold uppercase tracking-wide text-violet-800', split ? 'text-left' : 'text-center')}>
          {t.stepsHeading}
        </h2>
        <p className={cn('mb-2 text-xs text-slate-500', split ? 'text-left sm:max-w-md' : 'text-center')}>
          {L === 'es'
            ? 'Diagnóstico, ATLAS,Workspace… en un solo hilo, según vuestro nivel.'
            : L === 'en'
              ? 'Diagnosis, ATLAS, workspace—one thread, in order for your level.'
              : 'Diagnóstico, ATLAS, Workspace… o mesmo fio, por ordem, ao teu nível.'}
        </p>

        <ol className="ml-0.5 space-y-0 border-l-2 border-violet-200/90 pl-4">
          {quickNextSteps.map((step, i) => {
            const tx = pickStepText(loc, step);
            return (
              <li key={step.id} className="relative -ml-0.5">
                <span
                  className="absolute -left-[21px] top-4 h-2.5 w-2.5 rounded-full border-2 border-white bg-violet-500"
                  aria-hidden
                />
                <Link
                  href={step.path}
                  className={cn(
                    'group flex gap-3 py-2.5 pl-1 pr-1 transition',
                    'rounded-xl',
                    step.emphasis === 'high' ? 'bg-violet-50/90 hover:bg-violet-100/90' : 'hover:bg-slate-50/90',
                  )}
                >
                  <span
                    className={cn(
                      'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-extrabold',
                      step.emphasis === 'high' ? 'bg-violet-600 text-white' : 'bg-violet-100 text-violet-800',
                    )}
                  >
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1 text-left">
                    <span className="block text-sm font-semibold leading-snug text-slate-900 group-hover:underline">
                      {tx.title}
                    </span>
                    <span className="mt-0.5 block text-xs leading-snug text-slate-600">{tx.hint}</span>
                  </span>
                  <ChevronRight className="mt-2 h-4 w-4 shrink-0 text-slate-300 group-hover:text-violet-500" />
                </Link>
              </li>
            );
          })}
        </ol>
      </div>

      {!split && (
        <div className="pt-1">
          <h2 className="mb-1 text-center text-sm font-bold text-slate-800">{t.chatHeading}</h2>
          <NexusHomeChatTeaser withNet={withNet} variant="flow" />
        </div>
      )}

      <p className={cn('pt-2 text-xs leading-relaxed text-slate-500', split ? 'text-left' : 'text-center')}>
        {t.humanRhythmBody}{' '}
        <Link href={withNet('/hub/nexus/services')} className="font-medium text-emerald-800 underline-offset-1 hover:underline">
          {t.humanRhythmCta} →
        </Link>
      </p>
      {!split ? (
        <p className="text-center text-[11px] text-slate-400">{t.footnote}</p>
      ) : (
        <p className="text-left text-[11px] text-slate-400">{t.footnote}</p>
      )}
    </div>
  );
}
