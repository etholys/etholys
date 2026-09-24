'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useApp } from '@/app/providers';
import { isLikelyDbId } from '@/lib/utils';
import { DeadlineAlertsPanel } from '@/components/opportunity/DeadlineAlertsPanel';
import { StateEmpty, StateLoading } from '@/components/ui/StateBlocks';
import {
  pipelineLabel,
  type PipelineStatus,
} from '@/lib/opportunity/pipeline';
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
  pipelineStatus?: PipelineStatus;
  watchOpen?: boolean;
  ownerUserId?: string | null;
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
  const [pipeline, setPipeline] = useState<'all' | 'decide' | 'prepare' | 'submitted' | 'closed'>('all');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [members, setMembers] = useState<Array<{ id: string; name: string | null; email: string | null }>>([]);

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
        if (pipeline !== 'all') params.set('pipeline', pipeline);
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
    [companyId, search, pipeline],
  );

  useEffect(() => {
    void load(1);
  }, [load]);

  useEffect(() => {
    if (!companyId) return;
    fetch(`/api/users?companyId=${encodeURIComponent(companyId)}`)
      .then((r) => r.json())
      .then((d) => setMembers(Array.isArray(d.users) ? d.users : Array.isArray(d) ? d : []))
      .catch(() => setMembers([]));
  }, [companyId]);

  const patchFund = async (
    fundId: string,
    body: { pipelineStatus?: PipelineStatus; watchOpen?: boolean; ownerUserId?: string | null },
  ) => {
    if (!companyId) return;
    setBusyId(fundId);
    try {
      const r = await fetch(q('/api/opportunity/catalog'), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fundId, ...body }),
      });
      if (r.ok) {
        setItems((prev) => prev.map((item) => (item.id === fundId ? { ...item, ...body } : item)));
      }
    } finally {
      setBusyId(null);
    }
  };

  const changePipeline = (fundId: string, pipelineStatus: PipelineStatus) =>
    patchFund(fundId, { pipelineStatus });

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
            FundHub
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-gray-900 md:text-3xl">
            {t('Em curso', 'En curso', 'In progress')}
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            {t(
              'Fundos que já decidiu acompanhar.',
              'Fondos que ya decidió seguir.',
              'Funds you chose to track.',
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <DeadlineAlertsPanel variant="inline" />
          <div className="text-right">
            <p className="text-3xl font-bold text-amber-700">{total}</p>
            <p className="text-xs text-gray-500">{t('em curso', 'en curso', 'in progress')}</p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {(
          [
            ['all', t('Todos', 'Todos', 'All')],
            ['decide', t('Decidir', 'Decidir', 'Decide')],
            ['prepare', t('Preparar', 'Preparar', 'Prepare')],
            ['submitted', t('Submetido', 'Enviado', 'Submitted')],
            ['closed', t('Fechado', 'Cerrado', 'Closed')],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setPipeline(key)}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              pipeline === key
                ? 'bg-gray-900 text-white'
                : 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            {label}
          </button>
        ))}
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
          {t('Buscar novas', 'Buscar nuevas', 'Search new')}
        </Link>
      </div>

      {loading ? (
        <StateLoading className="min-h-[30vh]" />
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-10 text-center">
          <Radar className="mx-auto h-12 w-12 text-gray-300" />
          <h2 className="mt-4 text-lg font-semibold text-gray-900">
            {t('Ainda não guardou nenhum fundo', 'Aún no guardó ningún fondo', 'You have not saved a fund yet')}
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-gray-600">
            {t(
              'Em Buscar, escolha o que importa e use Guardar.',
              'En Buscar, elija lo que importa y pulse Guardar.',
              'In Search, pick what matters and Save.',
            )}
          </p>
          <Link
            href="/hub/fundhub/discover"
            className="mt-6 inline-flex items-center gap-2 rounded-lg bg-amber-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-amber-700"
          >
            <Radar className="h-4 w-4" />
            {t('Ir a Buscar', 'Ir a Buscar', 'Go to Search')}
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
                      <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-900">
                        {pipelineLabel(f.pipelineStatus ?? 'decide', locale)}
                      </span>
                    </div>
                    <div className="mt-2 flex items-start gap-2">
                      {f.ownerUserId && (
                        <span
                          title={members.find((m) => m.id === f.ownerUserId)?.name || t('Dono', 'Dueño', 'Owner')}
                          className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-900 text-[10px] font-bold text-white"
                        >
                          {(members.find((m) => m.id === f.ownerUserId)?.name || members.find((m) => m.id === f.ownerUserId)?.email || '?')
                            .slice(0, 1)
                            .toUpperCase()}
                        </span>
                      )}
                      <div className="min-w-0">
                        <h3 className="font-semibold text-gray-900">{f.name}</h3>
                        <p className="text-sm text-gray-600">{f.institution}</p>
                      </div>
                    </div>
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
                      <label className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2 py-1.5 text-[11px] text-gray-700">
                        <input
                          type="checkbox"
                          disabled={busyId === f.id}
                          checked={Boolean(f.watchOpen)}
                          onChange={(e) => void patchFund(f.id, { watchOpen: e.target.checked })}
                        />
                        {t('Avisar se abrir', 'Avisar si abre', 'Watch if it opens')}
                      </label>
                      {members.length > 0 && (
                        <select
                          disabled={busyId === f.id}
                          value={f.ownerUserId ?? ''}
                          onChange={(e) => void patchFund(f.id, { ownerUserId: e.target.value || null })}
                          className="rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs text-gray-800"
                        >
                          <option value="">{t('Sem dono', 'Sin dueño', 'No owner')}</option>
                          {members.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.name || m.email || m.id.slice(0, 6)}
                            </option>
                          ))}
                        </select>
                      )}
                      <select
                        disabled={busyId === f.id}
                        value={f.pipelineStatus ?? 'decide'}
                        onChange={(e) => void changePipeline(f.id, e.target.value as PipelineStatus)}
                        className="rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs text-gray-800"
                      >
                        {(['decide', 'prepare', 'submitted', 'won', 'lost'] as const).map((s) => (
                          <option key={s} value={s}>
                            {pipelineLabel(s, locale)}
                          </option>
                        ))}
                      </select>
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
