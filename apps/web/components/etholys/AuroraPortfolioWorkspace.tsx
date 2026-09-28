'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Loader2, Search } from 'lucide-react';
import { useApp } from '@/app/providers';
import type { AuroraMethodStage, AuroraPortfolioItem } from '@/lib/aurora-portfolio';

type FilterId = 'all' | AuroraMethodStage;

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

  const copy =
    loc === 'es'
      ? {
          title: 'Cartera',
          line: 'Negocios que el técnico acompaña. Conversación, retrato, hipótesis, apuestas, ritmo de la semana.',
          search: 'Buscar negocio…',
          empty: 'Todavía no hay negocios en la cartera. Abrí un contrato AT para acompañar MIPYMEs.',
          contracts: 'Contratos AT',
          open: 'Abrir dossier',
          bets: 'apuestas',
          week: 'Semana',
          none: 'Sin nota',
          all: 'Todos',
          talk: 'Conversación',
          portrait: 'Retrato',
          betsStage: 'Apuestas',
          rhythm: 'Ritmo',
          steady: 'En ritmo',
          need: 'piden atención',
        }
      : loc === 'en'
        ? {
            title: 'Portfolio',
            line: 'Businesses the technician accompanies. Conversation, portrait, hypothesis, bets, weekly rhythm.',
            search: 'Search a business…',
            empty: 'No businesses in the portfolio yet. Open an AT contract to accompany MSMEs.',
            contracts: 'AT contracts',
            open: 'Open dossier',
            bets: 'bets',
            week: 'Week',
            none: 'No note',
            all: 'All',
            talk: 'Conversation',
            portrait: 'Portrait',
            betsStage: 'Bets',
            rhythm: 'Rhythm',
            steady: 'On rhythm',
            need: 'need attention',
          }
        : {
            title: 'Carteira',
            line: 'Negócios que o técnico acompanha. Conversa, retrato, hipótese, apostas, ritmo da semana.',
            search: 'Pesquisar negócio…',
            empty: 'Ainda não há negócios na carteira. Abre um contrato AT para acompanhar MIPYMEs.',
            contracts: 'Contratos AT',
            open: 'Abrir dossiê',
            bets: 'apostas',
            week: 'Semana',
            none: 'Sem nota',
            all: 'Todos',
            talk: 'Conversa',
            portrait: 'Retrato',
            betsStage: 'Apostas',
            rhythm: 'Ritmo',
            steady: 'Em ritmo',
            need: 'pedem atenção',
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
      setRows(d.businesses || []);
      setCounts(d.counts || { total: 0, needsAttention: 0, talk: 0, rhythm: 0 });
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
      if (filter !== 'all' && row.stage !== filter) return false;
      if (!needle) return true;
      return (
        row.name.toLowerCase().includes(needle) ||
        row.shortName.toLowerCase().includes(needle) ||
        row.engagementTitle.toLowerCase().includes(needle)
      );
    });
  }, [rows, q, filter]);

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-amber-700" />
      </div>
    );
  }

  const filters: { id: FilterId; label: string }[] = [
    { id: 'all', label: copy.all },
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
      ) : (
        <ul className="space-y-3">
          {visible.map((row) => (
            <li key={row.companyId}>
              <Link
                href={dossierHref(row)}
                className="block rounded-2xl border border-slate-200 bg-white p-4 shadow-sm hover:border-amber-300"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-slate-900">{row.name}</p>
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
                {row.portraitPreview ? (
                  <p className="mt-2 line-clamp-2 text-sm text-slate-600">{row.portraitPreview}</p>
                ) : null}
                <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-500">
                  <span>
                    {row.openBetCount} {copy.bets}
                  </span>
                  <span>
                    {copy.week}: {row.lastRhythmNext || copy.none}
                  </span>
                  <span className="text-amber-900">{copy.open}</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
