'use client';

import type { ExpedicionV2PlayerState } from '@/lib/forge/expedicion-v2/types';
import { cn } from '@/lib/utils';
import { useForgeT } from '@/lib/forge/use-forge-t';
import { Flag, RotateCcw } from 'lucide-react';

export function ForgeExpedicionCycleBar({
  v2,
  isFacilitator,
  onEndCycle,
  busy,
}: {
  v2: ExpedicionV2PlayerState;
  isFacilitator?: boolean;
  onEndCycle?: () => Promise<void>;
  busy?: boolean;
}) {
  const ft = useForgeT();

  if (v2.phase !== 'playing' && v2.phase !== 'post_quiz' && v2.quizGate !== 'post') return null;

  const current =
    v2.quizGate === 'post' || v2.phase === 'post_quiz'
      ? v2.maxCycles
      : v2.cyclesCompleted + 1;

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[#145A45]/20 bg-white/95 px-3 py-2 text-xs shadow-sm">
      <span className="font-bold text-[#145A45]">{ft('forge.v2.cyclesTitle')}</span>
      <div className="flex items-center gap-1">
        {Array.from({ length: v2.maxCycles }, (_, i) => {
          const n = i + 1;
          const done = v2.cyclesCompleted >= n;
          const active = current === n && v2.phase === 'playing';
          return (
            <span
              key={n}
              className={cn(
                'flex h-6 w-6 items-center justify-center rounded-full border-2 text-[10px] font-black',
                done && 'border-[#145A45] bg-[#145A45] text-white',
                active && !done && 'border-[#C9A227] bg-[#C9A227]/30 text-[#145A45]',
                !done && !active && 'border-slate-300 text-slate-400'
              )}
              title={ft('forge.v2.cycleN', { n })}
            >
              {n}
            </span>
          );
        })}
      </div>
      {v2.phase === 'playing' && (
        <span className="text-slate-600">
          {ft('forge.v2.cycle', { current, max: v2.maxCycles })} · {ft('forge.v2.cycleGoal')}
        </span>
      )}
      {v2.quizGate === 'post' && (
        <span className="font-semibold text-violet-800">{ft('forge.v2.postQuizCycleDone')}</span>
      )}
      {isFacilitator && v2.phase === 'playing' && v2.quizGate !== 'post' && onEndCycle && (
        <button
          type="button"
          disabled={busy}
          onClick={() => void onEndCycle()}
          className="ml-auto inline-flex items-center gap-1 rounded-lg border border-amber-500 bg-amber-50 px-2 py-1 font-bold text-amber-900 hover:bg-amber-100 disabled:opacity-50"
        >
          <Flag className="h-3 w-3" />
          {ft('forge.v2.closeCycle')}
        </button>
      )}
      {isFacilitator && v2.quizGate === 'post' && (
        <span className="ml-auto inline-flex items-center gap-1 text-amber-800">
          <RotateCcw className="h-3 w-3" />
          {ft('forge.v2.postQuizWait')}
        </span>
      )}
    </div>
  );
}
