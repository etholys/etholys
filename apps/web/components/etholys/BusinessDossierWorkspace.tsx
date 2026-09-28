'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useApp } from '@/app/providers';
import { INTERVIEW_BEATS } from '@/lib/etholys-products';

type Mode = 'aurora' | 'polaris';
type Item = { text: string; evidence?: string };
type Bet = { id: string; title: string; why: string; indicator: string | null; status: string };
type Note = { id: string; happened: string; blocked: string; nextStep: string; createdAt: string };

export function BusinessDossierWorkspace({ mode }: { mode: Mode }) {
  const { locale, activeCompanyId } = useApp();
  const search = useSearchParams();
  const loc = locale === 'es' || locale === 'en' ? locale : 'pt';
  const companyId = search.get('company') || activeCompanyId || '';
  const engagementId = search.get('engagement');

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [portrait, setPortrait] = useState('');
  const [hypothesis, setHypothesis] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [gaps, setGaps] = useState<Item[]>([]);
  const [potentials, setPotentials] = useState<Item[]>([]);
  const [bets, setBets] = useState<Bet[]>([]);
  const [rhythm, setRhythm] = useState<Note[]>([]);
  const [beatIdx, setBeatIdx] = useState(0);
  const [interview, setInterview] = useState<Record<string, string>>({});
  const [betTitle, setBetTitle] = useState('');
  const [week, setWeek] = useState({ happened: '', blocked: '', nextStep: '' });

  const load = useCallback(async () => {
    if (!companyId) {
      setLoading(false);
      setErr(loc === 'es' ? 'Elegí una empresa.' : loc === 'en' ? 'Pick a company.' : 'Escolhe uma empresa.');
      return;
    }
    setLoading(true);
    try {
      const q = new URLSearchParams({ companyId });
      if (engagementId) q.set('engagementId', engagementId);
      const r = await fetch(`/api/business-dossier?${q}`);
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Falha');
      setPortrait(d.dossier?.portraitText || '');
      setHypothesis(d.dossier?.hypothesis || '');
      setAccepted(Boolean(d.dossier?.hypothesisAccepted));
      setGaps(d.dossier?.gaps || []);
      setPotentials(d.dossier?.potentials || []);
      setInterview((d.dossier?.interviewJson as Record<string, string>) || {});
      setBets(d.bets || []);
      setRhythm(d.rhythm || []);
      setErr(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro');
    } finally {
      setLoading(false);
    }
  }, [companyId, engagementId, loc]);

  useEffect(() => {
    void load();
  }, [load]);

  const saveDossier = async (extra?: Record<string, unknown>) => {
    setBusy(true);
    try {
      const r = await fetch('/api/business-dossier', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          engagementId,
          portraitText: portrait,
          hypothesis,
          hypothesisAccepted: accepted,
          gaps,
          potentials,
          ...extra,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Falha');
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro');
    } finally {
      setBusy(false);
    }
  };

  const finishInterview = async () => {
    setBusy(true);
    try {
      const r = await fetch('/api/business-dossier', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          engagementId,
          fromInterview: true,
          interview,
          locale: loc,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Falha');
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro');
    } finally {
      setBusy(false);
    }
  };

  const addBet = async () => {
    if (!betTitle.trim()) return;
    setBusy(true);
    try {
      const r = await fetch('/api/business-dossier/bets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, engagementId, title: betTitle }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Falha');
      setBetTitle('');
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro');
    } finally {
      setBusy(false);
    }
  };

  const setBetStatus = async (id: string, status: string) => {
    await fetch('/api/business-dossier/bets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyId, engagementId, id, status }),
    });
    await load();
  };

  const addRhythm = async () => {
    if (!week.happened.trim() && !week.nextStep.trim()) return;
    setBusy(true);
    try {
      await fetch('/api/business-dossier/rhythm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, engagementId, ...week }),
      });
      setWeek({ happened: '', blocked: '', nextStep: '' });
      await load();
    } finally {
      setBusy(false);
    }
  };

  const copy =
    loc === 'es'
      ? {
          title: mode === 'aurora' ? 'Dossier del negocio' : 'Mapa del negocio',
          line:
            mode === 'aurora'
              ? 'El técnico escucha, corrige el retrato y acepta la hipótesis. Sin eso no hay apuestas.'
              : 'Conversá, leé el retrato, aceptá la hipótesis y mové 2 a 4 apuestas.',
          talk: 'Conversación',
          portrait: 'Retrato',
          hypo: 'Hipótesis',
          accept: 'Aceptar hipótesis',
          gaps: 'Brechas (máx. 5)',
          pots: 'Potenciales (máx. 3)',
          bets: 'Apuestas',
          rhythm: 'Ritmo de la semana',
          save: 'Guardar retrato',
        }
      : loc === 'en'
        ? {
            title: mode === 'aurora' ? 'Business dossier' : 'Business map',
            line:
              mode === 'aurora'
                ? 'The technician listens, corrects the portrait and accepts the hypothesis. No bets without that.'
                : 'Talk, read the portrait, accept the hypothesis, and move 2 to 4 bets.',
            talk: 'Conversation',
            portrait: 'Portrait',
            hypo: 'Hypothesis',
            accept: 'Accept hypothesis',
            gaps: 'Gaps (max 5)',
            pots: 'Potentials (max 3)',
            bets: 'Bets',
            rhythm: 'This week',
            save: 'Save portrait',
          }
        : {
            title: mode === 'aurora' ? 'Dossiê do negócio' : 'Mapa do negócio',
            line:
              mode === 'aurora'
                ? 'O técnico escuta, corrige o retrato e aceita a hipótese. Sem isso não há apostas.'
                : 'Conversa, lê o retrato, aceita a hipótese e move 2 a 4 apostas.',
            talk: 'Conversa',
            portrait: 'Retrato',
            hypo: 'Hipótese',
            accept: 'Aceitar hipótese',
            gaps: 'Brechas (máx. 5)',
            pots: 'Potenciais (máx. 3)',
            bets: 'Apostas',
            rhythm: 'Ritmo da semana',
            save: 'Guardar retrato',
          };

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-teal-700" />
      </div>
    );
  }

  const beat = INTERVIEW_BEATS[beatIdx];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header>
        <h1 className="font-serif text-3xl text-slate-900">{copy.title}</h1>
        <p className="mt-1 text-sm text-slate-600">{copy.line}</p>
      </header>
      {err && <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{err}</p>}

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{copy.talk}</p>
        <p className="mt-2 text-sm font-medium text-slate-900">{beat[loc]}</p>
        <textarea
          value={interview[beat.id] || ''}
          onChange={(e) => setInterview((p) => ({ ...p, [beat.id]: e.target.value }))}
          rows={3}
          className="mt-3 w-full rounded-lg border px-3 py-2 text-sm"
        />
        <div className="mt-3 flex justify-between">
          <button type="button" disabled={beatIdx === 0} onClick={() => setBeatIdx((i) => i - 1)} className="text-sm text-slate-600">
            {loc === 'en' ? 'Back' : 'Atrás'}
          </button>
          {beatIdx < INTERVIEW_BEATS.length - 1 ? (
            <button type="button" onClick={() => setBeatIdx((i) => i + 1)} className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm text-white">
              {loc === 'en' ? 'Next' : 'Seguinte'}
            </button>
          ) : (
            <button type="button" disabled={busy} onClick={() => void finishInterview()} className="rounded-lg bg-teal-800 px-3 py-1.5 text-sm text-white">
              {loc === 'es' ? 'Armar retrato' : loc === 'en' ? 'Build portrait' : 'Montar retrato'}
            </button>
          )}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{copy.portrait}</p>
          <textarea value={portrait} onChange={(e) => setPortrait(e.target.value)} rows={8} className="mt-2 w-full rounded-lg border px-3 py-2 text-sm" />
          <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-400">{copy.hypo}</p>
          <textarea value={hypothesis} onChange={(e) => setHypothesis(e.target.value)} rows={3} className="mt-2 w-full rounded-lg border px-3 py-2 text-sm" />
          <label className="mt-3 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} />
            {copy.accept}
          </label>
          <button type="button" disabled={busy} onClick={() => void saveDossier()} className="mt-3 rounded-lg bg-[#0c1222] px-3 py-2 text-sm text-white">
            {copy.save}
          </button>
        </div>
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{copy.gaps}</p>
            {gaps.map((g, i) => (
              <input
                key={`g${i}`}
                value={g.text}
                onChange={(e) => setGaps((p) => p.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))}
                className="mt-2 w-full rounded-lg border px-3 py-1.5 text-sm"
              />
            ))}
            {gaps.length < 5 && (
              <button type="button" className="mt-2 text-xs text-teal-800" onClick={() => setGaps((p) => [...p, { text: '' }])}>
                +
              </button>
            )}
            <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-400">{copy.pots}</p>
            {potentials.map((g, i) => (
              <input
                key={`p${i}`}
                value={g.text}
                onChange={(e) => setPotentials((p) => p.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))}
                className="mt-2 w-full rounded-lg border px-3 py-1.5 text-sm"
              />
            ))}
            {potentials.length < 3 && (
              <button type="button" className="mt-2 text-xs text-teal-800" onClick={() => setPotentials((p) => [...p, { text: '' }])}>
                +
              </button>
            )}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{copy.bets}</p>
        {!accepted && (
          <p className="mt-2 text-xs text-amber-800">
            {loc === 'es'
              ? 'Aceptá la hipótesis antes de tratar las apuestas como plan.'
              : loc === 'en'
                ? 'Accept the hypothesis before treating bets as the plan.'
                : 'Aceita a hipótese antes de tratar as apostas como plano.'}
          </p>
        )}
        <div className="mt-3 flex gap-2">
          <input value={betTitle} onChange={(e) => setBetTitle(e.target.value)} className="flex-1 rounded-lg border px-3 py-2 text-sm" />
          <button type="button" disabled={busy || !accepted} onClick={() => void addBet()} className="rounded-lg bg-slate-900 px-3 text-sm text-white disabled:opacity-40">
            OK
          </button>
        </div>
        <ul className="mt-3 space-y-2">
          {bets.map((b) => (
            <li key={b.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
              <span>{b.title}</span>
              <select value={b.status} onChange={(e) => void setBetStatus(b.id, e.target.value)} className="text-xs">
                <option value="proposed">proposta</option>
                <option value="accepted">aceite</option>
                <option value="active">ativa</option>
                <option value="done">feita</option>
                <option value="dropped">larga</option>
              </select>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{copy.rhythm}</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <textarea value={week.happened} onChange={(e) => setWeek((w) => ({ ...w, happened: e.target.value }))} placeholder={loc === 'es' ? 'Qué pasó' : 'O que aconteceu'} rows={2} className="rounded-lg border px-3 py-2 text-sm" />
          <textarea value={week.blocked} onChange={(e) => setWeek((w) => ({ ...w, blocked: e.target.value }))} placeholder={loc === 'es' ? 'Qué traba' : 'O que trava'} rows={2} className="rounded-lg border px-3 py-2 text-sm" />
          <textarea value={week.nextStep} onChange={(e) => setWeek((w) => ({ ...w, nextStep: e.target.value }))} placeholder={loc === 'es' ? 'Próximo paso' : 'Próximo passo'} rows={2} className="rounded-lg border px-3 py-2 text-sm" />
        </div>
        <button type="button" disabled={busy} onClick={() => void addRhythm()} className="mt-3 rounded-lg border px-3 py-1.5 text-sm">
          {loc === 'es' ? 'Anotar semana' : loc === 'en' ? 'Log week' : 'Anotar semana'}
        </button>
        <ol className="mt-3 space-y-2 text-sm text-slate-700">
          {rhythm.map((n) => (
            <li key={n.id} className="rounded-lg bg-slate-50 px-3 py-2">
              {n.happened || n.nextStep}
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
