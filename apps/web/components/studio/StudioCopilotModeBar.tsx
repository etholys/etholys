'use client';

import type { StudioCopilotMode } from '@/lib/studio/copilot-modes';
import { modeLabel } from '@/lib/studio/copilot-modes';
import { MessageSquare, PenLine, Target, Wand2 } from 'lucide-react';

type Props = {
  locale: string;
  mode: StudioCopilotMode;
  hasSelection: boolean;
  disabled?: boolean;
  onChange: (mode: StudioCopilotMode) => void;
};

const MODES: Array<{ id: StudioCopilotMode; icon: typeof MessageSquare }> = [
  { id: 'discuss', icon: MessageSquare },
  { id: 'propose', icon: PenLine },
  { id: 'apply', icon: Wand2 },
  { id: 'edit_selection', icon: Target },
];

export function StudioCopilotModeBar({ locale, mode, hasSelection, disabled, onChange }: Props) {
  const loc = locale === 'en' || locale === 'es' ? locale : 'pt';

  return (
    <div className="border-b border-stone-200 bg-white px-3 py-2">
      <div className="flex flex-wrap gap-1">
        {MODES.map(({ id, icon: Icon }) => {
          const active = mode === id;
          const isSelectionMode = id === 'edit_selection';
          const dimmed = isSelectionMode && !hasSelection;
          return (
            <button
              key={id}
              type="button"
              disabled={disabled || dimmed}
              title={
                isSelectionMode && !hasSelection
                  ? loc === 'es'
                    ? 'Selecciona bloques en el documento (mira)'
                    : loc === 'en'
                      ? 'Select blocks in the document (crosshair)'
                      : 'Seleciona blocos no documento (mira)'
                  : undefined
              }
              onClick={() => onChange(id)}
              className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold transition ${
                active
                  ? 'bg-orange-600 text-white shadow-sm'
                  : dimmed
                    ? 'cursor-not-allowed border border-stone-100 text-stone-300'
                    : 'border border-stone-200 bg-stone-50 text-stone-700 hover:border-orange-300 hover:bg-orange-50'
              }`}
            >
              <Icon className="h-3 w-3 shrink-0" />
              {modeLabel(id, loc)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
