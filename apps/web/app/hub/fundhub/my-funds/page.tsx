'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useApp } from '@/app/providers';
import { isLikelyDbId } from '@/lib/utils';
import { DeadlineAlertsPanel } from '@/components/opportunity/DeadlineAlertsPanel';
import { StateEmpty, StateLoading } from '@/components/ui/StateBlocks';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  FileText,
  Radar,
  Search,
} from 'lucide-react';

type Opportunity = {
  id: string;
  name: string;
  institution: string;
  type: string;
  category?: string | null;
  amount?: number | null;
  currency: string;
  deadline?: string | null;
  countries?: string | null;
  matchScore?: number | null;
  status: string;
};

export default function OpportunitiesPage() {
  const { locale, activeCompanyId } = useApp();
  const companyId = useMemo(() => {
    const s = String(activeCompanyId ?? '').trim();
    return isLikelyDbId(s) ? s : '';
  }, [activeCompanyId]);

  const t = (pt: string, es: string, en: string) =>
    locale === 'pt' ? pt : locale === 'es' ? es : en;

  const [items, setItems] = useState<Opportunity[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const q = (path: string) =>
    `${path}${path.includes('?') ? '&' : '?'}companyId=${encodeURIComponent(companyId)}`;

  const load = useCallback(
    async (pageNum = 1) => {
      if (!companyId) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const params = new URLSearchParams({ page: String(pageNum), limit: '12' });
        if (search.trim()) params.set('search', search.trim());
        const r = await fetch(q(`/api/opportunity/catalog?${params}`), { cache: 'no-store' });
        const d = (await r.json()) as {
          funds?: Opportunity[];
          pagination?: { total: number; pages: number; current: number };
        };
        if (r.ok) {
          setItems(d.funds ?? []);
          setTotal(d.pagination?.total ?? 0);
          setPages(d.pagination?.pages ?? 1);
          setPage(d.pagination?.current ?? pageNum);
        }
      } finally {
        setLoading(false);
      }
    },
    [companyId, search],
  );

  useEffect(() => {
    void load(1);
  }, [load]);

  if (!companyId) {
    return (
      <StateEmpty
        title={t('Empresa não seleccionada', 'Empresa no seleccionada', 'No company selected')}
        description={t('Escolha a empresa na barra lateral.', 'Elija la empresa.', 'Pick the active company.')}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/hub/fundhub" className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900">
            <ArrowLeft className="h-4 w-4" />
            OPPORTUNITY
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-gray-900 md:text-3xl">
            {t('Oportunidades', 'Oportunidades', 'Opportunities')}
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            {t(
              'Catálogo validado da sua organização.',
              'Catálogo validado de su organización.',
              'Your organization\'s validated catalog.',
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <DeadlineAlertsPanel variant="inline" />
          <div className="text-right">
            <p className="text-3xl font-bold text-amber-700">{total}</p>
            <p className="text-xs text-gray-500">{t('no catálogo', 'en catálogo', 'in catalog')}</p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-[200px] flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void load(1)}
            placeholder={t('Pesquisar…', 'Buscar…', 'Search…')}
            className="w-full rounded-lg border border-gray-200 py-2 pl-9 pr-3 text-sm"
          />
        </div>
        <Link
          href="/hub/fundhub/discover"
          className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700"
        >
          <Radar className="h-4 w-4" />
          {t('Nova varredura', 'Nuevo barrido', 'New scan')}
        </Link>
      </div>

      {loading ? (
        <StateLoading className="min-h-[30vh]" />
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-10 text-center">
          <Radar className="mx-auto h-12 w-12 text-gray-300" />
          <h2 className="mt-4 text-lg font-semibold text-gray-900">
            {t('Catálogo vazio', 'Catálogo vacío', 'Empty catalog')}
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-gray-600">
            {t(
              'Inicie uma varredura e guarde os candidatos que fazem sentido para a sua organização.',
              'Inicie un barrido y guarde los candidatos relevantes.',
              'Run a scan and save candidates that fit your organization.',
            )}
          </p>
          <Link
            href="/hub/fundhub/discover"
            className="mt-6 inline-flex items-center gap-2 rounded-lg bg-amber-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-amber-700"
          >
            <Radar className="h-4 w-4" />
            {t('Ir para varredura', 'Ir al barrido', 'Go to scan')}
          </Link>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {items.map((f) => (
              <article
                key={f.id}
                className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:border-amber-200"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap gap-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                          f.status === 'open' ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {f.status === 'open' ? t('Aberto', 'Abierto', 'Open') : f.status}
                      </span>
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
                        {f.type}
                      </span>
                    </div>
                    <h3 className="mt-2 font-semibold text-gray-900">{f.name}</h3>
                    <p className="text-sm text-gray-600">{f.institution}</p>
                    <p className="mt-1 text-xs text-gray-500">
                      {f.countries || '—'}
                      {f.deadline
                        ? ` · ${t('Prazo', 'Plazo', 'Deadline')}: ${new Date(f.deadline).toLocaleDateString()}`
                        : ''}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    {f.matchScore != null && (
                      <span className="rounded-full bg-amber-100 px-3 py-1 text-sm font-bold text-amber-900">
                        {Math.round(f.matchScore)}%
                      </span>
                    )}
                    <div className="flex gap-2">
                      <Link
                        href={`/hub/fundhub/discover/${f.id}`}
                        className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                      >
                        {t('Detalhe', 'Detalle', 'Detail')}
                      </Link>
                      <Link
                        href={`/hub/fundhub/proposals?fundId=${encodeURIComponent(f.id)}`}
                        className="inline-flex items-center gap-1 rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-800"
                      >
                        <FileText className="h-3.5 w-3.5" />
                        {t('Proposta', 'Propuesta', 'Proposal')}
                      </Link>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>

          {pages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-600">
                {total} {t('oportunidades', 'oportunidades', 'opportunities')}
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => void load(page - 1)}
                  className="rounded-lg border border-gray-200 p-2 disabled:opacity-40"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="text-sm text-gray-600">
                  {page} / {pages}
                </span>
                <button
                  type="button"
                  disabled={page >= pages}
                  onClick={() => void load(page + 1)}
                  className="rounded-lg border border-gray-200 p-2 disabled:opacity-40"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
