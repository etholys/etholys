'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useApp } from '@/app/providers';
import { isLikelyDbId } from '@/lib/utils';
import { DeadlineAlertsPanel } from '@/components/opportunity/DeadlineAlertsPanel';
import { FundDeskCalendar } from '@/components/fundhub/FundDeskCalendar';
import { StateEmpty, StateLoading } from '@/components/ui/StateBlocks';
import { formatOriginLine } from '@/lib/opportunity/official-portals';
import {
  pipelineLabel,
  type DonorFiche,
  type FundDecisionOutcome,
  type FundDrawer,
  type FundOrigin,
  type PipelineStatus,
} from '@/lib/opportunity/pipeline';
import {
  defaultMilestones,
  newFundTask,
  type FundTask,
} from '@/lib/opportunity/fund-tasks';
import { daysUntilClose, deadlineUrgency } from '@/lib/opportunity/scan-inbox';
import {
  ArrowLeft,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  Radar,
  Search,
  X,
} from 'lucide-react';

type Opportunity = {
  id: string;
  name: string;
  institution: string;
  type: string;
  category?: string | null;
  amount?: number | null;
  amountRequested?: number | null;
  currency: string;
  deadline?: string | null;
  countries?: string | null;
  matchScore?: number | null;
  status: string;
  linkOficial?: string | null;
  pipelineStatus?: PipelineStatus;
  watchOpen?: boolean;
  ownerUserId?: string | null;
  origin?: FundOrigin;
  donor?: DonorFiche;
  tasks?: FundTask[];
  decisionOutcome?: FundDecisionOutcome;
  decisionNote?: string | null;
  siepProjectId?: string | null;
};

function csvCell(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

function urgencyDot(deadline?: string | null): { title: string; className: string } | null {
  const kind = deadlineUrgency(daysUntilClose({ deadline, closesAt: deadline }));
  if (kind === 'none') return null;
  if (kind === 'overdue') return { title: 'Prazo passou', className: 'bg-gray-400' };
  if (kind === 'today' || kind === 'soon') return { title: 'Vence já', className: 'bg-red-500' };
  return { title: 'Vence em 14 dias', className: 'bg-amber-500' };
}

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
  const [drawer, setDrawer] = useState<FundDrawer>('all');
  const [typeFilter, setTypeFilter] = useState('');
  const [institutionFilter, setInstitutionFilter] = useState('');
  const [institutions, setInstitutions] = useState<string[]>([]);
  const [types, setTypes] = useState<string[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [members, setMembers] = useState<Array<{ id: string; name: string | null; email: string | null }>>([]);
  const [donorFund, setDonorFund] = useState<Opportunity | null>(null);
  const [donorDraft, setDonorDraft] = useState<DonorFiche>({});
  const [exporting, setExporting] = useState(false);
  const [viewMode, setViewMode] = useState<'table' | 'board' | 'calendar'>('table');
  const [taskDraft, setTaskDraft] = useState('');
  const [ficheTab, setFicheTab] = useState<'donor' | 'tasks'>('donor');
  const [flash, setFlash] = useState<string | null>(null);

  const q = (path: string) =>
    `${path}${path.includes('?') ? '&' : '?'}companyId=${encodeURIComponent(companyId)}`;

  const filterParams = (pageNum: number, extra?: Record<string, string>) => {
    const params = new URLSearchParams({
      page: String(pageNum),
      limit: viewMode === 'board' || viewMode === 'calendar' ? '100' : '20',
    });
    if (search.trim()) params.set('search', search.trim());
    if (pipeline !== 'all' && viewMode !== 'board') params.set('pipeline', pipeline);
    if (drawer !== 'all') params.set('drawer', drawer);
    if (typeFilter) params.set('type', typeFilter);
    if (institutionFilter) params.set('institution', institutionFilter);
    if (extra) {
      for (const [k, v] of Object.entries(extra)) params.set(k, v);
    }
    return params;
  };

  const load = useCallback(
    async (pageNum = 1) => {
      if (!companyId) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const r = await fetch(q(`/api/opportunity/catalog?${filterParams(pageNum)}`), { cache: 'no-store' });
        const d = (await r.json()) as {
          funds?: Opportunity[];
          institutions?: string[];
          types?: string[];
          pagination?: { total: number; pages: number; current: number };
        };
        if (r.ok) {
          setItems(d.funds ?? []);
          setInstitutions(d.institutions ?? []);
          setTypes(d.types ?? []);
          setTotal(d.pagination?.total ?? 0);
          setPages(d.pagination?.pages ?? 1);
          setPage(d.pagination?.current ?? pageNum);
        }
      } finally {
        setLoading(false);
      }
    },
    [companyId, search, pipeline, drawer, typeFilter, institutionFilter, viewMode],
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
    body: {
      pipelineStatus?: PipelineStatus;
      watchOpen?: boolean;
      ownerUserId?: string | null;
      donor?: DonorFiche;
      amountRequested?: number | null;
      decisionOutcome?: FundDecisionOutcome;
      decisionNote?: string | null;
      tasks?: FundTask[];
      seedDefaultTasks?: boolean;
    },
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
        const d = (await r.json()) as {
          donor?: DonorFiche | null;
          tasks?: FundTask[];
          decisionOutcome?: FundDecisionOutcome;
          amountRequested?: number | null;
          siepProjectId?: string | null;
          successFee?: {
            allowed: boolean;
            accrued?: boolean;
            blockedReason?: string | null;
          };
          siepHint?: { canHandoff: boolean };
        };
        setItems((prev) =>
          prev.map((item) =>
            item.id === fundId
              ? {
                  ...item,
                  ...body,
                  donor: d.donor ?? body.donor ?? item.donor,
                  tasks: d.tasks ?? body.tasks ?? item.tasks,
                  decisionOutcome: d.decisionOutcome ?? body.decisionOutcome ?? item.decisionOutcome,
                  amountRequested:
                    d.amountRequested !== undefined
                      ? d.amountRequested
                      : body.amountRequested !== undefined
                        ? body.amountRequested
                        : item.amountRequested,
                  siepProjectId: d.siepProjectId ?? item.siepProjectId,
                }
              : item,
          ),
        );
        if (donorFund?.id === fundId) {
          setDonorFund((cur) =>
            cur
              ? {
                  ...cur,
                  ...body,
                  donor: d.donor ?? body.donor ?? cur.donor,
                  tasks: d.tasks ?? body.tasks ?? cur.tasks,
                  siepProjectId: d.siepProjectId ?? cur.siepProjectId,
                }
              : cur,
          );
        }
        if (body.pipelineStatus === 'won') {
          if (d.successFee && !d.successFee.allowed && d.successFee.blockedReason) {
            setFlash(d.successFee.blockedReason);
          } else if (d.successFee?.accrued) {
            setFlash(
              t(
                'Ganho registado · success fee acumulada (consultoria).',
                'Ganado registrado · success fee acumulada (consultoría).',
                'Won recorded · success fee accrued (consulting).',
              ),
            );
          } else if (d.siepHint?.canHandoff) {
            setFlash(
              t(
                'Ganho registado. Pode abrir o projecto SIEP para execução.',
                'Ganado registrado. Puede abrir el proyecto SIEP para ejecución.',
                'Won recorded. You can open the SIEP project for execution.',
              ),
            );
          }
        }
      }
    } finally {
      setBusyId(null);
    }
  };

  const handoffSiep = async (fundId: string) => {
    if (!companyId) return;
    setBusyId(fundId);
    try {
      const r = await fetch(q('/api/fundhub/siep-handoff'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fundId, locale }),
      });
      const d = (await r.json()) as { href?: string; projectId?: string; error?: string };
      if (!r.ok) {
        setFlash(d.error || 'SIEP handoff failed');
        return;
      }
      if (d.projectId) {
        setItems((prev) =>
          prev.map((item) => (item.id === fundId ? { ...item, siepProjectId: d.projectId } : item)),
        );
      }
      if (d.href) {
        window.open(d.href, '_blank', 'noopener,noreferrer');
      }
    } finally {
      setBusyId(null);
    }
  };

  const exportCsv = async () => {
    if (!companyId) return;
    setExporting(true);
    try {
      const r = await fetch(q(`/api/opportunity/catalog?${filterParams(1, { export: '1' })}`), {
        cache: 'no-store',
      });
      const d = (await r.json()) as { funds?: Opportunity[] };
      const rows = d.funds ?? [];
      const header = [
        'nome',
        'instituicao',
        'tipo',
        'prazo',
        'pipeline',
        'origem',
        'url_oficial',
        'dono',
        'contactos',
        'janela_tipica',
        'paises',
      ];
      const lines = [
        header.join(','),
        ...rows.map((f) =>
          [
            csvCell(f.name),
            csvCell(f.institution),
            csvCell(f.type),
            csvCell(f.deadline ? new Date(f.deadline).toISOString().slice(0, 10) : ''),
            csvCell(pipelineLabel(f.pipelineStatus ?? 'decide', locale)),
            csvCell(formatOriginLine(f.origin, locale)),
            csvCell(f.linkOficial ?? ''),
            csvCell(members.find((m) => m.id === f.ownerUserId)?.name || members.find((m) => m.id === f.ownerUserId)?.email || ''),
            csvCell(f.donor?.contacts ?? ''),
            csvCell(f.donor?.typicalWindow ?? ''),
            csvCell(f.countries ?? ''),
          ].join(','),
        ),
      ];
      const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'fundhub-em-curso.csv';
      a.click();
      URL.revokeObjectURL(a.href);
    } finally {
      setExporting(false);
    }
  };

  const openDonor = (f: Opportunity) => {
    setDonorFund(f);
    setDonorDraft({
      contacts: f.donor?.contacts ?? '',
      typicalWindow: f.donor?.typicalWindow ?? '',
      approach: f.donor?.approach ?? '',
    });
    setFicheTab('donor');
    setTaskDraft('');
    if (!f.tasks?.length) {
      void patchFund(f.id, { seedDefaultTasks: true });
    }
  };

  const saveDonor = async () => {
    if (!donorFund) return;
    await patchFund(donorFund.id, { donor: donorDraft });
    setDonorFund(null);
  };

  const memberLabel = (id?: string | null) => {
    if (!id) return '';
    const m = members.find((x) => x.id === id);
    return m?.name || m?.email || '';
  };

  if (!companyId) {
    return (
      <StateEmpty
        title={t('Empresa não seleccionada', 'Empresa no seleccionada', 'No company selected')}
        description={t('Escolha a empresa na barra lateral.', 'Elija la empresa.', 'Pick the active company.')}
      />
    );
  }

  return (
    <div className="space-y-5">
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
              'Mesa de trabalho: prazo, estado e origem na mesma linha.',
              'Mesa de trabajo: plazo, estado y origen en la misma fila.',
              'Work desk: deadline, status and origin on one row.',
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

      {flash && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          <span>{flash}</span>
          <button type="button" onClick={() => setFlash(null)} className="text-xs underline">
            OK
          </button>
        </div>
      )}

      <div className="flex flex-wrap gap-1.5">
        {(
          [
            ['all', t('Todos', 'Todos', 'All')],
            ['work', t('Esta janela', 'Esta ventana', 'This window')],
            ['watch', t('Relógio', 'Reloj', 'Watch')],
            ['repo', t('Sem chamada', 'Sin convocatoria', 'No call')],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setDrawer(key)}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              drawer === key ? 'bg-amber-700 text-white' : 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            {label}
          </button>
        ))}
        <span className="mx-1 hidden h-6 w-px bg-gray-200 sm:inline-block" />
        {(
          [
            ['table', t('Tabela', 'Tabla', 'Table')],
            ['board', t('Quadro', 'Tablero', 'Board')],
            ['calendar', t('Calendário', 'Calendario', 'Calendar')],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setViewMode(key)}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              viewMode === key ? 'bg-slate-800 text-white' : 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {(
          [
            ['all', t('Pipeline', 'Pipeline', 'Pipeline')],
            ['decide', t('Decidir', 'Decidir', 'Decide')],
            ['prepare', t('Preparar', 'Preparar', 'Prepare')],
            ['submitted', t('Submetido', 'Enviado', 'Submitted')],
            ['closed', t('Fechado', 'Cerrado', 'Closed')],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setPipeline(key === 'all' ? 'all' : key)}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              pipeline === key ? 'bg-gray-900 text-white' : 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-[180px] flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void load(1)}
            placeholder={t('Pesquisar…', 'Buscar…', 'Search…')}
            className="w-full rounded-lg border border-gray-200 py-2 pl-9 pr-3 text-sm"
          />
        </div>
        {types.length > 1 && (
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="rounded-lg border border-gray-200 bg-white px-2 py-2 text-xs text-gray-800"
          >
            <option value="">{t('Tipo', 'Tipo', 'Type')}</option>
            {types.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        )}
        {institutions.length > 1 && (
          <select
            value={institutionFilter}
            onChange={(e) => setInstitutionFilter(e.target.value)}
            className="max-w-[14rem] rounded-lg border border-gray-200 bg-white px-2 py-2 text-xs text-gray-800"
          >
            <option value="">{t('Instituição', 'Institución', 'Institution')}</option>
            {institutions.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        )}
        <button
          type="button"
          disabled={exporting || total === 0}
          onClick={() => void exportCsv()}
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          <Download className="h-3.5 w-3.5" />
          CSV
        </button>
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
          {viewMode === 'calendar' ? (
            <FundDeskCalendar
              funds={items}
              locale={locale}
              onSelect={(id) => {
                const f = items.find((x) => x.id === id);
                if (f) openDonor(f);
              }}
            />
          ) : viewMode === 'board' ? (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {(
                [
                  ['decide', t('Decidir', 'Decidir', 'Decide')],
                  ['prepare', t('Preparar', 'Preparar', 'Prepare')],
                  ['submitted', t('Submetido', 'Enviado', 'Submitted')],
                  ['closed', t('Fechado', 'Cerrado', 'Closed')],
                ] as const
              ).map(([col, label]) => {
                const colItems = items.filter((f) => {
                  const st = f.pipelineStatus ?? 'decide';
                  if (col === 'closed') return st === 'won' || st === 'lost';
                  return st === col;
                });
                return (
                  <div key={col} className="rounded-xl border border-gray-200 bg-gray-50/80 p-2">
                    <div className="mb-2 flex items-center justify-between px-1">
                      <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-600">{label}</h3>
                      <span className="text-xs text-gray-400">{colItems.length}</span>
                    </div>
                    <ul className="space-y-2">
                      {colItems.map((f) => (
                        <li
                          key={f.id}
                          className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm"
                        >
                          <p className="text-sm font-medium text-gray-900 line-clamp-2">{f.name}</p>
                          <p className="mt-0.5 text-xs text-gray-500">{f.institution}</p>
                          {f.deadline && (
                            <p className="mt-1 text-[11px] text-amber-800">
                              {new Date(f.deadline).toLocaleDateString(locale === 'en' ? 'en' : locale === 'pt' ? 'pt' : 'es')}
                            </p>
                          )}
                          <div className="mt-2 flex flex-wrap gap-1">
                            {(
                              [
                                ['decide', t('Decidir', 'Decidir', 'Decide')],
                                ['prepare', t('Preparar', 'Preparar', 'Prepare')],
                                ['submitted', t('Submetido', 'Enviado', 'Submitted')],
                                ['won', t('Ganho', 'Ganado', 'Won')],
                                ['lost', t('Perdido', 'Perdido', 'Lost')],
                              ] as const
                            ).map(([st, stLabel]) => (
                              <button
                                key={st}
                                type="button"
                                disabled={busyId === f.id || (f.pipelineStatus ?? 'decide') === st}
                                onClick={() => void patchFund(f.id, { pipelineStatus: st })}
                                className="rounded px-1.5 py-0.5 text-[10px] font-medium text-gray-600 ring-1 ring-gray-200 hover:bg-gray-50 disabled:opacity-40"
                              >
                                {stLabel}
                              </button>
                            ))}
                          </div>
                        </li>
                      ))}
                      {colItems.length === 0 && (
                        <li className="px-1 py-6 text-center text-xs text-gray-400">—</li>
                      )}
                    </ul>
                  </div>
                );
              })}
            </div>
          ) : (
          <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
            <table className="min-w-[920px] w-full text-left text-sm">
              <thead className="bg-gray-50 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-3 py-2 w-8" />
                  <th className="px-3 py-2">{t('Fundo', 'Fondo', 'Fund')}</th>
                  <th className="px-3 py-2">{t('Pedido', 'Pedido', 'Requested')}</th>
                  <th className="px-3 py-2">{t('Prazo', 'Plazo', 'Deadline')}</th>
                  <th className="px-3 py-2">{t('Estado', 'Estado', 'Status')}</th>
                  <th className="px-3 py-2">{t('Origem', 'Origen', 'Origin')}</th>
                  <th className="px-3 py-2">{t('Dono', 'Dueño', 'Owner')}</th>
                  <th className="px-3 py-2 text-right">{t('Acções', 'Acciones', 'Actions')}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((f) => {
                  const urgency = urgencyDot(f.deadline);
                  const origin = formatOriginLine(f.origin, locale);
                  return (
                    <tr key={f.id} className="border-t border-gray-100 hover:bg-amber-50/40">
                      <td className="px-3 py-2">
                        {urgency ? (
                          <span title={urgency.title} className={`inline-block h-2.5 w-2.5 rounded-full ${urgency.className}`} />
                        ) : (
                          <span className="inline-block h-2.5 w-2.5 rounded-full bg-gray-200" />
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <p className="font-medium text-gray-900">{f.name}</p>
                        <p className="text-xs text-gray-500">
                          {f.institution}
                          {f.type ? ` · ${f.type}` : ''}
                        </p>
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          min={0}
                          disabled={busyId === f.id}
                          className="w-24 rounded border border-gray-200 px-1.5 py-1 text-xs"
                          placeholder="USD"
                          defaultValue={f.amountRequested ?? ''}
                          key={`${f.id}-${f.amountRequested ?? 'x'}`}
                          onBlur={(e) => {
                            const v = e.target.value.trim();
                            const n = v === '' ? null : Number(v);
                            if (n !== (f.amountRequested ?? null) && (v === '' || Number.isFinite(n))) {
                              void patchFund(f.id, { amountRequested: n });
                            }
                          }}
                        />
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-xs text-gray-700">
                        {f.deadline ? new Date(f.deadline).toLocaleDateString() : '—'}
                      </td>
                      <td className="px-3 py-2">
                        <select
                          disabled={busyId === f.id}
                          value={f.pipelineStatus ?? 'decide'}
                          onChange={(e) => void patchFund(f.id, { pipelineStatus: e.target.value as PipelineStatus })}
                          className="rounded border border-gray-200 bg-white px-1.5 py-1 text-xs text-gray-800"
                        >
                          {(['decide', 'prepare', 'submitted', 'won', 'lost'] as const).map((s) => (
                            <option key={s} value={s}>
                              {pipelineLabel(s, locale)}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-500">{origin || '—'}</td>
                      <td className="px-3 py-2">
                        {members.length > 0 ? (
                          <select
                            disabled={busyId === f.id}
                            value={f.ownerUserId ?? ''}
                            onChange={(e) => void patchFund(f.id, { ownerUserId: e.target.value || null })}
                            className="max-w-[8rem] rounded border border-gray-200 bg-white px-1.5 py-1 text-xs text-gray-800"
                          >
                            <option value="">{t('—', '—', '—')}</option>
                            {members.map((m) => (
                              <option key={m.id} value={m.id}>
                                {m.name || m.email || m.id.slice(0, 6)}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span className="text-xs text-gray-400">{memberLabel(f.ownerUserId) || '—'}</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap items-center justify-end gap-1.5">
                          <label className="inline-flex items-center gap-1 text-[10px] text-gray-600">
                            <input
                              type="checkbox"
                              disabled={busyId === f.id}
                              checked={Boolean(f.watchOpen)}
                              onChange={(e) => void patchFund(f.id, { watchOpen: e.target.checked })}
                            />
                            {t('Relógio', 'Reloj', 'Watch')}
                          </label>
                          <button
                            type="button"
                            onClick={() => openDonor(f)}
                            className="rounded border border-gray-200 px-2 py-1 text-[11px] text-gray-700 hover:bg-gray-50"
                          >
                            {t('Ficha', 'Ficha', 'Fiche')}
                          </button>
                          {f.linkOficial && (
                            <a
                              href={f.linkOficial}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="rounded border border-gray-200 px-2 py-1 text-[11px] text-gray-700 hover:bg-gray-50"
                            >
                              URL
                            </a>
                          )}
                          <Link
                            href={`/hub/fundhub/discover/${f.id}`}
                            className="rounded border border-gray-200 px-2 py-1 text-[11px] text-gray-700 hover:bg-gray-50"
                          >
                            {t('Detalhe', 'Detalle', 'Detail')}
                          </Link>
                          <Link
                            href={`/hub/fundhub/proposals?fundId=${encodeURIComponent(f.id)}`}
                            className="inline-flex items-center gap-1 rounded bg-gray-900 px-2 py-1 text-[11px] font-medium text-white hover:bg-gray-800"
                          >
                            <FileText className="h-3 w-3" />
                            {t('Proposta', 'Propuesta', 'Proposal')}
                          </Link>
                          {(f.pipelineStatus === 'won' || f.siepProjectId) && (
                            <button
                              type="button"
                              disabled={busyId === f.id}
                              onClick={() => {
                                if (f.siepProjectId) {
                                  window.open(`/siep/projects/${f.siepProjectId}`, '_blank', 'noopener,noreferrer');
                                } else {
                                  void handoffSiep(f.id);
                                }
                              }}
                              className="rounded border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-medium text-emerald-900 hover:bg-emerald-100 disabled:opacity-50"
                            >
                              {f.siepProjectId
                                ? t('Abrir SIEP', 'Abrir SIEP', 'Open SIEP')
                                : t('Criar no SIEP', 'Crear en SIEP', 'Create in SIEP')}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          )}

          {viewMode === 'table' && pages > 1 && (
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

      {donorFund && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-gray-900">
                  {t('Expediente', 'Expediente', 'Case file')}
                </h2>
                <p className="mt-0.5 text-xs text-gray-500">
                  {donorFund.institution} · {donorFund.name}
                </p>
              </div>
              <button type="button" onClick={() => setDonorFund(null)} className="rounded p-1 text-gray-400 hover:bg-gray-100">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-3 flex gap-1">
              {(
                [
                  ['donor', t('Doador', 'Donante', 'Funder')],
                  ['tasks', t('Tarefas', 'Tareas', 'Tasks')],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setFicheTab(key)}
                  className={`rounded-full px-3 py-1 text-xs font-medium ${
                    ficheTab === key ? 'bg-amber-700 text-white' : 'border border-gray-200 text-gray-700'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {ficheTab === 'donor' ? (
              <>
                <label className="mt-4 block text-xs font-medium text-gray-600">
                  {t('Contactos', 'Contactos', 'Contacts')}
                  <textarea
                    value={donorDraft.contacts ?? ''}
                    onChange={(e) => setDonorDraft((d) => ({ ...d, contacts: e.target.value }))}
                    rows={2}
                    className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                  />
                </label>
                <label className="mt-3 block text-xs font-medium text-gray-600">
                  {t('Janela típica', 'Ventana típica', 'Typical window')}
                  <input
                    value={donorDraft.typicalWindow ?? ''}
                    onChange={(e) => setDonorDraft((d) => ({ ...d, typicalWindow: e.target.value }))}
                    placeholder={t('ex.: março–maio', 'ej.: marzo–mayo', 'e.g. March–May')}
                    className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                  />
                </label>
                <label className="mt-3 block text-xs font-medium text-gray-600">
                  {t('Como abordar', 'Cómo abordar', 'How to approach')}
                  <textarea
                    value={donorDraft.approach ?? ''}
                    onChange={(e) => setDonorDraft((d) => ({ ...d, approach: e.target.value }))}
                    rows={3}
                    className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                  />
                </label>
                <div className="mt-4 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setDonorFund(null)}
                    className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-700"
                  >
                    {t('Cancelar', 'Cancelar', 'Cancel')}
                  </button>
                  <button
                    type="button"
                    disabled={busyId === donorFund.id}
                    onClick={() => void saveDonor()}
                    className="rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-800 disabled:opacity-50"
                  >
                    {t('Guardar ficha', 'Guardar ficha', 'Save fiche')}
                  </button>
                </div>
              </>
            ) : (
              <div className="mt-4 space-y-3">
                <ul className="max-h-56 space-y-2 overflow-y-auto">
                  {(donorFund.tasks ?? []).map((task) => (
                    <li key={task.id} className="flex items-start gap-2 rounded-lg border border-gray-100 px-2 py-1.5">
                      <input
                        type="checkbox"
                        checked={task.done}
                        disabled={busyId === donorFund.id}
                        onChange={() => {
                          const next = (donorFund.tasks ?? []).map((x) =>
                            x.id === task.id ? { ...x, done: !x.done } : x,
                          );
                          void patchFund(donorFund.id, { tasks: next });
                        }}
                        className="mt-1"
                      />
                      <div className="min-w-0 flex-1">
                        <p className={`text-sm ${task.done ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
                          {task.title}
                        </p>
                        {task.dueAt && (
                          <p className="text-[11px] text-amber-800">{task.dueAt.slice(0, 10)}</p>
                        )}
                      </div>
                    </li>
                  ))}
                  {(donorFund.tasks ?? []).length === 0 && (
                    <li className="py-4 text-center text-xs text-gray-400">
                      {t('Sem tarefas — adicione abaixo.', 'Sin tareas — añada abajo.', 'No tasks — add below.')}
                    </li>
                  )}
                </ul>
                <div className="flex gap-2">
                  <input
                    value={taskDraft}
                    onChange={(e) => setTaskDraft(e.target.value)}
                    placeholder={t('Nova tarefa…', 'Nueva tarea…', 'New task…')}
                    className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && taskDraft.trim()) {
                        const next = [...(donorFund.tasks ?? []), newFundTask(taskDraft)];
                        setTaskDraft('');
                        void patchFund(donorFund.id, { tasks: next });
                      }
                    }}
                  />
                  <button
                    type="button"
                    disabled={!taskDraft.trim() || busyId === donorFund.id}
                    onClick={() => {
                      const next = [...(donorFund.tasks ?? []), newFundTask(taskDraft)];
                      setTaskDraft('');
                      void patchFund(donorFund.id, { tasks: next });
                    }}
                    className="inline-flex items-center gap-1 rounded-lg bg-amber-700 px-3 py-2 text-xs font-medium text-white disabled:opacity-50"
                  >
                    <CheckSquare className="h-3.5 w-3.5" />
                    {t('Add', 'Add', 'Add')}
                  </button>
                </div>
                {!(donorFund.tasks ?? []).length && (
                  <button
                    type="button"
                    className="text-xs font-medium text-amber-800 underline"
                    onClick={() =>
                      void patchFund(donorFund.id, {
                        tasks: defaultMilestones(locale, donorFund.deadline),
                      })
                    }
                  >
                    {t('Usar milestones padrão', 'Usar hitos por defecto', 'Use default milestones')}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
