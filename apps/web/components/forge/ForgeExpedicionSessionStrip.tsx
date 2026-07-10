'use client';

import type { ExpedicionV2PlayerState } from '@/lib/forge/expedicion-v2/types';
import { useForgeT } from '@/lib/forge/use-forge-t';
import { cn } from '@/lib/utils';
import { EXPEDICION_FAC_TOOLBAR } from '@/lib/forge/expedicion-v2/theme';

export function ForgeExpedicionSessionStrip({
  v2,
  teamMode,
  sessionFormat,
  className,
}: {
  v2: ExpedicionV2PlayerState | null;
  teamMode: boolean;
  sessionFormat: 'presencial' | 'online';
  className?: string;
}) {
  const ft = useForgeT();
  if (!v2) return null;

  const phaseKey = `forge.v2.phase.${v2.phase}`;
  const phaseLabel = ft(phaseKey);
  const quizOpen =
    v2.quizGate === 'pre'
      ? ft('forge.v2.quizGatePre')
      : v2.quizGate === 'post'
        ? ft('forge.v2.quizGatePost')
        : null;

  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-[11px]',
        EXPEDICION_FAC_TOOLBAR,
        className
      )}
    >
      <span className="font-bold text-[#145A45]">{phaseLabel === phaseKey ? v2.phase : phaseLabel}</span>
      <span className="text-[#145A45]/50">·</span>
      <span className="text-[#1A3D5C]">
        {ft('forge.v2.cycle', {
          current: Math.min(v2.cyclesCompleted + 1, v2.maxCycles),
          max: v2.maxCycles,
        })}
      </span>
      <span className="text-[#145A45]/50">·</span>
      <span className="font-semibold text-[#145A45]">{ft('forge.v2.eco', { n: v2.ledger.balance })}</span>
      {teamMode && (
        <>
          <span className="text-[#145A45]/50">·</span>
          <span className="text-[#2E5C9A] font-medium">{ft('forge.v2.sharedTable')}</span>
        </>
      )}
      {sessionFormat === 'presencial' && (
        <>
          <span className="text-[#145A45]/50">·</span>
          <span className="rounded bg-[#C9A227]/20 px-1.5 py-0.5 text-[10px] font-bold text-[#0D4535]">
            {ft('forge.v2.presential')}
          </span>
        </>
      )}
      {quizOpen && (
        <>
          <span className="ml-auto rounded-full bg-[#6EC4E8]/30 px-2 py-0.5 text-[10px] font-bold text-[#1A3D5C]">
            {quizOpen}
          </span>
        </>
      )}
    </div>
  );
}
