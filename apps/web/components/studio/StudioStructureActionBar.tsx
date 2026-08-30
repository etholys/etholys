'use client';

import type { StudioCopilotAction } from '@/lib/studio/copilot-modes';
import { actionLabel } from '@/lib/studio/copilot-modes';
import { Check, Pencil, Play, X } from 'lucide-react';

type Props = {
  locale: string;
  actions: StudioCopilotAction[];
  disabled?: boolean;
  onAction: (action: StudioCopilotAction) => void;
};

const ICONS: Record<StudioCopilotAction, typeof Check> = {
  approve_structure: Check,
  apply_structure: Play,
  adjust_plan: Pencil,
  cancel_plan: X,
};

const STYLES: Record<StudioCopilotAction, string> = {
  approve_structure: 'bg-emerald-700 hover:bg-emerald-600 text-white',
  apply_structure: 'bg-orange-600 hover:bg-orange-500 text-white',
  adjust_plan: 'border border-stone-300 bg-white text-stone-800 hover:bg-stone-50',
  cancel_plan: 'border border-stone-200 bg-stone-50 text-stone-600 hover:bg-stone-100',
};

export function StudioStructureActionBar({ locale, actions, disabled, onAction }: Props) {
  if (!actions.length) return null;
  const loc = locale === 'en' || locale === 'es' ? locale : 'pt';

  return (
    <div className="rounded-xl border border-orange-200 bg-gradient-to-b from-orange-50 to-amber-50 px-3 py-3 text-sm text-stone-900 shadow-sm">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-orange-900">
        {loc === 'es'
          ? 'Plan de estructura pendiente'
          : loc === 'en'
            ? 'Pending structure plan'
            : 'Plano de estrutura pendente'}
      </p>
      <div className="flex flex-wrap gap-2">
        {actions.map((action) => {
          const Icon = ICONS[action];
          return (
            <button
              key={action}
              type="button"
              disabled={disabled}
              onClick={() => onAction(action)}
              className={`inline-flex items-center justify-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold disabled:opacity-40 ${STYLES[action]}`}
            >
              <Icon className="h-3.5 w-3.5" />
              {actionLabel(action, loc)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
