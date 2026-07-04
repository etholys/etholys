'use client';

import { INVESTMENT_TIERS } from '@/lib/forge/expedicion-v2/consultancy';
import { investmentCostWithBenefits } from '@/lib/forge/expedicion-v2/event-card-effects';
import { EXPEDICION_V2_STATIONS } from '@/lib/forge/expedicion-v2/theme';
import type { ExpedicionStationSlug } from '@/lib/forge/expedicion-station-decks';
import type { ExpedicionV2PlayerState } from '@/lib/forge/expedicion-v2/types';
import { useForgeT } from '@/lib/forge/use-forge-t';
import { useState } from 'react';

type Props = {
  station: ExpedicionStationSlug;
  balance: number;
  benefits?: ExpedicionV2PlayerState['benefits'];
  onClose: () => void;
  onPurchase: (tierId: string, label: string, cost: number) => Promise<void>;
};

export function ForgeInvestmentPanel({ station, balance, benefits, onClose, onPurchase }: Props) {
  const ft = useForgeT();
  const [busy, setBusy] = useState<string | null>(null);
  const stationLabel = EXPEDICION_V2_STATIONS[station].label;

  return (
    <div className="rounded-xl border border-emerald-500/40 bg-emerald-950/40 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-xs font-bold uppercase text-emerald-300">
          {ft('forge.room.investmentsTitle')} — {stationLabel}
        </p>
        <button
          type="button"
          onClick={onClose}
          className="text-[10px] font-bold text-slate-400 hover:text-white"
        >
          {ft('forge.general.close')}
        </button>
      </div>
      <p className="mb-1 text-[10px] text-emerald-200/80">
        Saldo: <strong>{balance} Eco</strong> · Registra la inversión en el mapa (post-it Inversión).
      </p>
      <p className="mb-2 text-[10px] text-emerald-200/80">{ft('forge.room.investmentsHint')}</p>
      <div className="grid gap-2 sm:grid-cols-3">
        {INVESTMENT_TIERS.map((tier) => {
          const { cost: effectiveCost } = investmentCostWithBenefits(benefits, station, tier.cost);
          const canAfford = balance >= effectiveCost;
          const discounted = effectiveCost < tier.cost;
          return (
            <div
              key={tier.id}
              className="rounded-lg border border-emerald-700/50 bg-slate-900/80 px-2 py-2 text-xs"
            >
              <p className="font-bold text-emerald-100">{tier.label}</p>
              <p className="mt-0.5 text-[10px] text-slate-400">
                {discounted ? (
                  <>
                    <span className="line-through opacity-60">−{tier.cost}</span> −{effectiveCost} Eco
                    <span className="ml-1 text-amber-300">(−50% carta Acción)</span>
                  </>
                ) : (
                  <>−{tier.cost} Eco</>
                )}
              </p>
              <p className="mt-1 text-[10px] text-slate-500">{tier.examples}</p>
              <button
                type="button"
                disabled={!canAfford || busy === tier.id}
                onClick={async () => {
                  setBusy(tier.id);
                  try {
                    await onPurchase(tier.id, tier.label, tier.cost);
                    onClose();
                  } finally {
                    setBusy(null);
                  }
                }}
                className="mt-2 w-full rounded bg-emerald-700 px-2 py-1.5 text-[10px] font-bold text-white disabled:opacity-40"
              >
                {canAfford ? 'Comprar y pegar en mapa' : 'Saldo insuficiente'}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
