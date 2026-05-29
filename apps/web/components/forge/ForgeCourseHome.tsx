'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Award,
  CheckCircle2,
  Circle,
  Play,
  Rocket,
  Pencil,
} from 'lucide-react';
import { forgeActivityBadgeClass, forgeActivityLabel } from '@/lib/forge/activity-ui';
import { cn } from '@/lib/utils';
import { ForgeLivePanel } from '@/components/forge/ForgeLivePanel';
import { ForgeLibroPanel } from '@/components/forge/ForgeLibroPanel';
import { useForgeLocale, useForgeT } from '@/lib/forge/use-forge-t';
import {
  type ForgeDeliveryMode,
  type ForgeLiveConfig,
  deliveryModeLabel,
  showsAsyncFeatures,
  showsLiveFeatures,
} from '@/lib/forge/delivery';

type Activity = { id: string; type: string; title: string; sortOrder: number };
type Module = { id: string; title: string; activities: Activity[] };

type Props = {
  courseId: string;
  title: string;
  description?: string | null;
  coverEmoji: string;
  status: string;
  deliveryMode?: ForgeDeliveryMode;
  liveConfig?: ForgeLiveConfig;
  progressPercent?: number;
  learner?: { xp: number; level: number };
  modules: Module[];
  progressMap: Record<string, string>;
  certCode?: string | null;
  enrolled: boolean;
  nextActivityId: string | null;
  onEnroll: () => void;
  onEdit: () => void;
  isAdmin?: boolean;
  canFacilitate?: boolean;
  hasLibro?: boolean;
};

export function ForgeCourseHome({
  courseId,
  title,
  description,
  coverEmoji,
  status,
  deliveryMode = 'async',
  liveConfig = {},
  progressPercent = 0,
  learner,
  modules,
  progressMap,
  certCode,
  enrolled,
  nextActivityId,
  onEnroll,
  onEdit,
  canFacilitate = false,
  hasLibro,
}: Props) {
  const ft = useForgeT();
  const loc = useForgeLocale();
  const router = useRouter();
  const totalActs = modules.reduce((n, m) => n + m.activities.length, 0);
  const doneActs = Object.values(progressMap).filter((s) => s === 'completed').length;

  return (
    <div className="-mx-4 md:-mx-6 -mt-4 md:-mt-6">
      {canFacilitate && (
        <div className="mx-4 md:mx-8 mt-4 rounded-xl border border-violet-300 bg-violet-50 px-4 py-3 text-sm text-violet-900 flex flex-wrap items-center justify-between gap-2">
          <span>Vista previa como alumno</span>
          <Link
            href={`/hub/forge/cursos/${courseId}`}
            className="font-semibold text-violet-700 hover:underline"
          >
            ← Volver al panel facilitador
          </Link>
        </div>
      )}
      <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-900 px-4 pb-20 pt-6 md:px-8 md:pt-8">
        <div
          className="pointer-events-none absolute inset-0 opacity-25"
          aria-hidden
          style={{
            backgroundImage:
              'radial-gradient(circle at 30% 40%, rgba(255,255,255,0.12) 0%, transparent 45%)',
          }}
        />
        <p className="relative text-xs font-medium text-blue-200">FORGE · Curso publicado</p>
        <h1 className="relative mt-1 text-2xl font-black text-white md:text-3xl">{title}</h1>
        {description && (
          <p className="relative mt-2 max-w-2xl text-sm text-blue-100/90 line-clamp-3">{description}</p>
        )}
      </div>

      <div className="relative z-10 mx-4 -mt-12 rounded-2xl border border-slate-200 bg-white p-4 shadow-xl md:mx-8 md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-100 to-blue-100 text-4xl">
              {coverEmoji}
            </span>
            <div>
              <p className="text-sm text-slate-500">
                {doneActs}/{totalActs} actividades · {status === 'published' ? 'Publicado' : status}
                <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-600">
                  {deliveryModeLabel(deliveryMode)}
                </span>
              </p>
              <div className="mt-2 h-2.5 w-48 rounded-full bg-slate-100 md:w-64">
                <div
                  className="h-2.5 rounded-full bg-gradient-to-r from-blue-600 to-emerald-500 transition-all"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <p className="mt-1 text-xs font-semibold text-slate-600">{progressPercent}% completado</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {enrolled && deliveryMode === 'live' ? (
              <a
                href="#forge-live-panel"
                className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-sky-600 to-blue-700 px-6 py-3 text-sm font-bold text-white shadow-lg hover:from-sky-700"
              >
                <Rocket className="h-5 w-5" />
                {ft('forge.live.join')}
              </a>
            ) : null}
            {nextActivityId && enrolled ? (
              <button
                type="button"
                onClick={() => router.push(`/hub/forge/cursos/${courseId}/atividade/${nextActivityId}`)}
                className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-700 to-indigo-600 px-6 py-3 text-sm font-bold text-white shadow-lg hover:from-blue-800"
              >
                <Rocket className="h-5 w-5" />
                {progressPercent > 0 ? ft('forge.course.continue') : ft('forge.course.start')}
              </button>
            ) : !enrolled ? (
              <button
                type="button"
                onClick={onEnroll}
                className="rounded-xl bg-blue-700 px-6 py-3 text-sm font-bold text-white"
              >
                {ft('forge.course.enroll')}
              </button>
            ) : null}
            <Link
              href={`/hub/forge/cursos/${courseId}/mi-mapa`}
              className="flex items-center gap-1 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-900 hover:bg-emerald-100"
            >
              {ft('forge.course.myMap')}
            </Link>
            {canFacilitate && (
              <Link
                href={`/hub/forge/cursos/${courseId}/alumnos`}
                className="flex items-center gap-1 rounded-xl border border-violet-300 bg-violet-50 px-4 py-2.5 text-sm font-semibold text-violet-900 hover:bg-violet-100"
              >
                {ft('forge.course.alumnos')}
              </Link>
            )}
            {canFacilitate && (
              <button
                type="button"
                onClick={onEdit}
                className="flex items-center gap-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                <Pencil className="h-4 w-4" /> {ft('forge.course.edit')}
              </button>
            )}
          </div>
        </div>
        {learner != null && (
          <p className="mt-3 text-sm text-violet-700 font-medium">
            Tu progreso: {learner.xp} XP · Nivel {learner.level}
          </p>
        )}
        {certCode && (
          <Link
            href="/hub/forge/certificados"
            className="mt-2 inline-flex items-center gap-1 rounded-lg bg-emerald-100 px-3 py-1.5 text-xs font-semibold text-emerald-800"
          >
            <Award className="h-3.5 w-3.5" /> Certificado: {certCode}
          </Link>
        )}
      </div>

      {showsLiveFeatures(deliveryMode) && (
        <div className="mx-4 mt-6 md:mx-8">
          <ForgeLivePanel
            courseId={courseId}
            deliveryMode={deliveryMode}
            liveConfig={liveConfig}
          />
        </div>
      )}

      <div className="mx-4 mt-4 md:mx-8">
        <ForgeLibroPanel courseTitle={title} courseId={courseId} hasPdf={hasLibro} />
      </div>

      <div className="mx-4 mt-6 grid gap-6 lg:grid-cols-[1fr_340px] md:mx-8">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900">Tu trilha de aprendizaje</h2>
          <p className="mt-1 text-sm text-slate-500">
            {showsAsyncFeatures(deliveryMode)
              ? 'Aulas, quizzes y el taller gamificado en un solo recorrido. Completa cada módulo en orden.'
              : ft('forge.course.home.liveTrail')}
          </p>
          <div className="mt-6 space-y-6">
            {modules.map((mod, mi) => (
              <div key={mod.id}>
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-800">
                    {mi + 1}
                  </span>
                  <h3 className="font-bold text-slate-800">{mod.title}</h3>
                </div>
                <ul className="mt-3 space-y-2 border-l-2 border-blue-100 ml-3.5 pl-4">
                  {mod.activities.map((a) => {
                    const done = progressMap[a.id] === 'completed';
                    const isNext = a.id === nextActivityId;
                    return (
                      <li key={a.id}>
                        <Link
                          href={`/hub/forge/cursos/${courseId}/atividade/${a.id}`}
                          className={cn(
                            'flex items-center gap-3 rounded-xl border px-4 py-3 transition',
                            done && 'border-emerald-200 bg-emerald-50/80',
                            isNext && !done && 'border-blue-300 bg-blue-50 ring-2 ring-blue-200',
                            !done && !isNext && 'border-slate-100 hover:border-blue-200 hover:bg-slate-50'
                          )}
                        >
                          {done ? (
                            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
                          ) : isNext ? (
                            <Play className="h-5 w-5 shrink-0 text-blue-600" />
                          ) : (
                            <Circle className="h-5 w-5 shrink-0 text-slate-300" />
                          )}
                          <span className="min-w-0 flex-1">
                            <span
                              className={cn(
                                'rounded px-1.5 py-0.5 text-[9px] font-bold uppercase ring-1',
                                forgeActivityBadgeClass(a.type)
                              )}
                            >
                              {forgeActivityLabel(a.type, loc)}
                            </span>
                            <span className="mt-0.5 block font-medium text-slate-800">{a.title}</span>
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 p-4">
            <p className="text-xs font-bold uppercase text-amber-900">{ft('forge.course.home.workshopTitle')}</p>
            <p className="mt-2 text-sm text-amber-950">{ft('forge.course.home.workshopBody')}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
            <p className="font-bold text-slate-800">{ft('forge.course.home.howItWorks')}</p>
            <ol className="mt-2 list-decimal ml-4 space-y-1">
              {showsAsyncFeatures(deliveryMode) ? (
                <>
                  <li>{ft('forge.course.home.asyncStep1')}</li>
                  <li>{ft('forge.course.home.asyncStep2')}</li>
                  <li>{ft('forge.course.home.asyncStep3')}</li>
                  <li>{ft('forge.course.home.asyncStep4')}</li>
                </>
              ) : (
                <>
                  <li>{ft('forge.course.home.liveStep1')}</li>
                  <li>{ft('forge.course.home.liveStep2')}</li>
                  <li>{ft('forge.course.home.liveStep3')}</li>
                  <li>{ft('forge.course.home.liveStep4')}</li>
                </>
              )}
            </ol>
          </div>
        </aside>
      </div>
    </div>
  );
}
