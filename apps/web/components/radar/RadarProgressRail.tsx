'use client';

import { Check } from 'lucide-react';
import {
  PROPERTY_STEP_COPY,
  PROPERTY_STEPS,
  type PropertyStepId,
  type PropertyStepState,
} from '@/lib/radar/property-progress';

type Loc = 'pt' | 'es' | 'en';

export function RadarProgressRail({
  steps,
  active,
  locale,
  onSelect,
  percent,
}: {
  steps: PropertyStepState[];
  active: PropertyStepId;
  locale: string;
  onSelect: (id: PropertyStepId) => void;
  percent: number;
}) {
  const loc: Loc = locale === 'es' || locale === 'en' ? locale : 'pt';
  const byId = new Map(steps.map((s) => [s.id, s]));

  return (
    <div className="rounded-[1.35rem] border border-white/10 bg-white/[0.03] px-4 py-4 sm:px-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/40">
          {loc === 'es' ? 'Progreso' : loc === 'en' ? 'Progress' : 'Progresso'}
        </p>
        <p className="text-sm font-medium text-emerald-200/90">{percent}%</p>
      </div>
      <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-300 transition-all duration-500"
          style={{ width: `${percent}%` }}
        />
      </div>
      <ol className="grid gap-2 sm:grid-cols-4">
        {PROPERTY_STEPS.map((id, i) => {
          const done = byId.get(id)?.done ?? false;
          const isActive = active === id;
          const copy = PROPERTY_STEP_COPY[id][loc];
          return (
            <li key={id}>
              <button
                type="button"
                onClick={() => onSelect(id)}
                className={`flex w-full items-start gap-2.5 rounded-xl border px-3 py-3 text-left transition ${
                  isActive
                    ? 'border-emerald-400/45 bg-emerald-500/12'
                    : done
                      ? 'border-white/10 bg-white/[0.04]'
                      : 'border-transparent bg-transparent hover:bg-white/[0.03]'
                }`}
              >
                <span
                  className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${
                    done
                      ? 'bg-emerald-500 text-[#04110c]'
                      : isActive
                        ? 'bg-white/15 text-white'
                        : 'bg-white/5 text-white/40'
                  }`}
                >
                  {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-white">{copy.label}</span>
                  <span className="mt-0.5 block text-[11px] text-white/45">{copy.hint}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
