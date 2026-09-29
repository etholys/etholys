'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useApp } from '@/app/providers';
import {
  auroraOpening,
  looksLikeCatalogScore,
  readAuroraDraft,
  readAuroraSuggestions,
  readAuroraTech,
  readAuroraThread,
  type AuroraBetDraft,
  type AuroraDraft,
  type AuroraGap,
  type AuroraMessage,
  type AuroraTech,
} from '@/lib/aurora-interview';
import { auroraMethodStage } from '@/lib/aurora-portfolio';
import { auroraNextAction } from '@/lib/aurora-week';
import { AuroraMethodRail } from '@/components/etholys/AuroraMethodRail';

type Bet = {
  id: string;
  title: string;
  why: string;
  indicator: string | null;
  status: string;
  dueAt?: string | null;
  ownerLabel?: string | null;
};
type Note = { id: string; happened: string; blocked: string; nextStep: string; createdAt: string };

export function AuroraDossierWorkspace() {
  const { locale, activeCompanyId } = useApp();
  const search = useSearchParams();
  const loc = locale === 'es' || locale === 'en' ? locale : 'pt';
  const companyId = search.get('company') || activeCompanyId || '';
  const engagementId = search.get('engagement');
  const scroller = useRef<HTMLDivElement>(null);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState('');
  const [portrait, setPortrait] = useState('');
  const [hypothesis, setHypothesis] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [gaps, setGaps] = useState<AuroraGap[]>([]);
  const [potentials, setPotentials] = useState<AuroraGap[]>([]);
  const [bets, setBets] = useState<Bet[]>([]);
  const [rhythm, setRhythm] = useState<Note[]>([]);
  const [thread, setThread] = useState<AuroraMessage[]>([]);
  const [draft, setDraft] = useState<AuroraDraft | null>(null);
  const [suggestions, setSuggestions] = useState<AuroraBetDraft[]>([]);
  const [tech, setTech] = useState<AuroraTech | null>(null);
  const [talk, setTalk] = useState('');
  const [week, setWeek] = useState({ happened: '', blocked: '', nextStep: '' });
  const [betForm, setBetForm] = useState({ title: '', why: '', indicator: '', dueWeek: true });

  const applyPayload = (d: Record<string, unknown>) => {
    const wrapped = d.dossier as
      | {
          portraitText?: string;
          hypothesis?: string;
          hypothesisAccepted?: boolean;
          gaps?: AuroraGap[];
          potentials?: AuroraGap[];
          interviewJson?: unknown;
        }
      | null
      | undefined;
    const rawPortrait = String(wrapped?.portraitText ?? d.portraitText ?? '');
    const catalog = looksLikeCatalogScore(rawPortrait);
    setPortrait(catalog ? '' : rawPortrait);
    setHypothesis(catalog ? '' : String(wrapped?.hypothesis ?? d.hypothesis ?? ''));
    setAccepted(Boolean(wrapped?.hypothesisAccepted ?? d.hypothesisAccepted));
    setGaps(((wrapped?.gaps as AuroraGap[]) || (d.gaps as AuroraGap[]) || []).slice(0, 5));
    setPotentials(((wrapped?.potentials as AuroraGap[]) || (d.potentials as AuroraGap[]) || []).slice(0, 3));
    setThread(Array.isArray(d.messages) ? (d.messages as AuroraMessage[]) : readAuroraThread(wrapped?.interviewJson));
    setDraft((d.draft as AuroraDraft) || readAuroraDraft(wrapped?.interviewJson));
    setSuggestions(
      Array.isArray(d.suggestions) ? (d.suggestions as AuroraBetDraft[]) : readAuroraSuggestions(wrapped?.interviewJson),
    );
    setTech((d.tech as AuroraTech) || readAuroraTech(wrapped?.interviewJson));
    setBets((d.bets as Bet[]) || []);
    setRhythm((d.rhythm as Note[]) || []);
    if (typeof d.companyName === 'string' && d.companyName) setCompanyName(d.companyName);
  };

  const load = useCallback(
    async (quiet = false) => {
      if (!companyId) {
        setLoading(false);
        setErr(loc === 'es' ? 'Elegí un negocio de la cartera.' : loc === 'en' ? 'Pick a business from the portfolio.' : 'Escolhe um negócio da carteira.');
        return;
      }
      if (!quiet) setLoading(true);
      try {
        const q = new URLSearchParams({ companyId, locale: loc });
        if (engagementId) q.set('engagementId', engagementId);
        const r = await fetch(`/api/business-dossier/interview?${q}`, { cache: 'no-store' });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || 'Falha');
        applyPayload(d);
        setErr(null);
      } catch (e) {
        setErr(e instanceof Error ? e.message : 'Erro');
      } finally {
        if (!quiet) setLoading(false);
      }
    },
    [companyId, engagementId, loc],
  );

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [thread, busy]);

  const sendTurn = async () => {
    const message = talk.trim();
    if (!message || busy) return;
    const prev = thread;
    setBusy(true);
    setTalk('');
    setThread([...prev, { role: 'user', text: message }]);
    try {
      const r = await fetch('/api/business-dossier/interview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          engagementId,
          message,
          locale: loc,
          portraitText: portrait,
          hypothesis,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Falha');
      applyPayload(d);
      setErr(null);
    } catch (e) {
      setThread(prev);
      setTalk(message);
      setErr(e instanceof Error ? e.message : 'Erro');
    } finally {
      setBusy(false);
    }
  };

  const applyDraft = async () => {
    if (!draft?.portraitText || busy) return;
    setBusy(true);
    try {
      const r = await fetch('/api/business-dossier/interview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, engagementId, apply: true }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Falha');
      applyPayload(d);
      await load(true);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro');
    } finally {
      setBusy(false);
    }
  };

  const savePortrait = async (accept = false) => {
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
          hypothesisAccepted: accept ? true : accepted,
          gaps,
          potentials,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Falha');
      if (accept) {
        const m = await fetch('/api/business-dossier/interview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ companyId, engagementId, materialize: true }),
        });
        const md = await m.json();
        if (!m.ok) throw new Error(md.error || 'Falha');
        applyPayload(md.bets ? md : d);
      }
      await load(true);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro');
    } finally {
      setBusy(false);
    }
  };

  const claim = async (release = false) => {
    setBusy(true);
    try {
      const r = await fetch('/api/business-dossier/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, engagementId, release }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Falha');
      setTech(release ? null : d.tech || null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro');
    } finally {
      setBusy(false);
    }
  };

  const addBet = async () => {
    if (!betForm.title.trim() || !accepted) return;
    setBusy(true);
    try {
      const r = await fetch('/api/business-dossier/bets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          engagementId,
          title: betForm.title,
          why: betForm.why,
          indicator: betForm.indicator,
          ownerLabel: tech?.name || undefined,
          dueAt: betForm.dueWeek ? 'week' : undefined,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Falha');
      setBetForm({ title: '', why: '', indicator: '', dueWeek: true });
      await load(true);
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
    await load(true);
  };

  const setBetDueWeek = async (id: string) => {
    await fetch('/api/business-dossier/bets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyId, engagementId, id, dueAt: 'week' }),
    });
    await load(true);
  };

  const adoptBet = async (bet: AuroraBetDraft) => {
    if (!accepted || busy) return;
    setBusy(true);
    try {
      const r = await fetch('/api/business-dossier/interview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, engagementId, adoptBet: bet }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Falha');
      applyPayload(d);
      await load(true);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro');
    } finally {
      setBusy(false);
    }
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
      await load(true);
    } finally {
      setBusy(false);
    }
  };

  const t =
    loc === 'es'
      ? {
          back: 'Cartera',
          listen: 'Conversación',
          hint: 'Pegá lo que dijeron. AURORA te da la próxima pregunta. Vos corregís el retrato, aceptás la hipótesis, abrís 2 a 4 apuestas y anotás la semana.',
          placeholder: 'Lo que acaban de decir, en sus palabras…',
          send: 'Enviar',
          draft: 'Rascunho de la conversa',
          use: 'Usar este retrato',
          portrait: 'Retrato',
          hypo: 'Hipótesis',
          accept: 'Aceptar hipótesis',
          accepted: 'Hipótesis aceptada',
          save: 'Guardar',
          gaps: 'Brechas (máx. 5)',
          pots: 'Potenciales (máx. 3)',
          bets: 'Apuestas (2–4)',
          why: 'Por qué',
          ind: 'Indicador',
          add: 'Abrir apuesta',
          adopt: 'Abrir esta',
          week: 'Esta semana',
          happened: 'Qué pasó',
          blocked: 'Qué traba',
          next: 'Próximo paso',
          log: 'Anotar semana',
          history: 'Semanas anteriores',
          claim: 'Yo acompaño',
          reclaim: 'Pasar a mí',
          release: 'Dejar de acompañar',
          claimed: 'Técnico',
          needAccept: 'Aceptá la hipótesis para tratar las apuestas como plan.',
          nextQ: 'Próxima pregunta',
          dueWeek: 'Vence esta semana',
          markWeek: 'Esta semana',
          ready: 'Ya se puede leer en voz alta.',
          talk: 'Conversación',
          portraitS: 'Retrato',
          betsS: 'Apuestas',
          rhythmS: 'Ritmo',
          steadyS: 'En ritmo',
          now: 'Ahora',
        }
      : loc === 'en'
        ? {
            back: 'Portfolio',
            listen: 'Conversation',
            hint: 'Paste what they said. AURORA gives the next question. You correct the portrait, accept the hypothesis, open 2 to 4 bets, log the week.',
            placeholder: 'What they just said, in their words…',
            send: 'Send',
            draft: 'Draft from the talk',
            use: 'Use this portrait',
            portrait: 'Portrait',
            hypo: 'Hypothesis',
            accept: 'Accept hypothesis',
            accepted: 'Hypothesis accepted',
            save: 'Save',
            gaps: 'Gaps (max 5)',
            pots: 'Potentials (max 3)',
            bets: 'Bets (2–4)',
            why: 'Why',
            ind: 'Indicator',
            add: 'Open bet',
            adopt: 'Open this',
            week: 'This week',
            happened: 'What happened',
            blocked: 'What is stuck',
            next: 'Next step',
            log: 'Log week',
            history: 'Earlier weeks',
            claim: 'I accompany this',
            reclaim: 'Take over',
            release: 'Stop accompanying',
            claimed: 'Technician',
            needAccept: 'Accept the hypothesis before treating bets as the plan.',
            nextQ: 'Next question',
            dueWeek: 'Due this week',
            markWeek: 'This week',
            ready: 'Ready to read aloud.',
            talk: 'Conversation',
            portraitS: 'Portrait',
            betsS: 'Bets',
            rhythmS: 'Rhythm',
            steadyS: 'On rhythm',
            now: 'Now',
          }
        : {
            back: 'Carteira',
            listen: 'Conversa',
            hint: 'Cola o que disseram. O AURORA dá-te a próxima pergunta. Tu corrijes o retrato, aceitas a hipótese, abres 2 a 4 apostas e anotas a semana.',
            placeholder: 'O que acabaram de dizer, nas palavras deles…',
            send: 'Enviar',
            draft: 'Rascunho da conversa',
            use: 'Usar este retrato',
            portrait: 'Retrato',
            hypo: 'Hipótese',
            accept: 'Aceitar hipótese',
            accepted: 'Hipótese aceite',
            save: 'Guardar',
            gaps: 'Brechas (máx. 5)',
            pots: 'Potenciais (máx. 3)',
            bets: 'Apostas (2–4)',
            why: 'Porquê',
            ind: 'Indicador',
            add: 'Abrir aposta',
            adopt: 'Abrir esta',
            week: 'Esta semana',
            happened: 'O que aconteceu',
            blocked: 'O que trava',
            next: 'Próximo passo',
            log: 'Anotar semana',
            history: 'Semanas anteriores',
            claim: 'Eu acompanho',
            reclaim: 'Passar para mim',
            release: 'Deixar de acompanhar',
            claimed: 'Técnico',
            needAccept: 'Aceita a hipótese antes de tratar as apostas como plano.',
            nextQ: 'Próxima pergunta',
            dueWeek: 'Vence esta semana',
            markWeek: 'Esta semana',
            ready: 'Já se pode ler em voz alta.',
            talk: 'Conversa',
            portraitS: 'Retrato',
            betsS: 'Apostas',
            rhythmS: 'Ritmo',
            steadyS: 'Em ritmo',
            now: 'Agora',
          };

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-amber-700" />
      </div>
    );
  }

  const shown = thread.length ? thread : [{ role: 'assistant' as const, text: auroraOpening(loc) }];
  const openBets = bets.filter((b) => b.status !== 'done' && b.status !== 'dropped');
  const lastWeek = rhythm[0];
  const showDraft = Boolean(draft?.portraitText && draft.portraitText !== portrait);
  const stage = auroraMethodStage({
    hasPortrait: Boolean(portrait.trim()),
    hypothesisAccepted: accepted,
    openBetCount: openBets.length,
    lastRhythmAt: lastWeek?.createdAt ?? null,
  });
  const nextQuestion = [...shown].reverse().find((m) => m.role === 'assistant')?.text || '';
  const pendingSuggestions = suggestions.filter(
    (s) => !openBets.some((b) => b.title.trim().toLowerCase() === s.title.trim().toLowerCase()),
  );
  const stageLabel = {
    talk: t.talk,
    portrait: t.portraitS,
    bets: t.betsS,
    rhythm: t.rhythmS,
    steady: t.steadyS,
  };
  const nowLine = auroraNextAction(
    {
      companyId,
      name: companyName,
      shortName: companyName,
      engagementId: engagementId || '',
      engagementTitle: '',
      hasPortrait: Boolean(portrait.trim()),
      hypothesisAccepted: accepted,
      hypothesis,
      openBetCount: openBets.length,
      betTitles: openBets.map((b) => b.title),
      lastRhythmAt: lastWeek?.createdAt ?? null,
      lastRhythmHappened: lastWeek?.happened || '',
      lastRhythmBlocked: lastWeek?.blocked || '',
      lastRhythmNext: lastWeek?.nextStep || '',
      portraitPreview: portrait.slice(0, 180),
      technicianName: tech?.name || '',
      technicianUserId: tech?.userId || '',
      mine: true,
      stage,
      dueBetTitles: [],
    },
    loc,
  );

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-2">
          <Link href="/hub/aurora" className="text-xs text-slate-500 hover:text-slate-800">
            ← {t.back}
          </Link>
          {companyId ? (
            <Link
              href={`/hub/aurora/diagnostico?${new URLSearchParams({
                company: companyId,
                ...(engagementId ? { engagement: engagementId } : {}),
              })}`}
              className="ml-3 text-xs font-medium text-amber-900 hover:underline"
            >
              {loc === 'es' ? 'Diagnóstico' : loc === 'en' ? 'Diagnostic' : 'Diagnóstico'}
            </Link>
          ) : null}
          <h1 className="font-serif text-3xl text-slate-900">{companyName || t.listen}</h1>
          <p className="max-w-2xl text-sm text-slate-600">{t.hint}</p>
          <AuroraMethodRail stage={stage} labels={stageLabel} />
          <p className="text-sm font-medium text-amber-950">
            {t.now}: {nowLine}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          {tech?.name ? (
            <>
              <span className="rounded-full bg-amber-50 px-3 py-1 text-amber-900">
                {t.claimed}: {tech.name}
              </span>
              <button type="button" disabled={busy} onClick={() => void claim(true)} className="text-xs text-slate-500 hover:underline">
                {t.release}
              </button>
            </>
          ) : (
            <button type="button" disabled={busy} onClick={() => void claim()} className="rounded-lg bg-amber-800 px-3 py-1.5 text-white">
              {t.claim}
            </button>
          )}
        </div>
      </div>

      {err && <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{err}</p>}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <section className="flex min-h-[62vh] flex-col rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{t.listen}</p>
          {nextQuestion ? (
            <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-800">{t.nextQ}</p>
              <p className="mt-1 text-sm text-slate-900">{nextQuestion}</p>
            </div>
          ) : null}
          <div ref={scroller} className="mt-3 flex-1 space-y-3 overflow-y-auto pr-1">
            {shown.map((m, i) => (
              <div key={`${m.role}${i}`} className={m.role === 'assistant' ? 'text-sm text-slate-800' : 'rounded-lg bg-amber-50 px-3 py-2 text-sm text-slate-900'}>
                {m.text}
              </div>
            ))}
            {busy && <Loader2 className="h-4 w-4 animate-spin text-amber-700" />}
          </div>
          <textarea
            value={talk}
            onChange={(e) => setTalk(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void sendTurn();
              }
            }}
            placeholder={t.placeholder}
            rows={3}
            className="mt-3 w-full rounded-lg border px-3 py-2 text-sm"
          />
          <button type="button" disabled={busy || !talk.trim()} onClick={() => void sendTurn()} className="mt-2 self-end rounded-lg bg-amber-800 px-4 py-2 text-sm text-white disabled:opacity-40">
            {t.send}
          </button>
        </section>

        <div className="space-y-4">
          {showDraft && (
            <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">{t.draft}</p>
              {draft?.ready ? <p className="mt-1 text-xs font-medium text-emerald-800">{t.ready}</p> : null}
              <p className="mt-2 whitespace-pre-wrap text-sm text-slate-800">{draft?.portraitText}</p>
              {draft?.hypothesis ? <p className="mt-2 text-sm font-medium text-slate-900">{draft.hypothesis}</p> : null}
              <button type="button" disabled={busy} onClick={() => void applyDraft()} className="mt-3 rounded-lg bg-amber-800 px-3 py-1.5 text-sm text-white">
                {t.use}
              </button>
            </section>
          )}

          <section className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{t.portrait}</p>
            <textarea value={portrait} onChange={(e) => setPortrait(e.target.value)} rows={7} className="mt-2 w-full rounded-lg border px-3 py-2 text-sm" />
            <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-400">{t.hypo}</p>
            <textarea value={hypothesis} onChange={(e) => setHypothesis(e.target.value)} rows={2} className="mt-2 w-full rounded-lg border px-3 py-2 text-sm" />
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" disabled={busy} onClick={() => void savePortrait(false)} className="rounded-lg border px-3 py-1.5 text-sm">
                {t.save}
              </button>
              {accepted ? (
                <span className="rounded-lg bg-emerald-50 px-3 py-1.5 text-sm text-emerald-800">{t.accepted}</span>
              ) : (
                <button
                  type="button"
                  disabled={busy || !hypothesis.trim()}
                  onClick={() => void savePortrait(true)}
                  className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm text-white disabled:opacity-40"
                >
                  {t.accept}
                </button>
              )}
            </div>
            <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-400">{t.gaps}</p>
            {gaps.map((g, i) => (
              <div key={`g${i}`} className="mt-2">
                <input
                  value={g.text}
                  onChange={(e) => setGaps((p) => p.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))}
                  className="w-full rounded-lg border px-3 py-1.5 text-sm"
                />
                {g.evidence ? <p className="mt-0.5 text-[11px] text-slate-500">{g.evidence}</p> : null}
              </div>
            ))}
            {gaps.length < 5 && (
              <button type="button" className="mt-2 text-xs text-amber-900" onClick={() => setGaps((p) => [...p, { text: '' }])}>
                +
              </button>
            )}
            <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-400">{t.pots}</p>
            {potentials.map((g, i) => (
              <div key={`p${i}`} className="mt-2">
                <input
                  value={g.text}
                  onChange={(e) => setPotentials((p) => p.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))}
                  className="w-full rounded-lg border px-3 py-1.5 text-sm"
                />
                {g.evidence ? <p className="mt-0.5 text-[11px] text-slate-500">{g.evidence}</p> : null}
              </div>
            ))}
            {potentials.length < 3 && (
              <button type="button" className="mt-2 text-xs text-amber-900" onClick={() => setPotentials((p) => [...p, { text: '' }])}>
                +
              </button>
            )}
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{t.bets}</p>
            {!accepted && <p className="mt-2 text-xs text-amber-800">{t.needAccept}</p>}
            {openBets.map((b) => (
              <div key={b.id} className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-sm">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{b.title}</p>
                    {b.why ? <p className="text-xs text-slate-500">{b.why}</p> : null}
                    {b.indicator ? <p className="text-xs text-slate-500">{b.indicator}</p> : null}
                    {b.dueAt ? (
                      <p className="text-[11px] text-amber-900">{t.dueWeek}</p>
                    ) : (
                      <button type="button" className="text-[11px] text-amber-900 hover:underline" onClick={() => void setBetDueWeek(b.id)}>
                        {t.markWeek}
                      </button>
                    )}
                  </div>
                  <select value={b.status} onChange={(e) => void setBetStatus(b.id, e.target.value)} className="text-xs">
                    <option value="proposed">proposta</option>
                    <option value="accepted">aceite</option>
                    <option value="active">ativa</option>
                    <option value="done">feita</option>
                    <option value="dropped">larga</option>
                  </select>
                </div>
              </div>
            ))}
            {accepted && pendingSuggestions.length > 0 && openBets.length < 4 && (
              <ul className="mt-3 space-y-2">
                {pendingSuggestions.map((s) => (
                  <li key={s.title} className="rounded-lg border border-dashed border-slate-200 px-3 py-2 text-xs">
                    <p className="font-medium text-slate-800">{s.title}</p>
                    {s.why ? <p className="text-slate-500">{s.why}</p> : null}
                    {s.indicator ? <p className="text-slate-500">{s.indicator}</p> : null}
                    <button type="button" disabled={busy} onClick={() => void adoptBet(s)} className="mt-1 text-amber-900 hover:underline">
                      {t.adopt}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {accepted && openBets.length < 4 && (
              <div className="mt-3 space-y-2">
                <input value={betForm.title} onChange={(e) => setBetForm((f) => ({ ...f, title: e.target.value }))} placeholder={t.bets} className="w-full rounded-lg border px-3 py-1.5 text-sm" />
                <input value={betForm.why} onChange={(e) => setBetForm((f) => ({ ...f, why: e.target.value }))} placeholder={t.why} className="w-full rounded-lg border px-3 py-1.5 text-sm" />
                <input value={betForm.indicator} onChange={(e) => setBetForm((f) => ({ ...f, indicator: e.target.value }))} placeholder={t.ind} className="w-full rounded-lg border px-3 py-1.5 text-sm" />
                <label className="flex items-center gap-2 text-xs text-slate-600">
                  <input type="checkbox" checked={betForm.dueWeek} onChange={(e) => setBetForm((f) => ({ ...f, dueWeek: e.target.checked }))} />
                  {t.dueWeek}
                </label>
                <button type="button" disabled={busy} onClick={() => void addBet()} className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm text-white">
                  {t.add}
                </button>
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{t.week}</p>
            {lastWeek ? (
              <p className="mt-2 text-sm text-slate-600">
                {lastWeek.happened || lastWeek.nextStep}
                {lastWeek.blocked ? ` · ${lastWeek.blocked}` : ''}
              </p>
            ) : null}
            <div className="mt-3 grid gap-2">
              <textarea value={week.happened} onChange={(e) => setWeek((w) => ({ ...w, happened: e.target.value }))} placeholder={t.happened} rows={2} className="rounded-lg border px-3 py-2 text-sm" />
              <textarea value={week.blocked} onChange={(e) => setWeek((w) => ({ ...w, blocked: e.target.value }))} placeholder={t.blocked} rows={2} className="rounded-lg border px-3 py-2 text-sm" />
              <textarea value={week.nextStep} onChange={(e) => setWeek((w) => ({ ...w, nextStep: e.target.value }))} placeholder={t.next} rows={2} className="rounded-lg border px-3 py-2 text-sm" />
            </div>
            <button type="button" disabled={busy} onClick={() => void addRhythm()} className="mt-3 rounded-lg border px-3 py-1.5 text-sm">
              {t.log}
            </button>
            {rhythm.length > 1 ? (
              <div className="mt-4 space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{t.history}</p>
                {rhythm.slice(1, 6).map((n) => (
                  <div key={n.id} className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
                    <p className="text-[11px] text-slate-400">{new Date(n.createdAt).toLocaleDateString(loc === 'en' ? 'en' : loc === 'es' ? 'es' : 'pt')}</p>
                    <p>{n.happened || n.nextStep}</p>
                    {n.blocked ? <p className="text-rose-700">{n.blocked}</p> : null}
                    {n.nextStep && n.happened ? <p>{n.nextStep}</p> : null}
                  </div>
                ))}
              </div>
            ) : null}
          </section>
        </div>
      </div>
    </div>
  );
}
