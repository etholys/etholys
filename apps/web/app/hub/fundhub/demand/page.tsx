'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useApp } from '@/app/providers';
import { isLikelyDbId } from '@/lib/utils';
import { StateEmpty, StateError, StateLoading } from '@/components/ui/StateBlocks';
import { ArrowLeft, Globe, MapPin, TrendingUp } from 'lucide-react';

type DemandBoard = {
  totals: {
    openFunds: number;
    deadlines14d: number;
    savedByTeam: number;
    avgMatchScore: number | null;
  };
  byCountry: Array<{ label: string; count: number; urgent: number }>;
  bySector: Array<{ label: string; count: number }>;
  byType: Array<{ label: string; count: number }>;
  hotspots: Array<{
    id: string;
    name: string;
    institution: string;
    deadline: string | null;
    matchScore: number | null;
  }>;
};

export default function DemandBoardPage() {
  const { locale, activeCompanyId } = useApp();
  const companyId = useMemo(() => {
    const s = String(activeCompanyId ?? '').trim();
    return isLikelyDbId(s) ? s : '';
  }, [activeCompanyId]);

  const t = (pt: string, es: string, en: string) =>
    locale === 'pt' ? pt : locale === 'es' ? es : en;

  const [data, setData] = useState<DemandBoard | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!companyId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setErr(null);
    try {
      const r = await fetch(`/api/fundhub/demand-board?companyId=${encodeURIComponent(companyId)}`, {
        cache: 'no-store',
      });
      const d = (await r.json()) as DemandBoard & { error?: string };
      if (!r.ok) throw new Error(d.error || 'Erro');
      setData(d);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro');
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!companyId) {
    return (
      <StateEmpty
        title={t('Empresa não seleccionada', 'Empresa no seleccionada', 'No company selected')}
        description={t('Escolha a empresa na barra lateral.', 'Elija la empresa en la barra lateral.', 'Pick company in sidebar.')}
      />
    );
  }

  if (loading) return <StateLoading className="min-h-[40vh]" />;
  if (err || !data) return <StateError message={err || 'Erro'} onRetry={() => void load()} />;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/hub/fundhub" className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900">
          <ArrowLeft className="h-4 w-4" />
          FundHub
        </Link>
        <h1 className="mt-2 flex items-center gap-2 text-2xl font-bold text-gray-900 md:text-3xl">
          <MapPin className="h-7 w-7 text-violet-600" />
          {t('Quadro de procura territorial', 'Tablero de demanda territorial', 'Territory demand board')}
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-gray-600">
          {t(
            'Onde há editais abertos no seu portfólio — por país, sector e prazo. Dados reais da tabela Fund.',
            'Dónde hay convocatorias abiertas en su cartera — por país, sector y plazo. Datos reales de Fund.',
            'Where open calls cluster in your portfolio — by country, sector, and deadline. Live Fund table data.',
          )}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: t('Editais abertos', 'Convocatorias abiertas', 'Open calls'), value: data.totals.openFunds },
          { label: t('Prazos ≤14d', 'Plazos ≤14d', 'Deadlines ≤14d'), value: data.totals.deadlines14d },
          { label: t('Guardados pela equipa', 'Guardados por el equipo', 'Saved by team'), value: data.totals.savedByTeam },
          {
            label: t('Match médio', 'Match medio', 'Avg match'),
            value: data.totals.avgMatchScore ?? '—',
          },
        ].map((k) => (
          <div key={k.label} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase text-gray-500">{k.label}</p>
            <p className="mt-1 text-2xl font-bold text-gray-900">{k.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="flex items-center gap-2 font-semibold text-gray-900">
            <Globe className="h-5 w-5 text-violet-600" />
            {t('Por país / território', 'Por país / territorio', 'By country / territory')}
          </h2>
          <ul className="mt-4 space-y-2">
            {data.byCountry.length === 0 ? (
              <li className="text-sm text-gray-500">{t('Sem dados.', 'Sin datos.', 'No data.')}</li>
            ) : (
              data.byCountry.map((row) => (
                <li key={row.label} className="flex items-center justify-between text-sm">
                  <span className="font-medium text-gray-800">{row.label}</span>
                  <span className="text-gray-600">
                    {row.count}
                    {row.urgent > 0 && (
                      <span className="ml-2 rounded-full bg-orange-100 px-2 py-0.5 text-xs font-semibold text-orange-800">
                        {row.urgent} {t('urgente', 'urgente', 'urgent')}
                      </span>
                    )}
                  </span>
                </li>
              ))
            )}
          </ul>
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="flex items-center gap-2 font-semibold text-gray-900">
            <TrendingUp className="h-5 w-5 text-emerald-600" />
            {t('Por sector', 'Por sector', 'By sector')}
          </h2>
          <ul className="mt-4 space-y-2">
            {data.bySector.map((row) => (
              <li key={row.label} className="flex items-center justify-between text-sm">
                <span className="text-gray-800">{row.label}</span>
                <span className="font-semibold text-gray-900">{row.count}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="font-semibold text-gray-900">{t('Hotspots (próximos prazos)', 'Hotspots (próximos plazos)', 'Hotspots (upcoming deadlines)')}</h2>
        <ul className="mt-4 divide-y divide-gray-100">
          {data.hotspots.length === 0 ? (
            <li className="py-4 text-sm text-gray-500">{t('Nenhum edital com prazo futuro.', 'Ninguna convocatoria con plazo futuro.', 'No funds with future deadline.')}</li>
          ) : (
            data.hotspots.map((h) => (
              <li key={h.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                <div>
                  <p className="font-medium text-gray-900">{h.name}</p>
                  <p className="text-gray-600">{h.institution}</p>
                </div>
                <div className="text-right text-xs text-gray-500">
                  {h.deadline ? new Date(h.deadline).toLocaleDateString() : '—'}
                  {h.matchScore != null && <p className="text-amber-700">match {h.matchScore}</p>}
                </div>
              </li>
            ))
          )}
        </ul>
        <Link href="/hub/fundhub/discover" className="mt-4 inline-flex text-sm font-medium text-amber-700 hover:underline">
          {t('Explorar fundos →', 'Explorar fondos →', 'Explore funds →')}
        </Link>
      </section>
    </div>
  );
}
