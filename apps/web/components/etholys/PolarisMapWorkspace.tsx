'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useApp } from '@/app/providers';
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
  const search = useSearchParams();
  const loc = locale === 'es' || locale === 'en' ? locale : 'pt';
  const companyId = search.get('company') || activeCompanyId || '';
  const engagementId = search.get('engagement');
  const scroller = useRef<HTMLDivElement>(null);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
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

  const load = useCallback(
    async (quiet = false) => {
      if (!companyId) {
        setLoading(false);
        setErr(loc === 'es' ? 'Elegí una empresa.' : loc === 'en' ? 'Pick a company.' : 'Escolhe uma empresa.');
        return;
      }
      if (!quiet) setLoading(true);
      try {
        const q = new URLSearchParams({ companyId, skipHydrate: '1' });
        if (engagementId) q.set('engagementId', engagementId);
        const r = await fetch(`/api/business-dossier?${q}`);
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || 'Falha');
        applyDossier(d);
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
          placeholder: 'Una frase. Lo de esta semana.',
          empty: 'No hay formulario. Decí lo que está vivo — el mapa se escribe solo.',
          thatsIt: 'Es esto',
          keep: 'Esta semana',
          log: 'Anotar',
          active: 'en curso',
          done: 'hecha',
        }
      : loc === 'en'
        ? {
            send: 'Send',
            placeholder: 'One sentence. This week.',
            empty: 'There is no form. Say what is alive — the map writes itself.',
            thatsIt: "That's it",
            keep: 'This week',
            log: 'Log it',
            active: 'on',
            done: 'done',
          }
        : {
            send: 'Enviar',
            placeholder: 'Uma frase. O desta semana.',
            empty: 'Não há formulário. Diz o que está vivo — o mapa escreve-se.',
            thatsIt: 'É isto',
            keep: 'Esta semana',
            log: 'Anotar',
            active: 'a andar',
            done: 'feita',
          };

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-teal-700" />
      </div>
    );
  }

  return (
    <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
      <section className="flex min-h-[70vh] flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div ref={scroller} className="flex-1 space-y-3 overflow-y-auto pr-1">
          {shown.map((m, i) => (
            <p
              key={`${m.role}-${i}`}
              className={
                m.role === 'assistant'
                  ? 'max-w-[92%] font-serif text-lg leading-snug text-slate-900'
                  : 'ml-auto max-w-[80%] rounded-2xl bg-slate-100 px-4 py-2 text-sm text-slate-800'
              }
            >
              {m.text}
            </p>
          ))}
          {busy && <p className="text-sm text-slate-400">…</p>}
        </div>
        {err && <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800">{err}</p>}
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
          className="mt-4 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
        />
        <div className="mt-2 flex justify-end">
          <button
            type="button"
            disabled={busy || !talk.trim()}
            onClick={() => void sendTurn()}
            className="rounded-lg bg-teal-800 px-4 py-2 text-sm text-white disabled:opacity-40"
          >
            {t.send}
          </button>
        </div>
      </section>

      <aside className="space-y-4">
        {!portrait ? (
          <p className="px-1 font-serif text-xl leading-snug text-slate-500">{t.empty}</p>
        ) : (
          <>
            <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="whitespace-pre-wrap font-serif text-base leading-relaxed text-slate-900">{portrait}</p>
              {hypothesis ? (
                <div className="mt-4 border-t border-slate-100 pt-4">
                  <p className="text-sm text-slate-700">{hypothesis}</p>
                  {!accepted ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void acceptHypothesis()}
                      className="mt-3 rounded-lg bg-slate-900 px-3 py-1.5 text-sm text-white"
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
                  <li key={s.title} className="rounded-xl border border-dashed border-slate-200 bg-white px-4 py-3 text-sm">
                    <p className="font-medium text-slate-900">{s.title}</p>
                    {s.indicator ? <p className="mt-1 text-xs text-slate-500">{s.indicator}</p> : null}
                  </li>
                ))}
                {liveBets.map((b) => (
                  <li key={b.id} className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm">
                    <p className="font-medium text-slate-900">{b.title}</p>
                    {b.why ? <p className="mt-1 text-xs text-slate-500">{b.why}</p> : null}
                    {accepted ? (
                      <div className="mt-2 flex gap-2">
                        {b.status !== 'done' ? (
                          <button type="button" className="text-xs text-teal-800" onClick={() => void setBetStatus(b.id, 'done')}>
                            {t.done}
                          </button>
                        ) : (
                          <span className="text-xs text-slate-400">{t.done}</span>
                        )}
                        {b.status !== 'active' && b.status !== 'done' ? (
                          <button type="button" className="text-xs text-slate-600" onClick={() => void setBetStatus(b.id, 'active')}>
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
              <div className="rounded-2xl bg-[#0c1222] p-4 text-white">
                <p className="text-xs uppercase tracking-wide text-white/40">{t.keep}</p>
                <p className="mt-2 font-serif text-lg leading-snug">
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
    </div>
  );
}
