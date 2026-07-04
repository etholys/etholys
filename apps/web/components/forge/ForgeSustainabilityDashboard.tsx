'use client';

import type { SustainabilityScoreBreakdown } from '@/lib/forge/expedicion-v2/types';
import {
  ECO_SCORE_WEIGHT,
  IMPACT_POINT_MULTIPLIER,
  IMPACT_SCORE_WEIGHT,
} from '@/lib/forge/expedicion-v2/score';

export function ForgeSustainabilityDashboard({
  breakdown,
  onClose,
}: {
  breakdown: SustainabilityScoreBreakdown;
  onClose?: () => void;
}) {
  return (
    <div className="rounded-2xl border-2 border-[#5B3E8C]/30 bg-gradient-to-br from-[#F0EBF8] to-white p-6 shadow-lg">
      <h2 className="text-xl font-black text-[#5B3E8C]">Puntuación de Sostenibilidad</h2>
      <p className="mt-1 text-sm text-slate-600">
        Fórmula oficial: (Eco × {ECO_SCORE_WEIGHT}) + (Impacto × {IMPACT_POINT_MULTIPLIER} ×{' '}
        {IMPACT_SCORE_WEIGHT})
      </p>
      <div className="mt-6 text-center">
        <p className="text-5xl font-black text-[#1B5E4B] tabular-nums">{breakdown.total}</p>
        <p className="text-xs uppercase tracking-wide text-slate-500 mt-1">puntos totales</p>
      </div>
      <ul className="mt-6 space-y-2 text-sm">
        <li className="flex justify-between rounded-lg bg-white/80 px-3 py-2">
          <span>
            Eco × {ECO_SCORE_WEIGHT} ({breakdown.finalEcoBalance})
          </span>
          <strong>{breakdown.ecoComponent.toFixed(1)}</strong>
        </li>
        <li className="flex justify-between rounded-lg bg-white/80 px-3 py-2">
          <span>
            Impacto × {IMPACT_POINT_MULTIPLIER} × {IMPACT_SCORE_WEIGHT} ({breakdown.impactPoints}{' '}
            pts)
          </span>
          <strong>{breakdown.impactComponent.toFixed(1)}</strong>
        </li>
      </ul>
      <p className="mt-4 text-[10px] text-slate-500 text-center">
        Mapa: {breakdown.postItCount} post-its · {breakdown.modulesComplete} módulos completos ·{' '}
        {breakdown.connectionCount} conexiones
      </p>
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
