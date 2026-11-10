'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { radarLoc, radarT } from '@/lib/radar/i18n';
import {
  RADAR_TOUR_EVENT,
  clearTourProgress,
  dispatchTourControl,
  readTourProgress,
  startTourProgress,
  stepsForMode,
  writeTourProgress,
  type RadarTourControlDetail,
  type RadarTourProgress,
  type RadarTourStepDef,
} from '@/lib/radar/tour';
import { cn } from '@/lib/utils';

type Rect = { top: number; left: number; width: number; height: number };

function measureTarget(selector: string): Rect | null {
  if (typeof document === 'undefined') return null;
  const el = document.querySelector(selector) as HTMLElement | null;
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.width < 2 && r.height < 2) return null;
  const pad = 8;
  return {
    top: Math.max(0, r.top - pad),
    left: Math.max(0, r.left - pad),
    width: Math.min(window.innerWidth - 8, r.width + pad * 2),
    height: Math.min(window.innerHeight - 8, r.height + pad * 2),
  };
}

/**
 * Compact Etholys coach-mark tour for RADAR first-run.
 * Spotlight + next/back/skip; does not hard-block the map (pointer-events only on chrome).
 */
export function RadarGuidedTour({
  companyId,
  locale,
}: {
  companyId: string;
  locale: string;
}) {
  const loc = radarLoc(locale);
  const { data: session } = useSession();
  const userId = (session?.user as { id?: string } | undefined)?.id || session?.user?.email || null;
  const pathname = usePathname() || '';
  const searchParams = useSearchParams();
  const router = useRouter();

  const [active, setActive] = useState(false);
  const [progress, setProgress] = useState<RadarTourProgress | null>(null);
  const [rect, setRect] = useState<Rect | null>(null);
  const [missing, setMissing] = useState(false);

  const mode = progress?.mode || 'property';
  const steps = useMemo(() => stepsForMode(mode), [mode]);
  const stepIndex = Math.min(Math.max(progress?.stepIndex ?? 0, 0), Math.max(0, steps.length - 1));
  const step: RadarTourStepDef | null = active && steps.length ? steps[stepIndex] || null : null;

  const persist = useCallback(
    (next: RadarTourProgress) => {
      setProgress(next);
      writeTourProgress(companyId, next, userId);
    },
    [companyId, userId],
  );

  const stop = useCallback(
    (done: boolean) => {
      if (!companyId) return;
      const next: RadarTourProgress = {
        v: 1,
        done,
        stepIndex: done ? steps.length : stepIndex,
        mode,
        updatedAt: new Date().toISOString(),
      };
      persist(next);
      setActive(false);
      setRect(null);
      // Strip ?tour= from URL without reload.
      if (searchParams?.get('tour')) {
        const q = new URLSearchParams(searchParams.toString());
        q.delete('tour');
        const qs = q.toString();
        router.replace(`${pathname}${qs ? `?${qs}` : ''}`, { scroll: false });
      }
    },
    [companyId, mode, pathname, persist, router, searchParams, stepIndex, steps.length],
  );

  const begin = useCallback(
    (m: 'home' | 'property') => {
      if (!companyId) return;
      const next = startTourProgress(m);
      persist(next);
      setActive(true);
      const open = stepsForMode(m)[0]?.open || null;
      if (open) {
        window.dispatchEvent(new CustomEvent('radar-tour:open-step', { detail: { open } }));
      }
    },
    [companyId, persist],
  );

  // Listen for start/restart/stop from UI.
  useEffect(() => {
    if (!companyId) return;
    const onControl = (ev: Event) => {
      const detail = (ev as CustomEvent<RadarTourControlDetail>).detail;
      if (!detail) return;
      if (detail.action === 'stop') {
        stop(true);
        return;
      }
      if (detail.action === 'restart') {
        clearTourProgress(companyId, userId);
        const preferHome = pathname === '/hub/radar' || pathname === '/hub/radar/';
        begin(preferHome ? 'home' : 'property');
        return;
      }
      if (detail.action === 'start') {
        begin(detail.mode || (pathname.includes('/radar/properties/') ? 'property' : 'home'));
      }
    };
    window.addEventListener(RADAR_TOUR_EVENT, onControl);
    return () => window.removeEventListener(RADAR_TOUR_EVENT, onControl);
  }, [begin, companyId, pathname, stop, userId]);

  // URL ?tour=1|restart and restore unfinished progress.
  useEffect(() => {
    if (!companyId) return;
    const flag = searchParams?.get('tour');
    if (flag === 'restart') {
      clearTourProgress(companyId, userId);
      begin(pathname.includes('/radar/properties/') ? 'property' : 'home');
      return;
    }
    if (flag === '1' || flag === 'start') {
      begin(pathname.includes('/radar/properties/') ? 'property' : 'home');
      return;
    }
    const existing = readTourProgress(companyId, userId);
    setProgress(existing);
    if (existing && !existing.done) {
      setActive(true);
    }
  }, [begin, companyId, pathname, searchParams, userId]);

  // Auto-start empty home once (Campo Novo).
  useEffect(() => {
    if (!companyId || active) return;
    const emptyHome = searchParams?.get('radarEmpty') === '1';
    if (!emptyHome) return;
    const existing = readTourProgress(companyId, userId);
    if (existing?.done) return;
    begin('home');
  }, [active, begin, companyId, searchParams, userId]);

  // Measure spotlight; nudge property workspace to open panels.
  useEffect(() => {
    if (!active || !step) {
      setRect(null);
      return;
    }
    if (step.open) {
      window.dispatchEvent(new CustomEvent('radar-tour:open-step', { detail: { open: step.open } }));
    }
    let tries = 0;
    const tick = () => {
      const r = measureTarget(step.target);
      if (r) {
        setRect(r);
        setMissing(false);
        return;
      }
      setMissing(true);
      setRect(null);
      tries += 1;
      if (tries < 12) window.setTimeout(tick, 120);
    };
    tick();
    const onResize = () => {
      const r = measureTarget(step.target);
      setRect(r);
    };
    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', onResize, true);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onResize, true);
    };
  }, [active, step, pathname, stepIndex]);

  const go = (delta: number) => {
    if (!progress) return;
    const nextIdx = stepIndex + delta;
    if (nextIdx < 0) return;
    if (nextIdx >= steps.length) {
      stop(true);
      return;
    }
    persist({
      ...progress,
      stepIndex: nextIdx,
      updatedAt: new Date().toISOString(),
    });
  };

  if (!active || !step || !progress || progress.done) return null;

  const cardStyle = (() => {
    if (!rect) {
      return { bottom: 24, left: '50%', transform: 'translateX(-50%)' } as const;
    }
    const below = rect.top + rect.height + 12;
    const spaceBelow = window.innerHeight - below;
    if (spaceBelow > 160) {
      return {
        top: Math.min(below, window.innerHeight - 180),
        left: Math.min(Math.max(12, rect.left), window.innerWidth - 340),
      } as const;
    }
    return {
      top: Math.max(12, rect.top - 150),
      left: Math.min(Math.max(12, rect.left), window.innerWidth - 340),
    } as const;
  })();

  return (
    <div className="pointer-events-none fixed inset-0 z-[80]" aria-live="polite">
      {/* Soft veil — holes via box-shadow so map stays visible; chrome stays clickable via card. */}
      {rect ? (
        <div
          aria-hidden
          className="pointer-events-none absolute rounded-xl ring-2 ring-emerald-300/90 transition-all duration-200"
          style={{
            top: rect.top,
            left: rect.left,
            width: rect.width,
            height: rect.height,
            boxShadow: '0 0 0 9999px rgba(2, 8, 16, 0.55)',
          }}
        />
      ) : (
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-[#020810]/45" />
      )}

      <div
        role="dialog"
        aria-modal="false"
        aria-labelledby="radar-tour-title"
        className="pointer-events-auto absolute w-[min(22rem,calc(100vw-1.5rem))] rounded-2xl border border-emerald-400/35 bg-[#07111A] p-4 text-white shadow-2xl"
        style={cardStyle}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-300/85">
              {radarT(loc, 'Tutorial RADAR', 'Tutorial RADAR', 'RADAR tutorial')} · {stepIndex + 1}/{steps.length}
            </p>
            <h2 id="radar-tour-title" className="mt-1 font-serif text-lg leading-snug text-white">
              {step.title(loc)}
            </h2>
          </div>
          <button
            type="button"
            onClick={() => stop(true)}
            className="rounded-lg p-1.5 text-white/50 hover:bg-white/10 hover:text-white"
            aria-label={radarT(loc, 'Saltar', 'Omitir', 'Skip')}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-white/65">{step.body(loc)}</p>
        {missing && (
          <p className="mt-2 text-[11px] text-amber-200/90">
            {radarT(
              loc,
              'Control ainda não visível neste ecrã — avança ou abre o painel indicado.',
              'Control aún no visible en esta pantalla — avanzá o abrí el panel indicado.',
              'Control not visible on this screen yet — advance or open the panel.',
            )}
          </p>
        )}
        <div className="mt-3 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => stop(true)}
            className="text-xs font-medium text-white/45 hover:text-white/80"
          >
            {radarT(loc, 'Saltar tutorial', 'Omitir tutorial', 'Skip tutorial')}
          </button>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={stepIndex === 0}
              onClick={() => go(-1)}
              className={cn(
                'inline-flex items-center gap-1 rounded-full border border-white/15 px-2.5 py-1.5 text-xs font-semibold',
                stepIndex === 0 ? 'opacity-30' : 'text-white hover:bg-white/10',
              )}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              {radarT(loc, 'Voltar', 'Atrás', 'Back')}
            </button>
            <button
              type="button"
              onClick={() => go(1)}
              className="inline-flex items-center gap-1 rounded-full bg-emerald-400 px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-emerald-300"
            >
              {stepIndex >= steps.length - 1
                ? radarT(loc, 'Concluir', 'Listo', 'Done')
                : radarT(loc, 'Seguinte', 'Siguiente', 'Next')}
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Re-export helper for settings / help buttons. */
export function restartRadarTour(): void {
  dispatchTourControl({ action: 'restart' });
}
