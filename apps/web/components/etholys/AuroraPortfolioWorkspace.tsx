'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Loader2, Search } from 'lucide-react';
import { useApp } from '@/app/providers';
import type { AuroraMethodStage, AuroraPortfolioItem } from '@/lib/aurora-portfolio';

type FilterId = 'all' | 'mine' | AuroraMethodStage;
type ViewId = 'board' | 'week';

function dossierHref(row: AuroraPortfolioItem) {
  const q = new URLSearchParams({ company: row.companyId, engagement: row.engagementId });
  return `/hub/aurora/dossie?${q}`;
}

export function AuroraPortfolioWorkspace() {
  const { locale } = useApp();
  const loc = locale === 'es' || locale === 'en' ? locale : 'pt';
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [rows, setRows] = useState<AuroraPortfolioItem[]>([]);
  const [counts, setCounts] = useState({ total: 0, needsAttention: 0, talk: 0, rhythm: 0 });
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<FilterId>('all');
  const [view, setView] = useState<ViewId>('board');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [weekDraft, setWeekDraft] = useState<Record<string, { happened: string; blocked: string; nextStep: string }>>({});

  const copy =
    loc === 'es'
      ? {
          title: 'Cartera',
          line: 'El técnico acompaña varios negocios: conversa, corrige el retrato, acepta la hipótesis, mueve 2 a 4 apuestas y anota la semana.',
          search: 'Buscar negocio…',
          empty: 'Todavía no hay negocios. Abrí un contrato AT para acompañar MIPYMEs.',
          contracts: 'Contratos AT',
          open: 'Abrir dossier',
          talkNow: 'Empezar conversación',
          bets: 'apuestas',
          week: 'Semana',
          board: 'Cartera',
          none: 'Sin nota',
          all: 'Todos',
          mine: 'Míos',
          talk: 'Conversación',
          portrait: 'Retrato',
          betsStage: 'Apuestas',
          rhythm: 'Ritmo',
          steady: 'En ritmo',
          need: 'piden atención',
          claim: 'Yo acompaño',
          happened: 'Qué pasó',
          blocked: 'Qué traba',
          next: 'Próximo paso',
          log: 'Anotar',
          hypo: 'Hipótesis',
          tech: 'Técnico',
        }
      : loc === 'en'
        ? {
            title: 'Portfolio',
            line: 'The technician accompanies several businesses: talk, correct the portrait, accept the hypothesis, move 2 to 4 bets, log the week.',
            search: 'Search a business…',
            empty: 'No businesses yet. Open an AT contract to accompany MSMEs.',
            contracts: 'AT contracts',
            open: 'Open dossier',
            talkNow: 'Start conversation',
            bets: 'bets',
            week: 'This week',
            board: 'Portfolio',
            none: 'No note',
            all: 'All',
            mine: 'Mine',
            talk: 'Conversation',
            portrait: 'Portrait',
            betsStage: 'Bets',
            rhythm: 'Rhythm',
            steady: 'On rhythm',
            need: 'need attention',
            claim: 'I accompany this',
            happened: 'What happened',
            blocked: 'What is stuck',
            next: 'Next step',
            log: 'Log',
            hypo: 'Hypothesis',
            tech: 'Technician',
          }
        : {
            title: 'Carteira',
            line: 'O técnico acompanha vários negócios: conversa, corrige o retrato, aceita a hipótese, move 2 a 4 apostas e anota a semana.',
            search: 'Pesquisar negócio…',
            empty: 'Ainda não há negócios. Abre um contrato AT para acompanhar MIPYMEs.',
            contracts: 'Contratos AT',
            open: 'Abrir dossiê',
            talkNow: 'Começar conversa',
            bets: 'apostas',
            week: 'Esta semana',
            board: 'Carteira',
            none: 'Sem nota',
            all: 'Todos',
            mine: 'Meus',
            talk: 'Conversa',
            portrait: 'Retrato',
            betsStage: 'Apostas',
            rhythm: 'Ritmo',
            steady: 'Em ritmo',
            need: 'pedem atenção',
            claim: 'Eu acompanho',
            happened: 'O que aconteceu',
            blocked: 'O que trava',
            next: 'Próximo passo',
            log: 'Anotar',
            hypo: 'Hipótese',
            tech: 'Técnico',
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
      const r = await fetch('/api/business-dossier/portfolio', { cache: 'no-store' });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Falha');
      const list = (d.businesses || []) as AuroraPortfolioItem[];
      setRows(list);
      setCounts(d.counts || { total: 0, needsAttention: 0, talk: 0, rhythm: 0 });
      setWeekDraft((prev) => {
        const next = { ...prev };
        for (const row of list) {
          if (!next[row.companyId]) next[row.companyId] = { happened: '', blocked: '', nextStep: '' };
        }
        return next;
      });
      setErr(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((row) => {
      if (filter === 'mine' && !row.mine) return false;
      if (filter !== 'all' && filter !== 'mine' && row.stage !== filter) return false;
      if (!needle) return true;
      return (
        row.name.toLowerCase().includes(needle) ||
        row.shortName.toLowerCase().includes(needle) ||
        row.engagementTitle.toLowerCase().includes(needle) ||
        row.technicianName.toLowerCase().includes(needle)
      );
    });
  }, [rows, q, filter]);

  const claim = async (row: AuroraPortfolioItem) => {
    setBusyId(row.companyId);
    try {
      const r = await fetch('/api/business-dossier/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId: row.companyId, engagementId: row.engagementId }),
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
      await fetch('/api/business-dossier/rhythm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId: row.companyId, engagementId: row.engagementId, ...draft }),
      });
      setWeekDraft((p) => ({ ...p, [row.companyId]: { happened: '', blocked: '', nextStep: '' } }));
      await load();
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-amber-700" />
      </div>
    );
  }

  const filters: { id: FilterId; label: string }[] = [
    { id: 'all', label: copy.all },
    { id: 'mine', label: copy.mine },
    { id: 'talk', label: copy.talk },
    { id: 'portrait', label: copy.portrait },
    { id: 'bets', label: copy.betsStage },
    { id: 'rhythm', label: copy.rhythm },
    { id: 'steady', label: copy.steady },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header>
        <h1 className="font-serif text-3xl text-slate-900">{copy.title}</h1>
        <p className="mt-1 text-sm text-slate-600">{copy.line}</p>
        <p className="mt-2 text-xs text-slate-500">
          {counts.total} · {counts.needsAttention} {copy.need}
          {counts.rhythm ? ` · ${counts.rhythm} ${copy.week.toLowerCase()}` : ''}
        </p>
      </header>

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
        <button
          type="button"
          onClick={() => setView('board')}
          className={`rounded-lg px-3 py-2 text-sm ${view === 'board' ? 'bg-amber-800 text-white' : 'border border-slate-200 bg-white'}`}
        >
          {copy.board}
        </button>
        <button
          type="button"
          onClick={() => setView('week')}
          className={`rounded-lg px-3 py-2 text-sm ${view === 'week' ? 'bg-amber-800 text-white' : 'border border-slate-200 bg-white'}`}
        >
          {copy.week}
        </button>
        <Link href="/hub/aurora/contratos" className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
          {copy.contracts}
        </Link>
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
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-10 text-center">
          <p className="text-sm text-slate-600">{copy.empty}</p>
          <Link href="/hub/aurora/contratos" className="mt-3 inline-block text-sm font-medium text-amber-900 hover:underline">
            {copy.contracts}
          </Link>
        </div>
      ) : view === 'week' ? (
        <ul className="space-y-4">
          {visible.map((row) => {
            const draft = weekDraft[row.companyId] || { happened: '', blocked: '', nextStep: '' };
            return (
              <li key={row.companyId} className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <Link href={dossierHref(row)} className="font-medium text-slate-900 hover:underline">
                      {row.name}
                    </Link>
                    <p className="text-xs text-slate-500">
                      {stageLabel[row.stage]}
                      {row.technicianName ? ` · ${row.technicianName}` : ''}
                    </p>
                  </div>
                  <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${row.stage === 'steady' ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-900'}`}>
                    {stageLabel[row.stage]}
                  </span>
                </div>
                {row.lastRhythmNext ? <p className="mt-2 text-sm text-slate-600">{row.lastRhythmHappened || row.lastRhythmNext}</p> : null}
                {row.betTitles.length > 0 ? (
                  <p className="mt-1 text-xs text-slate-500">{row.betTitles.join(' · ')}</p>
                ) : null}
                <div className="mt-3 grid gap-2 sm:grid-cols-3">
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
                    placeholder={copy.blocked}
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
                  className="mt-3 rounded-lg bg-amber-800 px-3 py-1.5 text-sm text-white disabled:opacity-40"
                >
                  {copy.log}
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <ul className="space-y-3">
          {visible.map((row) => (
            <li key={row.companyId} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-medium text-slate-900">{row.name}</p>
                  <p className="truncate text-xs text-slate-500">{row.engagementTitle}</p>
                </div>
                <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${row.stage === 'steady' ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-900'}`}>
                  {stageLabel[row.stage]}
                </span>
              </div>
              {row.portraitPreview ? <p className="mt-2 line-clamp-2 text-sm text-slate-600">{row.portraitPreview}</p> : null}
              {row.hypothesis ? (
                <p className="mt-1 text-xs text-slate-500">
                  {copy.hypo}: {row.hypothesis}
                </p>
              ) : null}
              {row.betTitles.length > 0 ? <p className="mt-1 text-xs text-slate-500">{row.betTitles.join(' · ')}</p> : null}
              <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                <span>
                  {row.openBetCount} {copy.bets}
                </span>
                <span>
                  {copy.week}: {row.lastRhythmNext || copy.none}
                </span>
                {row.technicianName ? (
                  <span>
                    {copy.tech}: {row.technicianName}
                  </span>
                ) : (
                  <button type="button" disabled={busyId === row.companyId} onClick={() => void claim(row)} className="text-amber-900 hover:underline">
                    {copy.claim}
                  </button>
                )}
                <Link href={dossierHref(row)} className="ml-auto font-medium text-amber-900 hover:underline">
                  {row.stage === 'talk' ? copy.talkNow : copy.open}
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
