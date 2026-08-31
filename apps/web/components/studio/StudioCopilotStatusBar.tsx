'use client';

import { copilotStatusHint } from '@/lib/studio/copilot-status';
import type { StudioCopilotMode } from '@/lib/studio/copilot-modes';
import type { StudioStructureSessionState } from '@/lib/studio/structure-apply';
import { Info } from 'lucide-react';

type Props = {
  locale: string;
  mode: StudioCopilotMode;
  structureState: StudioStructureSessionState | null;
};

export function StudioCopilotStatusBar({ locale, mode, structureState }: Props) {
  const loc = locale === 'en' || locale === 'es' ? locale : 'pt';
  const hint = copilotStatusHint(mode, structureState, loc);
  if (!hint) return null;

  const tone =
    structureState?.status === 'approved'
      ? 'border-emerald-200 bg-emerald-50/90 text-emerald-900'
      : structureState?.status === 'pending_approval'
        ? 'border-orange-200 bg-orange-50/90 text-orange-900'
        : 'border-slate-200 bg-slate-50/90 text-slate-700';

  return (
    <div
      className={`mx-3 mt-2 flex items-start gap-2 rounded-lg border px-2.5 py-2 text-[11px] leading-snug ${tone}`}
    >
      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 opacity-70" />
      <span>{hint}</span>
    </div>
  );
}
