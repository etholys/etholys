'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useApp } from '@/app/providers';
import { ArrowLeft, RefreshCw, DollarSign } from 'lucide-react';
import type { FundhubCostReport } from '@/lib/opportunity/fundhub-cost-report';

function money(n: number): string {
  return `$${n.toFixed(2)}`;
}

function moneyPrecise(n: number): string {
  if (n < 0.01 && n > 0) return `$${n.toFixed(4)}`;
  return `$${n.toFixed(2)}`;
}

export default function LabAiCostsPage() {
  const { locale } = useApp();
  const { data: session } = useSession() || {};
  const isSystemAdmin = Boolean(
    (session?.user as { platformAdmin?: boolean } | undefined)?.platformAdmin,
  );
  const [days, setDays] = useState(30);
  const [report, setReport] = useState<FundhubCostReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const t = {
    title: locale === 'es' ? 'Costos de IA' : locale === 'en' ? 'AI costs' : 'Custos de IA',
    subtitle:
      locale === 'es'
        ? 'FundHub: gasto estimado Anthropic por empresa y por barrido. Solo system admin.'
        : locale === 'en'
          ? 'FundHub: estimated Anthropic spend per company and scan. System admin only.'
          : 'FundHub: gasto estimado Anthropic por empresa e por varredura. Só system admin.',
    back: locale === 'es' ? 'Volver al Lab' : locale === 'en' ? 'Back to Lab' : 'Voltar ao Lab',
    refresh: locale === 'es' ? 'Actualizar' : locale === 'en' ? 'Refresh' : 'Atualizar',
    forbidden:
      locale === 'es'
        ? 'Solo system admin Etholys puede ver costos de plataforma.'
        : locale === 'en'
          ? 'Only Etholys system admins can view platform costs.'
          : 'Só system admin Etholys pode ver custos de plataforma.',
    empty:
      locale === 'es'
        ? 'Sin barridos con costo en este periodo (corridas anteriores al tracking aparecen en $0).'
        : locale === 'en'
          ? 'No scans with cost in this period (runs before tracking show as $0).'
          : 'Sem varreduras com custo neste período (runs anteriores ao tracking aparecem a $0).',
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/platform/ai-costs?days=${days}`, { cache: 'no-store' });
      if (res.status === 403) {
        setError(t.forbidden);
        setReport(null);
        return;
      }
      if (!res.ok) {
        setError(`HTTP ${res.status}`);
        setReport(null);
        return;
      }
      setReport((await res.json()) as FundhubCostReport);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setReport(null);
    } finally {
      setLoading(false);
    }
  }, [days, t.forbidden]);

  useEffect(() => {
    if (!isSystemAdmin) {
      setLoading(false);
      setError(t.forbidden);
      return;
    }
    void load();
  }, [isSystemAdmin, load, t.forbidden]);

  if (!isSystemAdmin) {
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-8 text-center text-slate-300">
        <p>{t.forbidden}</p>
        <Link href="/lab" className="mt-4 inline-block text-sm text-violet-400 hover:underline">
          {t.back}
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            href="/lab"
            className="mb-2 inline-flex items-center gap-1 text-sm text-slate-400 hover:text-slate-200"
          >
            <ArrowLeft className="h-4 w-4" />
            {t.back}
          </Link>
          <h1 className="flex items-center gap-2 text-xl font-semibold text-white">
            <DollarSign className="h-5 w-5 text-emerald-400" />
            {t.title}
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-400">{t.subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200"
          >
            <option value={7}>7d</option>
            <option value={30}>30d</option>
            <option value={90}>90d</option>
          </select>
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 hover:bg-slate-700"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            {t.refresh}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      )}

      {report && (
        <>
          <p className="text-xs text-slate-500">{report.pricingNote}</p>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                label: locale === 'pt' ? 'Custo total' : locale === 'es' ? 'Costo total' : 'Total cost',
                value: money(report.totals.estimatedCostUsd),
              },
              {
                label: locale === 'pt' ? 'Média / varredura' : locale === 'es' ? 'Media / barrido' : 'Avg / scan',
                value: moneyPrecise(report.totals.avgCostPerRunUsd),
              },
              {
                label:
                  locale === 'pt'
                    ? 'Custo / candidato'
                    : locale === 'es'
                      ? 'Costo / candidato'
                      : 'Cost / candidate',
                value:
                  report.totals.costPerCandidateUsd != null
                    ? moneyPrecise(report.totals.costPerCandidateUsd)
                    : '—',
              },
              {
                label: locale === 'pt' ? 'Varreduras' : locale === 'es' ? 'Barridos' : 'Scans',
                value: `${report.totals.runs} (${report.totals.completed} ok / ${report.totals.failed} fail)`,
              },
            ].map((card) => (
              <div
                key={card.label}
                className="rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-3"
              >
                <p className="text-xs uppercase tracking-wide text-slate-500">{card.label}</p>
                <p className="mt-1 text-lg font-semibold text-white">{card.value}</p>
              </div>
            ))}
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden">
            <div className="border-b border-slate-800 px-4 py-3 text-sm font-medium text-slate-200">
              {locale === 'pt' ? 'Por empresa' : locale === 'es' ? 'Por empresa' : 'By company'}
            </div>
            {report.byCompany.length === 0 ? (
              <p className="px-4 py-6 text-sm text-slate-500">{t.empty}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-slate-950/50 text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-4 py-2">Empresa</th>
                      <th className="px-4 py-2">Runs</th>
                      <th className="px-4 py-2">Candidatos</th>
                      <th className="px-4 py-2">Custo</th>
                      <th className="px-4 py-2">$/run</th>
                      <th className="px-4 py-2">$/cand.</th>
                      <th className="px-4 py-2">Web search</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.byCompany.map((row) => (
                      <tr key={row.companyId} className="border-t border-slate-800 text-slate-300">
                        <td className="px-4 py-2 font-medium text-white">{row.companyName}</td>
                        <td className="px-4 py-2">
                          {row.runs}{' '}
                          <span className="text-slate-500">
                            ({row.completed}/{row.failed})
                          </span>
                        </td>
                        <td className="px-4 py-2">{row.candidates}</td>
                        <td className="px-4 py-2 text-emerald-300">{money(row.estimatedCostUsd)}</td>
                        <td className="px-4 py-2">{moneyPrecise(row.avgCostPerRunUsd)}</td>
                        <td className="px-4 py-2">
                          {row.costPerCandidateUsd != null
                            ? moneyPrecise(row.costPerCandidateUsd)
                            : '—'}
                        </td>
                        <td className="px-4 py-2">{row.webSearchRequests}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden">
            <div className="border-b border-slate-800 px-4 py-3 text-sm font-medium text-slate-200">
              {locale === 'pt'
                ? 'Últimas varreduras'
                : locale === 'es'
                  ? 'Últimos barridos'
                  : 'Recent scans'}
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-950/50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-2">Quando</th>
                    <th className="px-4 py-2">Empresa</th>
                    <th className="px-4 py-2">Status</th>
                    <th className="px-4 py-2">Cand.</th>
                    <th className="px-4 py-2">Custo</th>
                    <th className="px-4 py-2">Tokens in/out</th>
                    <th className="px-4 py-2">Web</th>
                  </tr>
                </thead>
                <tbody>
                  {report.recentRuns.map((run) => (
                    <tr key={run.id} className="border-t border-slate-800 text-slate-300">
                      <td className="px-4 py-2 whitespace-nowrap text-slate-400">
                        {new Date(run.startedAt).toLocaleString(
                          locale === 'en' ? 'en-US' : locale === 'es' ? 'es-ES' : 'pt-BR',
                          { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' },
                        )}
                      </td>
                      <td className="px-4 py-2">{run.companyName}</td>
                      <td className="px-4 py-2">{run.status}</td>
                      <td className="px-4 py-2">{run.created}</td>
                      <td className="px-4 py-2 text-emerald-300">
                        {moneyPrecise(run.estimatedCostUsd)}
                      </td>
                      <td className="px-4 py-2 text-slate-500">
                        {run.inputTokens}/{run.outputTokens}
                      </td>
                      <td className="px-4 py-2">{run.webSearchRequests}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
