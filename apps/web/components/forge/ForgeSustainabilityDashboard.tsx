'use client';

import type { SustainabilityScoreBreakdown } from '@/lib/forge/expedicion-v2/types';

export function ForgeSustainabilityDashboard({
  breakdown,
  onClose,
}: {
  breakdown: SustainabilityScoreBreakdown;
  onClose?: () => void;
}) {
  return (
    <div className="rounded-2xl border-2 border-[#5B3E8C]/30 bg-gradient-to-br from-[#F0EBF8] to-white p-6 shadow-lg">
      <h2 className="text-xl font-black text-[#5B3E8C]">Score de Sustentabilidade</h2>
      <p className="mt-1 text-sm text-slate-600">Resultado final de La Expedición</p>
      <div className="mt-6 text-center">
        <p className="text-5xl font-black text-[#1B5E4B] tabular-nums">{breakdown.total}</p>
        <p className="text-xs uppercase tracking-wide text-slate-500 mt-1">puntos totales</p>
      </div>
      <ul className="mt-6 space-y-2 text-sm">
        <li className="flex justify-between rounded-lg bg-white/80 px-3 py-2">
          <span>Saldo Eco × 0,1 ({breakdown.finalEcoBalance})</span>
          <strong>{breakdown.ecoComponent.toFixed(1)}</strong>
        </li>
        <li className="flex justify-between rounded-lg bg-white/80 px-3 py-2">
          <span>Post-its × 1 ({breakdown.postItCount})</span>
          <strong>{breakdown.postItComponent.toFixed(1)}</strong>
        </li>
        <li className="flex justify-between rounded-lg bg-white/80 px-3 py-2">
          <span>Módulos 4 passos × 5 ({breakdown.modulesComplete})</span>
          <strong>{breakdown.moduleCompleteComponent.toFixed(1)}</strong>
        </li>
        <li className="flex justify-between rounded-lg bg-white/80 px-3 py-2">
          <span>Conexiones × 1,5 ({breakdown.connectionCount})</span>
          <strong>{breakdown.connectionComponent.toFixed(1)}</strong>
        </li>
      </ul>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="mt-6 w-full rounded-xl bg-[#5B3E8C] py-2.5 text-sm font-bold text-white"
        >
          Cerrar
        </button>
      )}
    </div>
  );
}
