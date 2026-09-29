'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Loader2, Search } from 'lucide-react';
import { useApp } from '@/app/providers';
import type { AuroraMethodStage, AuroraPortfolioItem } from '@/lib/aurora-portfolio';
import {
  AURORA_STAGES,
  auroraNextAction,
  auroraPortfolioCounts,
  auroraStaleDays,
  auroraWeekBriefing,
  auroraWeekBuckets,
  groupAuroraByProgram,
  type AuroraPortfolioCounts,
} from '@/lib/aurora-week';
import { writeAuroraAttendedSelection } from '@/lib/aurora-attended-selection';
import { AuroraMethodRail } from '@/components/etholys/AuroraMethodRail';
import { useAuroraAttendedOptional } from '@/components/etholys/AuroraAttendedContext';

type FilterId = 'all' | 'mine' | 'unclaimed' | 'blocked' | AuroraMethodStage;
type ViewId = 'week' | 'board' | 'programs';

function businessHref(row: AuroraPortfolioItem) {
  const q = new URLSearchParams({ company: row.companyId, engagement: row.engagementId });
  return `/hub/aurora/diagnostico?${q}`;
}

function dossierHref(row: AuroraPortfolioItem) {
  const q = new URLSearchParams({ company: row.companyId, engagement: row.engagementId });
  return `/hub/aurora/dossie?${q}`;
}

const EMPTY_COUNTS: AuroraPortfolioCounts = {
  total: 0,
  mine: 0,
  unclaimed: 0,
  blocked: 0,
  needsAttention: 0,
  talk: 0,
  portrait: 0,
  bets: 0,
  rhythm: 0,
  steady: 0,
  programs: 0,
};

export function AuroraPortfolioWorkspace({ initialView = 'week' }: { initialView?: ViewId }) {
  const { locale, activeCompanyId } = useApp();
  const search = useSearchParams();
  const attended = useAuroraAttendedOptional();
  const loc = locale === 'es' || locale === 'en' ? locale : 'pt';
  const operatorCompanyId = String(activeCompanyId || attended?.operatorCompanyId || '').trim();
  const needPick = search.get('pick') === '1';
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [rows, setRows] = useState<AuroraPortfolioItem[]>([]);
  const [counts, setCounts] = useState<AuroraPortfolioCounts>(EMPTY_COUNTS);
  const [canManage, setCanManage] = useState(false);
  const [technicians, setTechnicians] = useState<Array<{ userId: string; name: string }>>([]);
  const [techFilter, setTechFilter] = useState('');
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<FilterId>('all');
  const [view, setView] = useState<ViewId>(initialView);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [weekDraft, setWeekDraft] = useState<Record<string, { happened: string; blocked: string; nextStep: string }>>({});

  const remember = (row: AuroraPortfolioItem) => {
    if (!operatorCompanyId) return;
    const ref = {
      companyId: row.companyId,
      engagementId: row.engagementId,
      name: row.name,
      engagementTitle: row.engagementTitle,
    };
    writeAuroraAttendedSelection(operatorCompanyId, ref);
    attended?.setSelection(ref);
  };

  const copy =
    loc === 'es'
      ? {
          title: 'Cartera de asistencia técnica',
          line: 'Dashboard de la incubadora: negocios externos que acompañás. Elegí un negocio abajo o en el selector de AURORA.',
          search: 'Buscar negocio o programa…',
          empty: 'Todavía no hay negocios. Abrí un contrato AT para acompañar MIPYMEs.',
          contracts: 'Contratos AT',
          invite: 'Invitar técnicos',
          techAll: 'Todos los técnicos',
          pickBanner: 'Elegí un negocio de la cartera para abrir Diagnóstico o Dossier.',
          open: 'Abrir dossier',
          talkNow: 'Empezar conversación',
          diagnose: 'Diagnóstico',
          diagDone: 'diagnóstico',
          bets: 'apuestas',
          week: 'Ronda',
          board: 'Método',
          programs: 'Programas',
          none: 'Sin nota',
          all: 'Todos',
          mine: 'Míos',
          unclaimed: 'Sin técnico',
          blocked: 'Trabados',
          talk: 'Conversación',
          portrait: 'Retrato',
          betsStage: 'Apuestas',
          rhythm: 'Ritmo',
          steady: 'En ritmo',
          need: 'piden atención',
          claim: 'Yo acompaño',
          reclaim: 'Pasar a mí',
          release: 'Dejar',
          happened: 'Qué pasó',
          blockedField: 'Qué traba',
          next: 'Próximo paso',
          log: 'Anotar semana',
          hypo: 'Hipótesis',
          tech: 'Técnico',
          briefing: 'Esta semana',
          round: 'Mi ronda',
          dueBets: 'esta semana',
          days: 'días sin nota',
          action: 'Ahora',
          emptyRound: 'Nada tuyo pide ronda. Mirá sin técnico o trabados.',
          emptyBlocked: 'Ningún negocio está trabado en la última nota.',
          emptyUnclaimed: 'Todos los negocios tienen técnico.',
          businesses: 'negocios',
        }
      : loc === 'en'
        ? {
            title: 'Technical assistance portfolio',
            line: 'Incubator dashboard: external businesses you accompany. Pick one below or in the AURORA selector.',
            search: 'Search a business or program…',
            empty: 'No businesses yet. Open an AT contract to accompany MSMEs.',
            contracts: 'AT contracts',
            invite: 'Invite technicians',
            techAll: 'All technicians',
            pickBanner: 'Pick a business from the portfolio to open Diagnostic or Dossier.',
            open: 'Open dossier',
            talkNow: 'Start conversation',
            diagnose: 'Diagnostic',
            diagDone: 'diagnostic',
            bets: 'bets',
            week: 'Round',
            board: 'Method',
            programs: 'Programs',
            none: 'No note',
            all: 'All',
            mine: 'Mine',
            unclaimed: 'No technician',
            blocked: 'Blocked',
            talk: 'Conversation',
            portrait: 'Portrait',
            betsStage: 'Bets',
            rhythm: 'Rhythm',
            steady: 'On rhythm',
            need: 'need attention',
            claim: 'I accompany this',
            reclaim: 'Take over',
            release: 'Release',
            happened: 'What happened',
            blockedField: 'What is stuck',
            next: 'Next step',
            log: 'Log week',
            hypo: 'Hypothesis',
            tech: 'Technician',
            briefing: 'This week',
            round: 'My round',
            dueBets: 'this week',
            days: 'days without a note',
            action: 'Now',
            emptyRound: 'Nothing of yours needs a round. Check unclaimed or blocked.',
            emptyBlocked: 'No business is stuck on the last note.',
            emptyUnclaimed: 'Every business has a technician.',
            businesses: 'businesses',
          }
        : {
            title: 'Carteira de assistência técnica',
            line: 'Dashboard da incubadora: negócios externos que acompanhas. Escolhe um negócio abaixo ou no seletor do AURORA.',
            search: 'Pesquisar negócio ou programa…',
            empty: 'Ainda não há negócios. Abre um contrato AT para acompanhar MIPYMEs.',
            contracts: 'Contratos AT',
            invite: 'Convidar técnicos',
            techAll: 'Todos os técnicos',
            pickBanner: 'Escolhe um negócio da carteira para abrir Diagnóstico ou Dossiê.',
            open: 'Abrir dossiê',
            talkNow: 'Começar conversa',
            diagnose: 'Diagnóstico',
            diagDone: 'diagnóstico',
            bets: 'apostas',
            week: 'Ronda',
            board: 'Método',
            programs: 'Programas',
            none: 'Sem nota',
            all: 'Todos',
            mine: 'Meus',
            unclaimed: 'Sem técnico',
            blocked: 'Travados',
            talk: 'Conversa',
            portrait: 'Retrato',
            betsStage: 'Apostas',
            rhythm: 'Ritmo',
            steady: 'Em ritmo',
            need: 'pedem atenção',
            claim: 'Eu acompanho',
            reclaim: 'Passar para mim',
            release: 'Deixar',
            happened: 'O que aconteceu',
            blockedField: 'O que trava',
            next: 'Próximo passo',
            log: 'Anotar semana',
            hypo: 'Hipótese',
            tech: 'Técnico',
            briefing: 'Esta semana',
            round: 'A minha ronda',
            dueBets: 'esta semana',
            days: 'dias sem nota',
            action: 'Agora',
            emptyRound: 'Nada teu pede ronda. Vê sem técnico ou travados.',
            emptyBlocked: 'Nenhum negócio está travado na última nota.',
            emptyUnclaimed: 'Todos os negócios têm técnico.',
            businesses: 'negócios',
          };

  const stageLabel: Record<AuroraMethodStage, string> = {
    talk: copy.talk,
    portrait: copy.portrait,
    bets: copy.betsStage,
    rhythm: copy.rhythm,
    steady: copy.steady,
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (operatorCompanyId) params.set('operatorCompanyId', operatorCompanyId);
      if (techFilter) params.set('technicianUserId', techFilter);
      const r = await fetch(`/api/business-dossier/portfolio?${params}`, { cache: 'no-store' });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Falha');
      const list = (d.businesses || []) as AuroraPortfolioItem[];
      setRows(list);
      setCounts(d.counts || auroraPortfolioCounts(list));
      setCanManage(Boolean(d.canManage));
      setTechnicians(Array.isArray(d.technicians) ? d.technicians : []);
      setWeekDraft((prev) => {
        const next = { ...prev };
        for (const row of list) {
          if (!next[row.companyId]) {
            next[row.companyId] = {
              happened: '',
              blocked: row.lastRhythmBlocked || '',
              nextStep: row.lastRhythmNext || '',
            };
          }
        }
        return next;
      });
      setErr(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro');
    } finally {
      setLoading(false);
    }
  }, [operatorCompanyId, techFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const searched = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter(
      (row) =>
        row.name.toLowerCase().includes(needle) ||
        row.shortName.toLowerCase().includes(needle) ||
        row.engagementTitle.toLowerCase().includes(needle) ||
        row.technicianName.toLowerCase().includes(needle),
    );
  }, [rows, q]);

  const visible = useMemo(() => {
    return searched.filter((row) => {
      if (filter === 'mine' && !row.mine) return false;
      if (filter === 'unclaimed' && row.technicianUserId) return false;
      if (filter === 'blocked' && !row.lastRhythmBlocked.trim()) return false;
      if (filter !== 'all' && filter !== 'mine' && filter !== 'unclaimed' && filter !== 'blocked' && row.stage !== filter) {
        return false;
      }
      return true;
    });
  }, [searched, filter]);

  const briefing = useMemo(() => auroraWeekBriefing(rows, loc), [rows, loc]);
  const buckets = useMemo(() => auroraWeekBuckets(view === 'week' ? searched : visible), [view, searched, visible]);
  const programs = useMemo(() => groupAuroraByProgram(visible), [visible]);

  const claim = async (row: AuroraPortfolioItem, release = false) => {
    setBusyId(row.companyId);
    try {
      const r = await fetch('/api/business-dossier/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId: row.companyId, engagementId: row.engagementId, release }),
      });
      if (!r.ok) {
        const d = await r.json();
        throw new Error(d.error || 'Falha');
      }
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro');
    } finally {
      setBusyId(null);
    }
  };

  const logWeek = async (row: AuroraPortfolioItem) => {
    const draft = weekDraft[row.companyId] || { happened: '', blocked: '', nextStep: '' };
    if (!draft.happened.trim() && !draft.nextStep.trim()) return;
    setBusyId(row.companyId);
    try {
      if (!row.technicianUserId) {
        await fetch('/api/business-dossier/claim', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ companyId: row.companyId, engagementId: row.engagementId }),
        });
      }
      await fetch('/api/business-dossier/rhythm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId: row.companyId,
          engagementId: row.engagementId,
          ...draft,
          source: 'week-board',
        }),
      });
      setWeekDraft((p) => ({ ...p, [row.companyId]: { happened: '', blocked: '', nextStep: '' } }));
      await load();
    } finally {
      setBusyId(null);
    }
  };

  const renderCard = (row: AuroraPortfolioItem, opts?: { log?: boolean }) => {
    const draft = weekDraft[row.companyId] || { happened: '', blocked: '', nextStep: '' };
    const days = auroraStaleDays(row.lastRhythmAt);
    const action = auroraNextAction(row, loc);
    return (
      <li key={row.companyId} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <Link
              href={businessHref(row)}
              onClick={() => remember(row)}
              className="font-medium text-slate-900 hover:underline"
            >
              {row.name}
            </Link>
            <p className="truncate text-xs text-slate-500">{row.engagementTitle}</p>
          </div>
          <span
            className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
              row.stage === 'steady' ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-900'
            }`}
          >
            {stageLabel[row.stage]}
          </span>
        </div>
        <p className="mt-2 text-sm font-medium text-amber-950">
          {copy.action}: {action}
        </p>
        {row.portraitPreview ? <p className="mt-1 line-clamp-2 text-sm text-slate-600">{row.portraitPreview}</p> : null}
        {row.hypothesis ? (
          <p className="mt-1 text-xs text-slate-500">
            {copy.hypo}: {row.hypothesis}
          </p>
        ) : null}
        {row.lastRhythmBlocked ? <p className="mt-1 text-xs text-rose-700">{row.lastRhythmBlocked}</p> : null}
        {row.dueBetTitles?.length > 0 ? (
          <p className="mt-1 text-xs text-amber-900">
            {copy.dueBets}: {row.dueBetTitles.join(' · ')}
          </p>
        ) : row.betTitles.length > 0 ? (
          <p className="mt-1 text-xs text-slate-500">{row.betTitles.join(' · ')}</p>
        ) : null}
        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-500">
          <span>
            {row.openBetCount} {copy.bets}
          </span>
          {days != null ? (
            <span>
              {days} {copy.days}
            </span>
          ) : (
            <span>
              {copy.week}: {row.lastRhythmNext || copy.none}
            </span>
          )}
          {row.technicianName ? (
            <span>
              {copy.tech}: {row.technicianName}
            </span>
          ) : null}
          {!row.technicianUserId ? (
            <button type="button" disabled={busyId === row.companyId} onClick={() => void claim(row)} className="text-amber-900 hover:underline">
              {copy.claim}
            </button>
          ) : row.mine ? (
            <button type="button" disabled={busyId === row.companyId} onClick={() => void claim(row, true)} className="text-slate-500 hover:underline">
              {copy.release}
            </button>
          ) : (
            <button type="button" disabled={busyId === row.companyId} onClick={() => void claim(row)} className="text-amber-900 hover:underline">
              {copy.reclaim}
            </button>
          )}
          <Link
            href={businessHref(row)}
            onClick={() => remember(row)}
            className="ml-auto font-medium text-amber-900 hover:underline"
          >
            {copy.diagnose}
            {typeof row.diagnosticDone === 'number'
              ? ` ${row.diagnosticDone}/${row.diagnosticTotal || 6}`
              : ''}
          </Link>
          <Link
            href={dossierHref(row)}
            onClick={() => remember(row)}
            className="font-medium text-slate-600 hover:underline"
          >
            {copy.open}
          </Link>
        </div>
        {opts?.log ? (
          <div className="mt-3 space-y-2">
            <div className="grid gap-2 sm:grid-cols-3">
              <textarea
                value={draft.happened}
                onChange={(e) => setWeekDraft((p) => ({ ...p, [row.companyId]: { ...draft, happened: e.target.value } }))}
                placeholder={copy.happened}
                rows={2}
                className="rounded-lg border px-3 py-2 text-sm"
              />
              <textarea
                value={draft.blocked}
                onChange={(e) => setWeekDraft((p) => ({ ...p, [row.companyId]: { ...draft, blocked: e.target.value } }))}
                placeholder={copy.blockedField}
                rows={2}
                className="rounded-lg border px-3 py-2 text-sm"
              />
              <textarea
                value={draft.nextStep}
                onChange={(e) => setWeekDraft((p) => ({ ...p, [row.companyId]: { ...draft, nextStep: e.target.value } }))}
                placeholder={copy.next}
                rows={2}
                className="rounded-lg border px-3 py-2 text-sm"
              />
            </div>
            <button
              type="button"
              disabled={busyId === row.companyId}
              onClick={() => void logWeek(row)}
              className="rounded-lg bg-amber-800 px-3 py-1.5 text-sm text-white disabled:opacity-40"
            >
              {copy.log}
            </button>
          </div>
        ) : null}
      </li>
    );
  };

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-amber-700" />
      </div>
    );
  }

  const filters: { id: FilterId; label: string; count?: number }[] = [
    { id: 'mine', label: copy.mine, count: counts.mine },
    { id: 'unclaimed', label: copy.unclaimed, count: counts.unclaimed },
    { id: 'blocked', label: copy.blocked, count: counts.blocked },
    { id: 'all', label: copy.all, count: counts.total },
    { id: 'talk', label: copy.talk, count: counts.talk },
    { id: 'portrait', label: copy.portrait, count: counts.portrait },
    { id: 'bets', label: copy.betsStage, count: counts.bets },
    { id: 'rhythm', label: copy.rhythm, count: counts.rhythm },
    { id: 'steady', label: copy.steady, count: counts.steady },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="space-y-3">
        <div>
          <h1 className="font-serif text-3xl text-slate-900">{copy.title}</h1>
          <p className="mt-1 text-sm text-slate-600">{copy.line}</p>
        </div>
        <AuroraMethodRail stage="rhythm" labels={stageLabel} />
        <div className="grid gap-2 sm:grid-cols-4">
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2">
            <p className="text-[11px] uppercase tracking-wide text-amber-800">{copy.round}</p>
            <p className="text-2xl font-semibold text-amber-950">{counts.mine}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
            <p className="text-[11px] uppercase tracking-wide text-slate-500">{copy.unclaimed}</p>
            <p className="text-2xl font-semibold text-slate-900">{counts.unclaimed}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
            <p className="text-[11px] uppercase tracking-wide text-slate-500">{copy.blocked}</p>
            <p className="text-2xl font-semibold text-rose-800">{counts.blocked}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
            <p className="text-[11px] uppercase tracking-wide text-slate-500">{copy.need}</p>
            <p className="text-2xl font-semibold text-slate-900">{counts.needsAttention}</p>
          </div>
        </div>
      </header>

      {needPick ? (
        <p className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          {copy.pickBanner}
        </p>
      ) : null}

      {briefing.length > 0 ? (
        <section className="rounded-2xl border border-amber-200 bg-amber-50/80 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">{copy.briefing}</p>
          <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-slate-800">
            {briefing.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {err && <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{err}</p>}

      <div className="flex flex-wrap items-center gap-2">
        <label className="relative min-w-[12rem] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={copy.search}
            className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-8 pr-3 text-sm"
          />
        </label>
        {(['week', 'board', 'programs'] as ViewId[]).map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setView(id)}
            className={`rounded-lg px-3 py-2 text-sm ${view === id ? 'bg-amber-800 text-white' : 'border border-slate-200 bg-white'}`}
          >
            {id === 'week' ? copy.week : id === 'board' ? copy.board : copy.programs}
          </button>
        ))}
        <Link href="/hub/aurora/contratos" className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
          {copy.contracts}
        </Link>
        {canManage ? (
          <>
            <select
              value={techFilter}
              onChange={(e) => setTechFilter(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
            >
              <option value="">{copy.techAll}</option>
              {technicians.map((t) => (
                <option key={t.userId} value={t.userId}>
                  {t.name}
                </option>
              ))}
            </select>
            <Link
              href="/hub/workspace/team"
              className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-950 hover:bg-amber-100"
            >
              {copy.invite}
            </Link>
          </>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {filters.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              filter === f.id ? 'bg-amber-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {f.label}
            {typeof f.count === 'number' ? ` ${f.count}` : ''}
          </button>
        ))}
      </div>

      {visible.length === 0 && view !== 'week' ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-10 text-center">
          <p className="text-sm text-slate-600">{copy.empty}</p>
          <Link href="/hub/aurora/contratos" className="mt-3 inline-block text-sm font-medium text-amber-900 hover:underline">
            {copy.contracts}
          </Link>
        </div>
      ) : view === 'week' && searched.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-10 text-center">
          <p className="text-sm text-slate-600">{copy.empty}</p>
          <Link href="/hub/aurora/contratos" className="mt-3 inline-block text-sm font-medium text-amber-900 hover:underline">
            {copy.contracts}
          </Link>
        </div>
      ) : view === 'week' ? (
        <div className="grid gap-6 lg:grid-cols-3">
          <section>
            <h2 className="mb-2 text-sm font-semibold text-slate-800">
              {copy.round} · {buckets.round.length}
            </h2>
            {buckets.round.length === 0 ? (
              <p className="rounded-xl border border-dashed border-slate-200 bg-white px-3 py-6 text-sm text-slate-500">{copy.emptyRound}</p>
            ) : (
              <ul className="space-y-3">{buckets.round.map((row) => renderCard(row, { log: true }))}</ul>
            )}
          </section>
          <section>
            <h2 className="mb-2 text-sm font-semibold text-slate-800">
              {copy.blocked} · {buckets.blocked.length}
            </h2>
            {buckets.blocked.length === 0 ? (
              <p className="rounded-xl border border-dashed border-slate-200 bg-white px-3 py-6 text-sm text-slate-500">{copy.emptyBlocked}</p>
            ) : (
              <ul className="space-y-3">{buckets.blocked.map((row) => renderCard(row, { log: true }))}</ul>
            )}
          </section>
          <section>
            <h2 className="mb-2 text-sm font-semibold text-slate-800">
              {copy.unclaimed} · {buckets.unclaimed.length}
            </h2>
            {buckets.unclaimed.length === 0 ? (
              <p className="rounded-xl border border-dashed border-slate-200 bg-white px-3 py-6 text-sm text-slate-500">{copy.emptyUnclaimed}</p>
            ) : (
              <ul className="space-y-3">{buckets.unclaimed.map((row) => renderCard(row))}</ul>
            )}
          </section>
        </div>
      ) : view === 'programs' ? (
        <ul className="space-y-6">
          {programs.map((group) => (
            <li key={group.engagementId} className="space-y-3">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <div>
                  <h2 className="font-serif text-xl text-slate-900">{group.title}</h2>
                  <p className="text-xs text-slate-500">
                    {group.items.length} {copy.businesses}
                    {group.unclaimed ? ` · ${group.unclaimed} ${copy.unclaimed.toLowerCase()}` : ''}
                    {group.needsAttention ? ` · ${group.needsAttention} ${copy.need}` : ''}
                  </p>
                </div>
              </div>
              <ul className="grid gap-3 md:grid-cols-2">{group.items.map((row) => renderCard(row))}</ul>
            </li>
          ))}
        </ul>
      ) : (
        <div className="grid gap-3 lg:grid-cols-5">
          {AURORA_STAGES.map((stage) => {
            const col = visible.filter((row) => row.stage === stage);
            return (
              <section key={stage} className="min-w-0">
                <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {stageLabel[stage]} · {col.length}
                </h2>
                <ul className="space-y-3">{col.map((row) => renderCard(row))}</ul>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
