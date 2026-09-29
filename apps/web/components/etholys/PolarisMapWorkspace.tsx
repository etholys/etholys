'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useApp } from '@/app/providers';
import { useEnsureActiveCompany } from '@/hooks/useEnsureActiveCompany';
import { PolarisBaselineWorkspace } from '@/components/etholys/PolarisBaselineWorkspace';
import {
  isCatalogPortrait,
  polarisOpening,
  readPolarisSuggestions,
  readPolarisThread,
  type PolarisBetDraft,
  type PolarisMessage,
} from '@/lib/polaris-map';

type Item = { text: string };
type Bet = { id: string; title: string; why: string; indicator: string | null; status: string };
type Note = { id: string; happened: string; blocked: string; nextStep: string; createdAt: string };

export function PolarisMapWorkspace() {
  const { locale, activeCompanyId } = useApp();
  const { companies } = useEnsureActiveCompany();
  const search = useSearchParams();
  const loc = locale === 'es' || locale === 'en' ? locale : 'pt';
  const companyId = search.get('company') || activeCompanyId || '';
  const companyName =
    companies.find((c) => c.id === companyId)?.name || companies.find((c) => c.id === companyId)?.shortName || '';
  const engagementId = search.get('engagement');
  const scroller = useRef<HTMLDivElement>(null);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [baselineReady, setBaselineReady] = useState<boolean | null>(null);
  const [baselineDone, setBaselineDone] = useState(0);
  const [baselineTotal, setBaselineTotal] = useState(6);
  const [portrait, setPortrait] = useState('');
  const [hypothesis, setHypothesis] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [gaps, setGaps] = useState<Item[]>([]);
  const [bets, setBets] = useState<Bet[]>([]);
  const [rhythm, setRhythm] = useState<Note[]>([]);
  const [thread, setThread] = useState<PolarisMessage[]>([]);
  const [suggestions, setSuggestions] = useState<PolarisBetDraft[]>([]);
  const [talk, setTalk] = useState('');
  const [weekHint, setWeekHint] = useState('');

  const applyDossier = (d: Record<string, unknown>) => {
    const wrapped = d.dossier as
      | {
          portraitText?: string;
          hypothesis?: string;
          hypothesisAccepted?: boolean;
          gaps?: Item[];
          interviewJson?: unknown;
        }
      | null
      | undefined;
    const rawPortrait = String(wrapped?.portraitText ?? d.portraitText ?? '');
    const catalog = isCatalogPortrait(rawPortrait);
    setPortrait(catalog ? '' : rawPortrait);
    setHypothesis(catalog ? '' : String(wrapped?.hypothesis ?? d.hypothesis ?? ''));
    setAccepted(catalog ? false : Boolean(wrapped?.hypothesisAccepted ?? d.hypothesisAccepted));
    setGaps(catalog ? [] : ((wrapped?.gaps as Item[]) || (d.gaps as Item[]) || []));
    setThread(Array.isArray(d.messages) ? (d.messages as PolarisMessage[]) : readPolarisThread(wrapped?.interviewJson));
    setSuggestions(
      Array.isArray(d.suggestions) ? (d.suggestions as PolarisBetDraft[]) : readPolarisSuggestions(wrapped?.interviewJson),
    );
    setBets((d.bets as Bet[]) || []);
    setRhythm((d.rhythm as Note[]) || []);
  };

  const loadBaseline = useCallback(async () => {
    if (!companyId) {
      setBaselineReady(false);
      return false;
    }
    try {
      const q = new URLSearchParams({ companyId });
      if (engagementId) q.set('engagementId', engagementId);
      const r = await fetch(`/api/business-dossier/diagnostic?${q}`, { cache: 'no-store' });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Falha');
      const done = Number(d.progress?.done || 0);
      const total = Number(d.progress?.total || 6);
      const complete = Boolean(d.progress?.complete);
      setBaselineDone(done);
      setBaselineTotal(total);
      setBaselineReady(complete);
      return complete;
    } catch {
      setBaselineReady(false);
      return false;
    }
  }, [companyId, engagementId]);

  const load = useCallback(
    async (quiet = false) => {
      if (!companyId) {
        setLoading(false);
        setErr(loc === 'es' ? 'Elegí una empresa.' : loc === 'en' ? 'Pick a company.' : 'Escolhe uma empresa.');
        return null;
      }
      if (!quiet) setLoading(true);
      try {
        const q = new URLSearchParams({ companyId });
        if (engagementId) q.set('engagementId', engagementId);
        const r = await fetch(`/api/business-dossier?${q}`);
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || 'Falha');
        applyDossier(d);
        setErr(null);
        return d as {
          messages?: PolarisMessage[];
          dossier?: { interviewJson?: unknown } | null;
        };
      } catch (e) {
        setErr(e instanceof Error ? e.message : 'Erro');
        return null;
      } finally {
        if (!quiet) setLoading(false);
      }
    },
    [companyId, engagementId, loc],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const ready = await loadBaseline();
      if (cancelled) return;
      if (!ready) {
        setLoading(false);
        return;
      }
      const d = await load();
      if (cancelled || !companyId) return;
      const existing = Array.isArray(d?.messages)
        ? d.messages
        : readPolarisThread(d?.dossier?.interviewJson);
      if (existing.length > 0) return;
      setBusy(true);
      try {
        const r = await fetch('/api/polaris/turn', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ companyId, engagementId, orient: true, locale: loc }),
        });
        const od = await r.json();
        if (!r.ok) throw new Error(od.error || 'Falha');
        if (cancelled) return;
        applyDossier(od);
        if (Array.isArray(od.messages)) setThread(od.messages);
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : 'Erro');
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [load, loadBaseline, companyId, engagementId, loc]);

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
      const r = await fetch('/api/polaris/turn', {
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
      applyDossier(d);
      if (Array.isArray(d.messages)) setThread(d.messages);
      const hint = d.rhythmSuggestion as { nextStep?: string; happened?: string } | null;
      if (hint?.nextStep) setWeekHint(hint.nextStep);
      else if (hint?.happened) setWeekHint(hint.happened);
      setErr(null);
    } catch (e) {
      setThread(prev);
      setTalk(message);
      setErr(e instanceof Error ? e.message : 'Erro');
    } finally {
      setBusy(false);
    }
  };

  const acceptHypothesis = async () => {
    if (!hypothesis.trim() || busy) return;
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
          hypothesisAccepted: true,
          gaps,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Falha');
      const mr = await fetch('/api/polaris/turn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, engagementId, materialize: true }),
      });
      const md = await mr.json();
      if (!mr.ok) throw new Error(md.error || 'Falha');
      applyDossier(md.bets ? md : d);
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

  const logWeek = async () => {
    const nextStep = weekHint.trim();
    if (!nextStep || busy) return;
    setBusy(true);
    try {
      await fetch('/api/business-dossier/rhythm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, engagementId, happened: '', blocked: '', nextStep }),
      });
      setWeekHint('');
      await load(true);
    } finally {
      setBusy(false);
    }
  };

  const shown = thread.length ? thread : [{ role: 'assistant' as const, text: polarisOpening(loc) }];
  const proposed = accepted ? [] : suggestions;
  const liveBets = bets.filter((b) => b.status !== 'dropped');
  const lastWeek = rhythm[0];

  const t =
    loc === 'es'
      ? {
          send: 'Enviar',
          placeholder: 'Corregí, completá o contá qué cambió.',
          kicker: 'Guía de autodesarrollo',
          thatsIt: 'Es esto',
          keep: 'Próximo paso',
          log: 'Anotar',
          active: 'en curso',
          done: 'hecha',
          needBaseline: 'Primero la línea base',
          needBaselineLine: `Faltan áreas de madurez (${baselineDone}/${baselineTotal}). Sin eso la IA del sistema no sabe de dónde partís.`,
          openBaseline: 'Construir línea base',
        }
      : loc === 'en'
        ? {
            send: 'Send',
            placeholder: 'Correct, complete, or say what changed.',
            kicker: 'Self-development guide',
            thatsIt: "That's it",
            keep: 'Next step',
            log: 'Log it',
            active: 'on',
            done: 'done',
            needBaseline: 'Baseline first',
            needBaselineLine: `Maturity areas still missing (${baselineDone}/${baselineTotal}). Without that the system AI has nowhere to start.`,
            openBaseline: 'Build baseline',
          }
        : {
            send: 'Enviar',
            placeholder: 'Corrige, completa ou conta o que mudou.',
            kicker: 'Guia de autodesenvolvimento',
            thatsIt: 'É isto',
            keep: 'Próximo passo',
            log: 'Anotar',
            active: 'a andar',
            done: 'feita',
            needBaseline: 'Primeiro a linha base',
            needBaselineLine: `Ainda faltam áreas de maturidade (${baselineDone}/${baselineTotal}). Sem isso a IA do sistema não sabe de onde partes.`,
            openBaseline: 'Construir linha base',
          };

  if (loading || baselineReady === null) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-teal-300" />
      </div>
    );
  }

  if (!baselineReady) {
    return (
      <div className="space-y-6">
        <div className="rounded-2xl border border-teal-300/30 bg-teal-400/10 px-4 py-3">
          <p className="text-sm font-semibold text-teal-50">{t.needBaseline}</p>
          <p className="mt-1 text-sm text-white/75">{t.needBaselineLine}</p>
          <Link
            href={`/hub/polaris/diagnosis?${new URLSearchParams({
              ...(companyId ? { company: companyId } : {}),
              ...(engagementId ? { engagement: engagementId } : {}),
            })}`}
            className="mt-2 inline-block text-sm text-teal-200 hover:underline"
          >
            {t.openBaseline}
          </Link>
        </div>
        <PolarisBaselineWorkspace embedded />
      </div>
    );
  }

  const openingOnly = thread.length === 0;
  const showMap = Boolean(portrait) || proposed.length > 0 || liveBets.length > 0;
  const firstIsOrient = shown.length === 1 && shown[0]?.role === 'assistant';

  return (
    <div className={`mx-auto grid max-w-3xl gap-8 ${showMap ? 'lg:max-w-6xl lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]' : ''}`}>
      <section className="flex flex-col">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-200/80">
          {companyName ? `${companyName} · ${t.kicker}` : t.kicker}
        </p>
        <div ref={scroller} className="mt-4 max-h-[46vh] space-y-4 overflow-y-auto pr-1">
          {shown.map((m, i) => (
            <p
              key={`${m.role}-${i}`}
              className={
                m.role === 'assistant'
                  ? firstIsOrient && i === 0
                    ? 'max-w-xl text-lg leading-relaxed text-white sm:text-xl'
                    : openingOnly
                      ? 'max-w-xl font-[family-name:var(--font-etholys-display)] text-2xl leading-tight text-white sm:text-3xl'
                      : 'max-w-[92%] text-lg leading-snug text-white'
                  : 'ml-auto max-w-[80%] rounded-2xl bg-white/10 px-4 py-2 text-sm text-white'
              }
            >
              {m.text}
            </p>
          ))}
          {busy && <p className="text-sm text-teal-200/80">…</p>}
        </div>
        {err && <p className="mt-3 rounded-lg border border-rose-400/30 bg-rose-500/15 px-3 py-2 text-sm text-rose-100">{err}</p>}
        <textarea
          value={talk}
          onChange={(e) => setTalk(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void sendTurn();
            }
          }}
          rows={3}
          placeholder={t.placeholder}
          className="mt-6 w-full rounded-xl border border-white/25 bg-white/10 px-4 py-3 text-base text-white outline-none ring-0 placeholder:text-white/45 focus:border-teal-300/60"
        />
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            disabled={busy || !talk.trim()}
            onClick={() => void sendTurn()}
            className="rounded-lg bg-teal-300 px-5 py-2 text-sm font-medium text-[#041018] disabled:opacity-50"
          >
            {t.send}
          </button>
        </div>
      </section>

      {showMap ? (
        <aside className="space-y-4 lg:pt-2">
          {!portrait ? null : (
            <>
              <article className="rounded-2xl border border-white/15 bg-white/[0.07] p-5">
                <p className="whitespace-pre-wrap text-base leading-relaxed text-white">{portrait}</p>
                {hypothesis ? (
                  <div className="mt-4 border-t border-white/10 pt-4">
                    <p className="text-sm text-white/80">{hypothesis}</p>
                    {!accepted ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void acceptHypothesis()}
                        className="mt-3 rounded-lg bg-teal-300 px-3 py-1.5 text-sm font-medium text-[#041018]"
                      >
                        {t.thatsIt}
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </article>

              {(proposed.length > 0 || liveBets.length > 0) && (
                <ul className="space-y-2">
                  {proposed.map((s) => (
                    <li key={s.title} className="rounded-xl border border-dashed border-white/20 bg-white/[0.04] px-4 py-3 text-sm">
                      <p className="font-medium text-white">{s.title}</p>
                      {s.indicator ? <p className="mt-1 text-xs text-white/50">{s.indicator}</p> : null}
                    </li>
                  ))}
                  {liveBets.map((b) => (
                    <li key={b.id} className="rounded-xl border border-white/15 bg-white/[0.07] px-4 py-3 text-sm">
                      <p className="font-medium text-white">{b.title}</p>
                      {b.why ? <p className="mt-1 text-xs text-white/50">{b.why}</p> : null}
                      {accepted ? (
                        <div className="mt-2 flex gap-3">
                          {b.status !== 'done' ? (
                            <button type="button" className="text-xs text-teal-200" onClick={() => void setBetStatus(b.id, 'done')}>
                              {t.done}
                            </button>
                          ) : (
                            <span className="text-xs text-white/40">{t.done}</span>
                          )}
                          {b.status !== 'active' && b.status !== 'done' ? (
                            <button type="button" className="text-xs text-white/60" onClick={() => void setBetStatus(b.id, 'active')}>
                              {t.active}
                            </button>
                          ) : null}
                        </div>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}

              {accepted && (
                <div className="rounded-2xl border border-teal-300/25 bg-teal-400/10 p-4">
                  <p className="text-xs uppercase tracking-wide text-teal-200/70">{t.keep}</p>
                  <p className="mt-2 text-lg leading-snug text-white">
                    {weekHint || lastWeek?.nextStep || lastWeek?.happened || gaps[0]?.text || hypothesis}
                  </p>
                  {weekHint ? (
                    <button type="button" disabled={busy} onClick={() => void logWeek()} className="mt-3 text-sm text-teal-200">
                      {t.log}
                    </button>
                  ) : null}
                </div>
              )}
            </>
          )}
        </aside>
      ) : null}
    </div>
  );
}
