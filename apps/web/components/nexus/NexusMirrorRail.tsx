'use client';

import Link from 'next/link';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useApp } from '@/app/providers';
import { getNexusHybridCopy } from '@/lib/nexus-hybrid';
import { stageLabel, type VentureStageId } from '@/lib/nexus-venture';
import { NEXUS_RUNWAY_CHAPTERS, isChapterComplete } from '@/lib/nexus-runway';
import { useNexusRunway } from '@/components/nexus/NexusRunwayContext';
import type { NexusAdvisorMirrorState } from '@/lib/nexus-advisor-mirror';
import type { NexusQuickStep } from '@/lib/nexus-guides';
import { cn } from '@/lib/utils';

function pickLoc(loc: string) {
  if (loc === 'en') return 'en';
  if (loc === 'es') return 'es';
  return 'pt';
}

type Props = {
  withNet: (path: string) => string;
  ventureStage: VentureStageId;
  quickNextSteps: NexusQuickStep[];
  adjustStageLabel: string;
  pickStepText: (loc: string, s: NexusQuickStep) => { title: string; hint: string };
  loc: string;
  advisorMirror: NexusAdvisorMirrorState | null;
};

/** Coluna direita: estado simples — fase + trilha + um foco próximo + espelho mínimo do assessor */
export function NexusMirrorRail({
  withNet,
  ventureStage,
  quickNextSteps,
  adjustStageLabel,
  pickStepText,
  loc,
  advisorMirror,
}: Props) {
  const { locale } = useApp();
  const t = getNexusHybridCopy(locale);
  const L = pickLoc(loc);
  const { continueHref, percent, done, total, touch, metrics, loading: runwayLoading } = useNexusRunway();

  const labels =
    L === 'es'
      ? {
          position: 'Fase actual',
          path: 'Progreso',
          mirrorSummary: 'Resultados escritos desde la sesión del asesor',
          mirrorEmpty: 'Cuando pactéis cosas aquí el chat, podrás ver un resumen en esta sección.',
          moreSteps: 'Otros pasos que sugiere el programa',
          openDiagnosis: 'Abrir diagnóstico en pantalla',
        }
      : L === 'en'
        ? {
            position: 'Current phase',
            path: 'Progress',
            mirrorSummary: 'Written outputs from your advisor session',
            mirrorEmpty: 'When agreements are logged from chat, they can show briefly here.',
            moreSteps: 'Other programme steps',
            openDiagnosis: 'Open questionnaire screen',
          }
        : {
            position: 'Fase atual',
            path: 'Progresso na trilha',
            mirrorSummary: 'O que ficar registado desde a sessão com o assessor',
            mirrorEmpty: 'Quando acordares algo importante no chat, um resumo pode aparecer aqui.',
            moreSteps: 'Outros passos sugeridos pelo programa',
            openDiagnosis: 'Abrir diagnóstico em ecrã',
          };

  const stage = stageLabel(ventureStage, L);
  const allComplete = NEXUS_RUNWAY_CHAPTERS.every((c) => isChapterComplete(c.id, touch, metrics));

  const primaryHref = (() => {
    const high = quickNextSteps.find((s) => s.emphasis === 'high');
    if (high?.path) return high.path;
    if (allComplete) return withNet('/hub/nexus/journey');
    return continueHref;
  })();

  const continueLabel =
    L === 'es' ? (allComplete ? 'Revisar fase' : 'Seguir desde aquí →') : L === 'en' ? (allComplete ? 'Review phase' : 'Continue →') : allComplete ? 'Rever fase' : 'Seguir a partir daqui →';

  const focusStep = quickNextSteps.find((s) => s.emphasis === 'high') ?? quickNextSteps[0];
  const focusTx = focusStep ? pickStepText(loc, focusStep) : null;

  const hasMirrorBlocks =
    !!advisorMirror &&
    !!(advisorMirror.focalSummary || (advisorMirror.routeAgreed?.length ?? 0) > 0 || (advisorMirror.artifacts?.length ?? 0) > 0);

  const diagPath = quickNextSteps.find((s) => s.id === 'disc-1')?.path;

  return (
    <div className="flex w-full min-w-0 flex-col gap-5">
      <header className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{labels.position}</p>
        <p className="text-lg font-bold leading-tight text-slate-900 sm:text-xl">{stage}</p>
        <div>
          <div className="mb-1 flex items-center justify-between text-[11px] text-slate-500">
            <span>{labels.path}</span>
            <span>
              {runwayLoading ? '…' : `${done}/${total}`} · {runwayLoading ? '…' : `${percent}%`}
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200/90">
            <div
              className="h-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 transition-all duration-500"
              style={{ width: `${runwayLoading ? 0 : percent}%` }}
            />
          </div>
        </div>
      </header>

      {focusStep && focusTx && (
        <section className="rounded-2xl border border-violet-200/90 bg-white p-4 shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-wider text-violet-700">{t.conductorEyebrow}</p>
          <p className="mt-1.5 text-base font-bold text-slate-900">{focusTx.title}</p>
          <p className="mt-2 text-xs leading-snug text-slate-600">{focusTx.hint}</p>
          <Link
            href={primaryHref}
            className="mt-4 flex w-full items-center justify-center gap-1 rounded-xl bg-violet-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-violet-700"
          >
            {continueLabel}
            <ChevronRight className="h-4 w-4 opacity-90" />
          </Link>
          {diagPath && focusStep.id === 'disc-1' && (
            <p className="mt-3 text-center text-[11px] text-slate-500">
              <Link href={diagPath} className="underline-offset-2 hover:underline">
                {labels.openDiagnosis}
              </Link>
            </p>
          )}
          <p className="mt-3 text-[11px] text-slate-500">
            <Link href={withNet('/hub/nexus/journey')} className="text-violet-700 hover:underline">
              {adjustStageLabel}
            </Link>
          </p>
        </section>
      )}

      <details className={cn('group rounded-xl border px-3 py-2', hasMirrorBlocks ? 'border-violet-200 bg-violet-50/60' : 'border-dashed border-slate-200 bg-slate-50/80')}>
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-xs font-medium text-slate-700 marker:hidden [&::-webkit-details-marker]:hidden">
          <span>{labels.mirrorSummary}</span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-400 transition group-open:rotate-180" aria-hidden />
        </summary>
        <div className="mt-2 border-t border-slate-100/90 pt-2">
          {!hasMirrorBlocks ? (
            <p className="pb-2 text-xs leading-relaxed text-slate-500">{labels.mirrorEmpty}</p>
          ) : (
            <div className="space-y-2 pb-1 text-xs">
              {advisorMirror?.focalSummary && (
                <p className="rounded-lg border border-white/70 bg-white/90 px-2.5 py-2 text-slate-800">{advisorMirror.focalSummary}</p>
              )}
              {(advisorMirror?.routeAgreed?.length ?? 0) > 0 &&
                (advisorMirror!.routeAgreed ?? []).map((line) => (
                  <div key={line.id} className="rounded-lg border border-slate-100 bg-white px-2.5 py-1.5 text-slate-800">
                    <span className="font-medium">{line.title}</span>
                    {line.detail && <p className="mt-0.5 text-[11px] text-slate-600">{line.detail}</p>}
                  </div>
                ))}
              {(advisorMirror?.artifacts?.length ?? 0) > 0 &&
                (advisorMirror!.artifacts ?? []).map((a) => (
                  <div key={a.id} className="rounded-lg border border-teal-100 bg-teal-50/70 px-2.5 py-1.5">
                    <p className="text-[10px] font-semibold uppercase text-teal-800">{a.title}</p>
                    {a.excerpt && <p className="text-[11px] text-teal-900/95">{a.excerpt}</p>}
                  </div>
                ))}
            </div>
          )}
        </div>
      </details>

      {quickNextSteps.length > 1 && (
        <details className="group rounded-xl border border-slate-100 bg-white px-3 py-2">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-[11px] font-medium uppercase tracking-wide text-slate-500 marker:hidden [&::-webkit-details-marker]:hidden">
            {labels.moreSteps}
            <ChevronDown className="h-3.5 w-3.5 text-slate-400 transition group-open:rotate-180" aria-hidden />
          </summary>
          <ul className="mt-2 space-y-2 border-t border-slate-100 pt-2 text-xs text-slate-700">
            {quickNextSteps.slice(1).map((step) => {
              const tx = pickStepText(loc, step);
              return (
                <li key={step.id}>
                  <Link href={step.path} className="flex items-start gap-1.5 text-left hover:text-violet-800">
                    <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-slate-300" aria-hidden />
                    <span>
                      <span className="font-medium">{tx.title}</span>
                      <span className="block text-[11px] text-slate-500">{tx.hint}</span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </details>
      )}

      <p className="text-[11px] leading-snug text-slate-400">
        {t.humanRhythmBody}{' '}
        <Link href={withNet('/hub/nexus/services')} className="text-emerald-800/95 underline-offset-1 hover:underline">
          {t.humanRhythmCta}
        </Link>
      </p>
    </div>
  );
}
