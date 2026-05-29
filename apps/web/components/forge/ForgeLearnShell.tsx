'use client';

import Link from 'next/link';
import { CheckCircle2, Circle, Gamepad2, Play } from 'lucide-react';
import { forgeActivityBadgeClass, forgeActivityLabel } from '@/lib/forge/activity-ui';
import { useForgeLocale, useForgeT } from '@/lib/forge/use-forge-t';
import { cn } from '@/lib/utils';
import { ForgeLivePanel } from '@/components/forge/ForgeLivePanel';
import { ForgeLibroPanel } from '@/components/forge/ForgeLibroPanel';
import { type ForgeDeliveryMode, type ForgeLiveConfig, showsLiveFeatures } from '@/lib/forge/delivery';

export type ForgeLearnModule = {
  id: string;
  title: string;
  activities: { id: string; title: string; type: string }[];
};

type Props = {
  courseId: string;
  courseTitle: string;
  coverEmoji?: string;
  progressPercent?: number;
  learner?: { xp: number; level: number };
  modules: ForgeLearnModule[];
  progressMap?: Record<string, string>;
  currentActivityId: string;
  activityTitle: string;
  activityType: string;
  deliveryMode?: ForgeDeliveryMode;
  liveConfig?: ForgeLiveConfig;
  currentModuleTitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
};

export function ForgeLearnShell({
  courseId,
  courseTitle,
  coverEmoji = '📚',
  progressPercent = 0,
  learner,
  modules,
  progressMap = {},
  currentActivityId,
  activityTitle,
  activityType,
  deliveryMode = 'async',
  liveConfig = {},
  currentModuleTitle,
  children,
  footer,
}: Props) {
  const loc = useForgeLocale();
  const ft = useForgeT();
  const flat = modules.flatMap((m) =>
    m.activities.map((a) => ({ ...a, moduleTitle: m.title, moduleId: m.id }))
  );
  const currentIdx = flat.findIndex((a) => a.id === currentActivityId);
  const next = currentIdx >= 0 && currentIdx < flat.length - 1 ? flat[currentIdx + 1] : null;

  return (
    <div className="-mx-4 md:-mx-6 -mt-4 md:-mt-6 mb-0">
      {/* Banner estilo Rural Commerce */}
      <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-900 px-4 pb-16 pt-6 md:px-8 md:pt-8">
        <div
          className="pointer-events-none absolute inset-0 opacity-30"
          aria-hidden
          style={{
            backgroundImage:
              'radial-gradient(circle at 20% 50%, rgba(255,255,255,0.15) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(99,102,241,0.4) 0%, transparent 40%)',
          }}
        />
        <p className="relative text-xs font-medium text-blue-200/90">{ft('forge.learn.brand')}</p>
        <h1 className="relative mt-1 text-2xl font-black tracking-tight text-white md:text-3xl">
          {courseTitle}
        </h1>
      </div>

      {/* Faixa de contexto */}
      <div className="relative z-10 mx-4 -mt-10 rounded-2xl border border-slate-200/80 bg-white/95 px-4 py-3 shadow-lg backdrop-blur md:mx-8 md:flex md:items-center md:justify-between md:gap-4">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-2xl">
            {coverEmoji}
          </span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {ft('forge.learn.currentActivity')}
            </p>
            <p className="font-bold text-slate-900 line-clamp-1">{activityTitle}</p>
            <span
              className={cn(
                'mt-1 inline-block rounded-md px-2 py-0.5 text-[10px] font-bold uppercase ring-1',
                forgeActivityBadgeClass(activityType)
              )}
            >
              {forgeActivityLabel(activityType, loc)}
            </span>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3 md:mt-0">
          {progressPercent != null && (
            <div className="min-w-[120px]">
              <p className="text-[10px] font-semibold uppercase text-slate-500">{ft('forge.learn.progress')}</p>
              <div className="mt-1 h-2 w-full rounded-full bg-slate-100">
                <div
                  className="h-2 rounded-full bg-gradient-to-r from-blue-600 to-indigo-500"
                  style={{ width: `${Math.min(100, progressPercent)}%` }}
                />
              </div>
              <p className="mt-0.5 text-xs text-slate-600">{progressPercent}%</p>
            </div>
          )}
          {learner != null && (
            <div className="rounded-lg bg-amber-50 px-3 py-2 text-center">
              <p className="text-[10px] font-semibold uppercase text-amber-800">XP</p>
              <p className="text-lg font-black text-amber-900">{learner.xp}</p>
            </div>
          )}
        </div>
      </div>

      {/* Corpo: player + rail */}
      <div className="mx-4 mt-6 grid gap-6 lg:grid-cols-[1fr_320px] md:mx-8">
        <div className="min-w-0 space-y-4">
          {showsLiveFeatures(deliveryMode) && (
            <ForgeLivePanel
              courseId={courseId}
              deliveryMode={deliveryMode}
              liveConfig={liveConfig}
              compact
              currentActivityId={currentActivityId}
            />
          )}
          <ForgeLibroPanel courseTitle={courseTitle} courseId={courseId} moduleTitle={currentModuleTitle} />
          <div
            className={cn(
              'rounded-2xl border bg-white shadow-sm',
              activityType === 'game' ? 'border-amber-200 p-4 md:p-5' : 'border-slate-200 p-5 md:p-6'
            )}
          >
            {activityType === 'game' && (
              <div className="mb-4 flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
                <Gamepad2 className="h-4 w-4 shrink-0" />
                {showsLiveFeatures(deliveryMode)
                  ? ft('forge.learn.gameLiveHint')
                  : ft('forge.learn.gameAsyncHint')}
              </div>
            )}
            {children}
          </div>
          {(footer || next) && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              {footer}
              {next && (
                <Link
                  href={`/hub/forge/cursos/${courseId}/atividade/${next.id}`}
                  className="ml-auto rounded-lg bg-gradient-to-r from-blue-700 to-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:from-blue-800"
                >
                  {ft('forge.learn.nextActivity', {
                    title: `${next.title.slice(0, 40)}${next.title.length > 40 ? '…' : ''}`,
                  })}
                </Link>
              )}
            </div>
          )}
        </div>

        <aside className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:max-h-[calc(100vh-12rem)] lg:overflow-y-auto">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{ft('forge.learn.modules')}</p>
          <div className="mt-3 space-y-4">
            {modules.map((mod) => (
              <div key={mod.id}>
                <p className="text-sm font-bold text-slate-800">{mod.title}</p>
                <ul className="mt-2 space-y-1">
                  {mod.activities.map((a) => {
                    const isCurrent = a.id === currentActivityId;
                    const done = progressMap[a.id] === 'completed';
                    return (
                      <li key={a.id}>
                        <Link
                          href={`/hub/forge/cursos/${courseId}/atividade/${a.id}`}
                          className={cn(
                            'flex items-start gap-2 rounded-lg px-2 py-2 text-sm transition',
                            isCurrent && 'bg-blue-50 ring-1 ring-blue-200',
                            done && !isCurrent && 'bg-emerald-50/80',
                            !isCurrent && !done && 'hover:bg-slate-50'
                          )}
                        >
                          {done ? (
                            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                          ) : isCurrent ? (
                            <Play className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
                          ) : (
                            <Circle className="mt-0.5 h-4 w-4 shrink-0 text-slate-300" />
                          )}
                          <span className="min-w-0 flex-1">
                            <span
                              className={cn(
                                'mb-0.5 inline-block rounded px-1.5 py-0.5 text-[9px] font-bold uppercase ring-1',
                                forgeActivityBadgeClass(a.type)
                              )}
                            >
                              {forgeActivityLabel(a.type, loc)}
                            </span>
                            <span className="block text-slate-700 line-clamp-2">{a.title}</span>
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
          <Link
            href={`/hub/forge/cursos/${courseId}`}
            className="mt-4 block text-center text-xs font-medium text-blue-600 hover:underline"
          >
            {ft('forge.learn.viewCourse')}
          </Link>
        </aside>
      </div>
    </div>
  );
}
