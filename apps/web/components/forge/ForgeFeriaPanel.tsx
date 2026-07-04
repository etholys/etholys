'use client';

import { useState } from 'react';
import { Megaphone, CheckCircle, XCircle } from 'lucide-react';
import { useForgeT } from '@/lib/forge/use-forge-t';

export function ForgeFeriaPanel({
  eligible,
  eligibilityHint,
  isFacilitator,
  pendingPitch,
  awarded,
  onSubmit,
  onAward,
  onReject,
}: {
  eligible: boolean;
  eligibilityHint: string;
  isFacilitator?: boolean;
  pendingPitch?: string;
  awarded?: boolean;
  onSubmit?: (pitch: string) => void;
  onAward?: () => void;
  onReject?: () => void;
}) {
  const ft = useForgeT();
  const [pitch, setPitch] = useState(pendingPitch ?? '');

  if (awarded) {
    return (
      <div className="rounded-2xl border-2 border-[#F4B942] bg-[#FFF8E7] p-4 text-sm">
        <p className="font-bold text-[#8B6914]">{ft('forge.v2.feriaAwardedTitle')}</p>
      </div>
    );
  }

  const reviewMode = isFacilitator && Boolean(pendingPitch);

  return (
    <div className="rounded-2xl border-2 border-[#F4B942] bg-white overflow-hidden shadow-sm">
      <div className="flex items-center gap-2 bg-[#F4B942] px-4 py-2 text-[#5D4E37]">
        <Megaphone className="h-4 w-4" />
        <span className="text-xs font-bold uppercase">{ft('forge.v2.feriaChallengeTitle')}</span>
      </div>
      <div className="p-4 space-y-3">
        <p className="text-sm text-slate-800">{ft('forge.v2.feriaPitchDesc')}</p>
        <p className="text-[10px] text-slate-500">{eligibilityHint}</p>
        {!eligible && !isFacilitator && (
          <p className="text-xs font-semibold text-amber-800">{ft('forge.v2.feriaNeedStations')}</p>
        )}
        {(eligible || reviewMode) && (
          <textarea
            value={pitch}
            onChange={(e) => setPitch(e.target.value)}
            placeholder={ft('forge.v2.feriaPitchPlaceholder')}
            rows={4}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            disabled={isFacilitator && !reviewMode}
            readOnly={reviewMode}
          />
        )}
        {!isFacilitator && eligible && !pendingPitch && (
          <button
            type="button"
            disabled={!pitch.trim()}
            onClick={() => onSubmit?.(pitch.trim())}
            className="rounded-lg bg-[#1B5E4B] px-4 py-2 text-xs font-bold text-white disabled:opacity-40"
          >
            {ft('forge.v2.feriaSubmitPitch')}
          </button>
        )}
        {!isFacilitator && pendingPitch && (
          <p className="text-xs text-amber-800 font-semibold">{ft('forge.v2.feriaPitchSent')}</p>
        )}
        {reviewMode && (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onAward}
              className="inline-flex items-center gap-1 rounded-lg bg-[#1B5E4B] px-3 py-2 text-xs font-bold text-white"
            >
              <CheckCircle className="h-4 w-4" /> {ft('forge.v2.feriaAwardBtn')}
            </button>
            <button
              type="button"
              onClick={onReject}
              className="inline-flex items-center gap-1 rounded-lg border border-rose-400 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-800"
            >
              <XCircle className="h-4 w-4" /> {ft('forge.v2.feriaRejectBtn')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
