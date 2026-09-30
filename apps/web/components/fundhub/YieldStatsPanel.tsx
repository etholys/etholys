'use client';

import { formatUsd, type YieldSnapshot } from '@/lib/opportunity/yield-stats';
import { BarChart3 } from 'lucide-react';

/**
 * Métricas internas de custo IA — só system admin Etholys.
 * Contagens de bandeja / catálogo ficam nos tabs e chips da própria discover
 * (não duplicar aqui).
 */
export function YieldStatsPanel({
  snap,
  locale,
  showInternalCosts = false,
}: {
  snap: YieldSnapshot;
  locale: string;
  showInternalCosts?: boolean;
}) {
  if (!showInternalCosts) return null;

  const t = (pt: string, es: string, en: string) =>
    locale === 'pt' ? pt : locale === 'es' ? es : en;

  const cells = [
    {
      label: t('Última varredura', 'Último barrido', 'Last scan'),
      value: formatUsd(snap.lastRunCostUsd),
      sub: t(
        `${snap.lastRunCandidates} candidatos`,
        `${snap.lastRunCandidates} candidatos`,
        `${snap.lastRunCandidates} candidates`,
      ),
    },
    {
      label: t('$/candidato', '$/candidato', '$/candidate'),
      value: formatUsd(snap.costPerCandidateUsd),
      sub: t('última run', 'última run', 'last run'),
    },
    {
      label: t('Média runs', 'Promedio runs', 'Avg runs'),
      value: formatUsd(snap.avgCostLastRunsUsd),
      sub: t(
        `${snap.runsWithCost} com custo`,
        `${snap.runsWithCost} con costo`,
        `${snap.runsWithCost} with cost`,
      ),
    },
  ];

  return (
    <section className="rounded-xl border border-amber-200/80 bg-amber-50/40 px-3 py-3">
      <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-amber-900/80">
        <BarChart3 className="h-3.5 w-3.5" />
        {t('Custo IA (interno)', 'Costo IA (interno)', 'AI cost (internal)')}
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {cells.map((c) => (
          <div key={c.label} className="rounded-lg bg-white/80 px-2.5 py-2 ring-1 ring-amber-100">
            <p className="text-[10px] font-medium uppercase tracking-wide text-gray-500">{c.label}</p>
            <p className="mt-0.5 text-sm font-semibold text-gray-900">{c.value}</p>
            <p className="text-[10px] text-gray-500">{c.sub}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
