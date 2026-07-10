'use client';

import type { EcoLedgerState } from '@/lib/forge/expedicion-v2/types';
import { Coins } from 'lucide-react';

export function ForgeEcoLedger({
  ledger,
  onRequestLoan,
  loanDisabled,
  peerCredits,
  teamPeers,
  myUserId,
  compact,
}: {
  ledger: EcoLedgerState;
  onRequestLoan?: () => void;
  loanDisabled?: boolean;
  peerCredits?: Record<string, number>;
  teamPeers?: { userId: string; name: string }[];
  myUserId?: string;
  compact?: boolean;
}) {
  const myPeerTotal =
    myUserId && peerCredits?.[myUserId] ? peerCredits[myUserId] : 0;
  const peerEntries = Object.entries(peerCredits ?? {}).filter(([, v]) => v > 0);

  return (
    <div className="rounded-2xl border-2 border-[#145A45]/20 bg-white shadow-sm overflow-hidden">
      <div className="flex items-center justify-between gap-2 bg-[#145A45] px-4 py-2.5 text-white">
        <div className="flex items-center gap-2">
          <Coins className="h-4 w-4" />
          <span className="text-sm font-bold">Registro Financiero</span>
        </div>
        <span className="text-lg font-black tabular-nums">{ledger.balance} Eco</span>
      </div>
      <div className={compact ? 'max-h-32 overflow-auto' : 'max-h-48 overflow-auto'}>
        <table className="w-full text-xs">
          <thead className="bg-[#F7F3EB] sticky top-0">
            <tr className="text-left text-slate-600">
              <th className="px-2 py-1.5 w-8">#</th>
              <th className="px-2 py-1.5">Descripción</th>
              <th className="px-2 py-1.5 w-10">T</th>
              <th className="px-2 py-1.5 w-14 text-right">Valor</th>
              <th className="px-2 py-1.5 w-16 text-right">Saldo</th>
            </tr>
          </thead>
          <tbody>
            {ledger.entries.map((e) => (
              <tr key={e.id} className="border-t border-slate-100">
                <td className="px-2 py-1.5 text-slate-400">{e.seq}</td>
                <td className="px-2 py-1.5 text-slate-800">{e.description}</td>
                <td className="px-2 py-1.5 font-bold">{e.type}</td>
                <td
                  className={`px-2 py-1.5 text-right tabular-nums ${e.type === 'E' ? 'text-emerald-700' : 'text-rose-700'}`}
                >
                  {e.type === 'S' ? '-' : '+'}
                  {e.amount}
                </td>
                <td className="px-2 py-1.5 text-right font-semibold tabular-nums">{e.balance}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {myPeerTotal > 0 && (
        <p className="border-t border-violet-200 bg-violet-50 px-3 py-2 text-[10px] text-violet-900">
          Créditos por ayudar a colegas: <strong>{myPeerTotal} Eco</strong>
        </p>
      )}
      {peerEntries.length > 0 && !myUserId && (
        <div className="border-t border-violet-200 bg-violet-50 px-3 py-2 text-[10px] text-violet-900">
          <p className="font-bold">Créditos consultoría (mesa)</p>
          {peerEntries.map(([uid, amt]) => {
            const name = teamPeers?.find((p) => p.userId === uid)?.name ?? uid.slice(0, 8);
            return (
              <p key={uid}>
                {name}: {amt} Eco
              </p>
            );
          })}
        </div>
      )}
      {ledger.greenLoanTaken && ledger.greenLoanDebt > 0 && (
        <p className="border-t border-amber-200 bg-amber-50 px-3 py-2 text-[10px] text-amber-900">
          Deuda oculta del préstamo verde: {ledger.greenLoanDebt} Eco (se liquida al final)
        </p>
      )}
      {onRequestLoan && !ledger.greenLoanTaken && (
        <div className="border-t border-slate-100 p-2">
          <button
            type="button"
            disabled={loanDisabled}
            onClick={onRequestLoan}
            className="w-full rounded-lg bg-[#2E5C9A] px-3 py-2 text-xs font-bold text-white hover:bg-[#254D85] disabled:opacity-50"
          >
            Pedir Préstamo al Banco (+300 Eco)
          </button>
        </div>
      )}
    </div>
  );
}
