'use client';

import { EXPEDICION_INVESTMENTS } from '@/lib/forge/expedicion-investments';
import type { ExpedicionStationSlug } from '@/lib/forge/expedicion-station-decks';
import { useForgeT } from '@/lib/forge/use-forge-t';

type Props = {
  station: ExpedicionStationSlug;
  onClose: () => void;
};

export function ForgeInvestmentPanel({ station, onClose }: Props) {
  const ft = useForgeT();
  const rows = EXPEDICION_INVESTMENTS[station];

  return (
    <div className="rounded-xl border border-emerald-500/40 bg-emerald-950/40 p-3">
      <div className="flex items-center justify-between gap-2 mb-2">
        <p className="text-xs font-bold uppercase text-emerald-300">
          {ft('forge.room.investmentsTitle')} — {station}
        </p>
        <button
          type="button"
          onClick={onClose}
          className="text-[10px] font-bold text-slate-400 hover:text-white"
        >
          {ft('forge.general.close')}
        </button>
      </div>
      <p className="text-[10px] text-emerald-200/80 mb-2">{ft('forge.room.investmentsHint')}</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {rows.map((inv) => (
          <div
            key={inv.id}
            className="rounded-lg border border-emerald-700/50 bg-slate-900/80 px-2 py-2 text-xs"
          >
            <p className="font-bold text-emerald-100">{inv.label}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">
              −{inv.ecoCost} Eco · +{inv.impact} {ft('forge.room.impactShort')}
            </p>
            <p className="text-[10px] text-slate-500 mt-1">{inv.hint}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
