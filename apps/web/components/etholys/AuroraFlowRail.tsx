'use client';

import {
  AURORA_FLOW_PHASES,
  AURORA_FLOW_PHASE_ORDER,
  type AuroraFlowPhase,
} from '@/lib/aurora-flow';

export function AuroraFlowRail({
  phase,
  labels,
  onSelect,
}: {
  phase: AuroraFlowPhase;
  labels: Record<AuroraFlowPhase, string>;
  onSelect?: (phase: AuroraFlowPhase) => void;
}) {
  const current = AURORA_FLOW_PHASE_ORDER[phase];
  return (
    <ol className="flex flex-wrap gap-1.5">
      {AURORA_FLOW_PHASES.map((s) => {
        const idx = AURORA_FLOW_PHASE_ORDER[s];
        const done = idx < current;
        const active = s === phase;
        const clickable = Boolean(onSelect) && (done || active || idx === current + 1);
        return (
          <li key={s}>
            <button
              type="button"
              disabled={!clickable}
              onClick={() => onSelect?.(s)}
              className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold transition ${
                active
                  ? 'bg-amber-800 text-white'
                  : done
                    ? 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                    : 'bg-slate-100 text-slate-500'
              } ${clickable ? 'cursor-pointer' : 'cursor-default'}`}
            >
              {labels[s]}
            </button>
          </li>
        );
      })}
    </ol>
  );
}
