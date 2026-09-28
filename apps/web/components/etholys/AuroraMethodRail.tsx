'use client';

import { AURORA_STAGE_ORDER, type AuroraMethodStage } from '@/lib/aurora-portfolio';
import { AURORA_STAGES } from '@/lib/aurora-week';

export function AuroraMethodRail({
  stage,
  labels,
}: {
  stage: AuroraMethodStage;
  labels: Record<AuroraMethodStage, string>;
}) {
  const current = AURORA_STAGE_ORDER[stage];
  return (
    <ol className="flex flex-wrap gap-1.5">
      {AURORA_STAGES.map((s) => {
        const idx = AURORA_STAGE_ORDER[s];
        const done = idx < current;
        const active = s === stage;
        return (
          <li
            key={s}
            className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
              active
                ? 'bg-amber-800 text-white'
                : done
                  ? 'bg-emerald-50 text-emerald-800'
                  : 'bg-slate-100 text-slate-500'
            }`}
          >
            {labels[s]}
          </li>
        );
      })}
    </ol>
  );
}
