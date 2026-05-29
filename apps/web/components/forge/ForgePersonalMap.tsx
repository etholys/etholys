'use client';

import Link from 'next/link';
import type { JourneyMapState, JourneyMaterial, JourneyTimelineEntry } from '@/lib/forge/learner-journey-types';
import { useForgeLocale, useForgeT } from '@/lib/forge/use-forge-t';
import { MapPin, CheckCircle2, Circle, FileText, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

const STATION_COLORS = [
  'from-emerald-500 to-teal-600',
  'from-amber-600 to-orange-600',
  'from-orange-500 to-red-500',
  'from-sky-500 to-blue-600',
  'from-violet-500 to-purple-700',
];

type Props = {
  courseId: string;
  mapState: JourneyMapState;
  materials: JourneyMaterial[];
  timeline: JourneyTimelineEntry[];
  showLinks?: boolean;
};

export function ForgePersonalMap({ courseId, mapState, materials, timeline, showLinks = true }: Props) {
  const ft = useForgeT();
  const locale = useForgeLocale();
  const board = mapState.board;
  const dateLocale = locale === 'pt' ? 'pt-PT' : locale === 'en' ? 'en-GB' : 'es-ES';

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900">{ft('forge.map.title')}</h2>
        <p className="mt-1 text-sm text-slate-500">
          {ft('forge.map.subtitle', { percent: mapState.progressPercent })}
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {mapState.stations.map((st, i) => (
            <div
              key={st.moduleId}
              className={cn(
                'rounded-xl border p-4 transition',
                st.completed ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200 bg-slate-50'
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div
                  className={cn(
                    'flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br text-white text-xs font-bold',
                    STATION_COLORS[i % STATION_COLORS.length]
                  )}
                >
                  {i + 1}
                </div>
                {st.completed ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                ) : (
                  <Circle className="h-5 w-5 text-slate-300 shrink-0" />
                )}
              </div>
              <p className="mt-2 font-bold text-slate-900">{st.title}</p>
              <p className="text-xs text-slate-600 mt-1">
                {ft('forge.map.stationActivities', {
                  done: st.activityDone,
                  total: st.activityTotal,
                })}
              </p>
            </div>
          ))}
        </div>
      </div>

      {board && (
        <div className="rounded-2xl border-2 border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 p-5">
          <h3 className="flex items-center gap-2 font-bold text-amber-950">
            <MapPin className="h-5 w-5" />
            {ft('forge.map.board.title')}
          </h3>
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Stat label={ft('forge.map.stat.cell')} value={`${board.position ?? 0}`} />
            <Stat label={ft('forge.map.stat.eco')} value={String(board.ecoCredits ?? 500)} />
            <Stat label={ft('forge.map.stat.impact')} value={String(board.impactPoints ?? 0)} />
            <Stat label={ft('forge.map.stat.insights')} value={String(board.insightsCount ?? 0)} />
          </div>
          {board.finished && (
            <p className="mt-3 text-sm font-semibold text-emerald-800">{ft('forge.map.finished')}</p>
          )}
          {showLinks && board.activityId && !board.finished && (
            <Link
              href={`/hub/forge/cursos/${courseId}/atividade/${board.activityId}`}
              className="mt-4 inline-flex rounded-xl bg-amber-700 px-5 py-2.5 text-sm font-bold text-white hover:bg-amber-800"
            >
              {ft('forge.map.continueBoard')}
            </Link>
          )}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <h3 className="flex items-center gap-2 font-bold text-slate-900">
            <FileText className="h-5 w-5 text-violet-600" />
            {ft('forge.map.materials')}
          </h3>
          {materials.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">{ft('forge.map.materialsEmpty')}</p>
          ) : (
            <ul className="mt-3 max-h-80 overflow-y-auto space-y-2">
              {materials.slice(0, 20).map((m) => (
                <li key={m.id} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-sm">
                  <p className="font-semibold text-slate-800">{m.title}</p>
                  {m.body && <p className="mt-1 text-slate-600 line-clamp-2">{m.body}</p>}
                  <p className="mt-1 text-[10px] text-slate-400 uppercase">{m.kind}</p>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <h3 className="flex items-center gap-2 font-bold text-slate-900">
            <Clock className="h-5 w-5 text-blue-600" />
            {ft('forge.map.timeline')}
          </h3>
          {timeline.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">{ft('forge.map.timelineEmpty')}</p>
          ) : (
            <ul className="mt-3 max-h-80 overflow-y-auto space-y-2">
              {timeline.slice(0, 25).map((t) => (
                <li key={t.id} className="flex gap-2 text-sm border-l-2 border-blue-200 pl-3 py-1">
                  <div>
                    <p className="font-medium text-slate-800">{t.title}</p>
                    {t.detail && <p className="text-xs text-slate-500">{t.detail}</p>}
                    <p className="text-[10px] text-slate-400">
                      {new Date(t.at).toLocaleString(dateLocale)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white/80 border border-amber-200 p-3 text-center">
      <p className="text-[10px] font-bold uppercase text-amber-800">{label}</p>
      <p className="text-xl font-black text-amber-950">{value}</p>
    </div>
  );
}
