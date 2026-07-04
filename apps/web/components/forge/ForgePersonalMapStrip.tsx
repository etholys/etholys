'use client';

import type { JourneyMapState } from '@/lib/forge/learner-journey-types';
import { useForgeT } from '@/lib/forge/use-forge-t';
import { cn } from '@/lib/utils';
import { CheckCircle2, Circle } from 'lucide-react';

const COLORS = [
  'from-emerald-500 to-teal-600',
  'from-amber-600 to-orange-600',
  'from-orange-500 to-red-500',
  'from-sky-500 to-blue-600',
  'from-violet-500 to-purple-700',
];

export function ForgePersonalMapStrip({
  mapState,
  v2Balance,
  v2PostItCount,
  v2ImpactPoints,
}: {
  mapState: JourneyMapState;
  v2Balance?: number;
  v2PostItCount?: number;
  v2ImpactPoints?: number;
}) {
  const ft = useForgeT();
  const board = mapState.board;

  return (
    <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/40 p-3">
      <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-300">
        {ft('forge.room.myMap')}
      </p>
      <div className="mt-2 grid grid-cols-5 gap-1">
        {mapState.stations.map((st, i) => (
          <div
            key={st.moduleId}
            title={st.title}
            className={cn(
              'rounded-lg p-1.5 text-center border',
              st.completed ? 'border-emerald-400/50 bg-emerald-900/50' : 'border-slate-600 bg-slate-900/50'
            )}
          >
            <div
              className={cn(
                'mx-auto flex h-6 w-6 items-center justify-center rounded-md bg-gradient-to-br text-[10px] font-bold text-white',
                COLORS[i % COLORS.length]
              )}
            >
              {i + 1}
            </div>
            <p className="mt-1 text-[8px] font-semibold text-slate-300 line-clamp-2 leading-tight">
              {st.title.split('—')[0]?.trim() || st.title}
            </p>
            {st.completed ? (
              <CheckCircle2 className="mx-auto mt-0.5 h-3 w-3 text-emerald-400" />
            ) : (
              <Circle className="mx-auto mt-0.5 h-3 w-3 text-slate-600" />
            )}
          </div>
        ))}
      </div>
      {(board || v2Balance != null) && (
        <div className="mt-2 flex flex-wrap gap-2 text-[10px] font-bold text-emerald-200">
          <span>
            {ft('forge.map.stat.eco')}: {v2Balance ?? board?.ecoCredits ?? 500}
            {v2Balance != null && ' (V2)'}
          </span>
          {v2PostItCount != null && <span>Post-its: {v2PostItCount}</span>}
          {v2ImpactPoints != null && (
            <span>{ft('forge.map.stat.impact')}: {v2ImpactPoints}</span>
          )}
          {!v2Balance && (
            <>
              <span>{ft('forge.map.stat.impact')}: {board?.impactPoints ?? 0}</span>
              <span>{ft('forge.map.stat.insights')}: {board?.insightsCount ?? 0}</span>
            </>
          )}
        </div>
      )}
    </div>
  );
}
