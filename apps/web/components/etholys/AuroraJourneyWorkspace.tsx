'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useApp } from '@/app/providers';
import {
  AURORA_DIAG_BLOCKS,
  AURORA_MATURITY,
  emptyAuroraDiagnostic,
  type AuroraDiagBlockId,
  type AuroraDiagnosticState,
  type AuroraMaturity,
} from '@/lib/aurora-diagnostic';
import {
  AURORA_FLOW_PHASE_ORDER,
  auroraBetStatusLabel,
  auroraFlowPhaseLabels,
  nextAuroraBetStatuses,
  type AuroraFlowPhase,
  type AuroraRadiographyDoc,
  type AuroraRouteChatMessage,
  type AuroraValidationState,
} from '@/lib/aurora-flow';
import { AuroraFlowRail } from '@/components/etholys/AuroraFlowRail';

function levelTone(level: AuroraMaturity | null | undefined) {
  if (!level) return 'bg-slate-100 text-slate-500 border-slate-200';
  if (level <= 2) return 'bg-rose-50 text-rose-900 border-rose-200';
  if (level === 3) return 'bg-amber-50 text-amber-950 border-amber-200';
  return 'bg-emerald-50 text-emerald-900 border-emerald-200';
}

type BetRow = {
  id: string;
  title: string;
  status: string;
  why?: string;
  indicator?: string | null;
};

export function AuroraJourneyWorkspace() {
  const { locale } = useApp();
  const search = useSearchParams();
  const loc = locale === 'es' || locale === 'en' ? locale : 'pt';
  const companyId = String(search.get('company') || '').trim();
  const engagementId = String(search.get('engagement') || '').trim();
  const scroller = useRef<HTMLDivElement>(null);
  const chatScroller = useRef<HTMLDivElement>(null);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState('');
  const [phase, setPhase] = useState<AuroraFlowPhase>('diag');
  const [uiPhase, setUiPhase] = useState<AuroraFlowPhase>('diag');
  const [diagnostic, setDiagnostic] = useState<AuroraDiagnosticState>(emptyAuroraDiagnostic());
  const [progress, setProgress] = useState({ done: 0, total: 6, complete: false, avgLevel: null as number | null });
  const [radiography, setRadiography] = useState<AuroraRadiographyDoc | null>(null);
  const [validation, setValidation] = useState<AuroraValidationState | null>(null);
  const [routeChat, setRouteChat] = useState<AuroraRouteChatMessage[]>([]);
  const [bets, setBets] = useState<BetRow[]>([]);
  const [radioBody, setRadioBody] = useState('');
  const [radioHypo, setRadioHypo] = useState('');
  const [techNotes, setTechNotes] = useState('');
  const [talk, setTalk] = useState('');
  const [routeMsg, setRouteMsg] = useState('');
  const [week, setWeek] = useState({ happened: '', blocked: '', nextStep: '' });
  const [confirm, setConfirm] = useState<{
    level: AuroraMaturity;
    situation: string;
    gap: string;
    potential: string;
  } | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);

  const t =
    loc === 'es'
      ? {
          back: 'Cartera',
          title: 'Acompañamiento',
          line: 'Flujo continuo: diagnóstico → radiografía → validar → ruta. El negocio externo solo verá el documento, la ruta y el avance.',
          needCompany: 'Elegí un negocio atendido en el selector de AURORA o en la cartera.',
          needEngagement: 'Falta el contrato AT. Volvé a la cartera.',
          pick: 'Elegí un área para empezar',
          send: 'Enviar',
          placeholder: 'Cómo es hoy, en sus palabras…',
          confirm: 'Confirmar este bloque',
          situation: 'Situación real',
          gap: 'Brecha',
          pot: 'Potencial',
          level: 'Madurez',
          done: 'listo',
          of: 'de',
          systematize: 'Sistematizar radiografía',
          saveRadio: 'Guardar documento',
          validate: 'Aprobar radiografía',
          validateHint: 'Revisá el documento con la IA. Si está bien, aprobá y abrimos la ruta.',
          aiSays: 'Lectura de la IA',
          proposeRoute: 'Proponer ruta de intervención',
          markLive: 'Dejar ruta en curso',
          routeChat: 'Asistente de la ruta',
          routePlaceholder: 'Ajustá una actividad o pedí cambios…',
          avance: 'Vista del negocio',
          copyLink: 'Copiar enlace de avance',
          copied: 'Enlace copiado',
          emptyRoute: 'Todavía no hay actividades. Proponé la ruta.',
          diagHint: 'Una área a la vez. Confirmá nivel y situación real.',
          weekTitle: 'Nota de la semana',
          happened: 'Qué pasó',
          blocked: 'Qué traba',
          nextStep: 'Próximo paso',
          logWeek: 'Anotar semana',
          allActivities: 'Todas las actividades',
        }
      : loc === 'en'
        ? {
            back: 'Portfolio',
            title: 'Accompaniment',
            line: 'Continuous flow: diagnostic → radiography → validate → route. The external business only sees the document, route and progress.',
            needCompany: 'Pick an attended business in the AURORA selector or portfolio.',
            needEngagement: 'Missing AT contract. Go back to the portfolio.',
            pick: 'Pick an area to start',
            send: 'Send',
            placeholder: 'How it is today, in their words…',
            confirm: 'Confirm this block',
            situation: 'Real situation',
            gap: 'Gap',
            pot: 'Potential',
            level: 'Maturity',
            done: 'done',
            of: 'of',
            systematize: 'Systematize radiography',
            saveRadio: 'Save document',
            validate: 'Approve radiography',
            validateHint: 'Review the document with AI. If it looks right, approve and we open the route.',
            aiSays: 'AI reading',
            proposeRoute: 'Propose intervention route',
            markLive: 'Mark route live',
            routeChat: 'Route assistant',
            routePlaceholder: 'Adjust an activity or ask for changes…',
            avance: 'Business view',
            copyLink: 'Copy progress link',
            copied: 'Link copied',
            emptyRoute: 'No activities yet. Propose the route.',
            diagHint: 'One area at a time. Confirm level and real situation.',
            weekTitle: 'Week note',
            happened: 'What happened',
            blocked: 'What is stuck',
            nextStep: 'Next step',
            logWeek: 'Log week',
            allActivities: 'All activities',
          }
        : {
            back: 'Carteira',
            title: 'Acompanhamento',
            line: 'Fluxo contínuo: diagnóstico → radiografia → validar → rota. O negócio externo só vê o documento, a rota e o avanço.',
            needCompany: 'Escolhe um negócio atendido no seletor do AURORA ou na carteira.',
            needEngagement: 'Falta o contrato AT. Volta à carteira.',
            pick: 'Escolhe uma área para começar',
            send: 'Enviar',
            placeholder: 'Como é hoje, nas palavras deles…',
            confirm: 'Confirmar este bloco',
            situation: 'Situação real',
            gap: 'Brecha',
            pot: 'Potencial',
            level: 'Maturidade',
            done: 'feitos',
            of: 'de',
            systematize: 'Sistematizar radiografia',
            saveRadio: 'Guardar documento',
            validate: 'Aprovar radiografia',
            validateHint: 'Revisa o documento com a IA. Se estiver bem, aprova e abrimos a rota.',
            aiSays: 'Leitura da IA',
            proposeRoute: 'Propor rota de intervenção',
            markLive: 'Deixar rota em curso',
            routeChat: 'Assistente da rota',
            routePlaceholder: 'Ajusta uma atividade ou pede mudanças…',
            avance: 'Vista do negócio',
            copyLink: 'Copiar link de avanço',
            copied: 'Link copiado',
            emptyRoute: 'Ainda não há atividades. Propõe a rota.',
            diagHint: 'Uma área de cada vez. Confirma nível e situação real.',
            weekTitle: 'Nota da semana',
            happened: 'O que aconteceu',
            blocked: 'O que trava',
            nextStep: 'Próximo passo',
            logWeek: 'Anotar semana',
            allActivities: 'Todas as atividades',
          };

  const phaseLabels = auroraFlowPhaseLabels(loc);

  const applyFlow = (d: Record<string, unknown>) => {
    if (typeof d.companyName === 'string' && d.companyName) setCompanyName(d.companyName);
    if (d.diagnostic) setDiagnostic(d.diagnostic as AuroraDiagnosticState);
    if (d.progress) setProgress(d.progress as typeof progress);
    if (typeof d.phase === 'string') {
      setPhase(d.phase as AuroraFlowPhase);
      setUiPhase(d.phase as AuroraFlowPhase);
    }
    const radio = (d.radiography as AuroraRadiographyDoc | null) || null;
    setRadiography(radio);
    setRadioBody(radio?.body || String(d.portraitText || ''));
    setRadioHypo(radio?.hypothesis || String(d.hypothesis || ''));
    setValidation((d.validation as AuroraValidationState) || null);
    setRouteChat(Array.isArray(d.routeChat) ? (d.routeChat as AuroraRouteChatMessage[]) : []);
    setBets(Array.isArray(d.bets) ? (d.bets as BetRow[]) : []);
  };

  const load = useCallback(async () => {
    if (!companyId || !engagementId) {
      setLoading(false);
      setErr(!companyId ? t.needCompany : t.needEngagement);
      return;
    }
    setLoading(true);
    try {
      const q = new URLSearchParams({ companyId, engagementId });
      const r = await fetch(`/api/business-dossier/flow?${q}`, { cache: 'no-store' });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Falha');
      applyFlow(d);
      setErr(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro');
    } finally {
      setLoading(false);
    }
  }, [companyId, engagementId, t.needCompany, t.needEngagement]);

  useEffect(() => {
    void load();
  }, [load]);

  const activeId = diagnostic.activeBlockId;
  const active = activeId ? diagnostic.blocks[activeId] : null;

  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [active?.messages, busy, uiPhase]);

  useEffect(() => {
    const el = chatScroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [routeChat, busy]);

  useEffect(() => {
    const p = active?.pending;
    if (p?.ready && p.level) {
      setConfirm({
        level: p.level,
        situation: p.situation || '',
        gap: p.gap || '',
        potential: p.potential || '',
      });
    } else setConfirm(null);
  }, [active?.pending]);

  const flowPost = async (payload: Record<string, unknown>) => {
    setBusy(true);
    try {
      const r = await fetch('/api/business-dossier/flow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, engagementId, locale: loc, ...payload }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Falha');
      applyFlow(d);
      setErr(null);
      return d;
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro');
      return null;
    } finally {
      setBusy(false);
    }
  };

  const openBlock = async (blockId: AuroraDiagBlockId) => {
    setBusy(true);
    try {
      const r = await fetch('/api/business-dossier/diagnostic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, engagementId, blockId, open: true, locale: loc }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Falha');
      if (d.diagnostic) setDiagnostic(d.diagnostic);
      if (d.progress) setProgress(d.progress);
      setTalk('');
      setErr(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro');
    } finally {
      setBusy(false);
    }
  };

  const sendDiag = async () => {
    if (!activeId || !talk.trim() || busy) return;
    const message = talk.trim();
    setBusy(true);
    setTalk('');
    try {
      const r = await fetch('/api/business-dossier/diagnostic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, engagementId, blockId: activeId, message, locale: loc }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Falha');
      if (d.diagnostic) setDiagnostic(d.diagnostic);
      if (d.progress) setProgress(d.progress);
      setErr(null);
    } catch (e) {
      setTalk(message);
      setErr(e instanceof Error ? e.message : 'Erro');
    } finally {
      setBusy(false);
    }
  };

  const saveConfirm = async () => {
    if (!activeId || !confirm || busy) return;
    setBusy(true);
    try {
      const r = await fetch('/api/business-dossier/diagnostic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, engagementId, blockId: activeId, confirm: true, locale: loc, ...confirm }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Falha');
      if (d.diagnostic) setDiagnostic(d.diagnostic);
      if (d.progress) setProgress(d.progress);
      setConfirm(null);
      setTalk('');
      setErr(null);
      if (d.progress?.complete) await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro');
    } finally {
      setBusy(false);
    }
  };

  if (!companyId || !engagementId) {
    return (
      <div className="mx-auto max-w-lg space-y-4 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-8 text-center">
        <p className="text-sm text-amber-950">{err || t.needCompany}</p>
        <Link href="/hub/aurora" className="inline-block text-sm font-medium text-amber-900 underline">
          ← {t.back}
        </Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-amber-700" />
      </div>
    );
  }

  const avanceHref = `/hub/aurora/avance?${new URLSearchParams({ company: companyId, engagement: engagementId })}`;
  const openBets = bets.filter((b) => b.status !== 'done' && b.status !== 'dropped');
  const visibleBets = bets.filter((b) => b.status !== 'dropped');
  const doneCount = bets.filter((b) => b.status === 'done').length;
  const routePct =
    visibleBets.length > 0 ? Math.round((doneCount / visibleBets.length) * 100) : 0;

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <header className="space-y-3">
        <Link href="/hub/aurora" className="text-xs text-slate-500 hover:text-slate-800">
          ← {t.back}
        </Link>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-serif text-3xl text-slate-900">
              {t.title}
              {companyName ? ` · ${companyName}` : ''}
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-600">{t.line}</p>
          </div>
          <div className="text-right text-sm text-slate-600">
            <p className="font-semibold text-slate-900">
              {progress.done} {t.of} {progress.total} {t.done}
            </p>
            <div className="mt-1 flex flex-wrap justify-end gap-3">
              <Link href={avanceHref} className="text-amber-900 hover:underline">
                {t.avance}
              </Link>
              <button
                type="button"
                className="text-slate-500 hover:text-amber-900 hover:underline"
                onClick={() => {
                  const url = `${typeof window !== 'undefined' ? window.location.origin : ''}${avanceHref}`;
                  void navigator.clipboard?.writeText(url).then(() => {
                    setLinkCopied(true);
                    window.setTimeout(() => setLinkCopied(false), 2000);
                  });
                }}
              >
                {linkCopied ? t.copied : t.copyLink}
              </button>
            </div>
          </div>
        </div>
        <AuroraFlowRail
          phase={uiPhase}
          labels={phaseLabels}
          onSelect={(p) => {
            if (AURORA_FLOW_PHASE_ORDER[p] <= AURORA_FLOW_PHASE_ORDER[phase] + 1) setUiPhase(p);
          }}
        />
      </header>

      {err ? <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{err}</p> : null}

      {uiPhase === 'diag' ? (
        <div className="space-y-4">
          <p className="text-sm text-slate-600">{t.diagHint}</p>
          <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
            {AURORA_DIAG_BLOCKS.map((def) => {
              const block = diagnostic.blocks[def.id];
              const activeBlock = diagnostic.activeBlockId === def.id;
              return (
                <button
                  key={def.id}
                  type="button"
                  disabled={busy}
                  onClick={() => void openBlock(def.id)}
                  className={`rounded-2xl border px-3 py-3 text-left transition ${
                    activeBlock ? 'ring-2 ring-amber-700 ring-offset-2' : ''
                  } ${levelTone(block.level)}`}
                >
                  <p className="text-[11px] font-semibold uppercase tracking-wide opacity-70">{def.label[loc]}</p>
                  <p className="mt-1 text-sm font-medium">
                    {block.status === 'done' && block.level
                      ? AURORA_MATURITY[block.level].short[loc]
                      : block.status === 'active'
                        ? '…'
                        : '—'}
                  </p>
                </button>
              );
            })}
          </div>

          {!activeId || !active ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-12 text-center text-sm text-slate-600">
              {t.pick}
            </div>
          ) : (
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
              <section className="flex min-h-[48vh] flex-col rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  {AURORA_DIAG_BLOCKS.find((b) => b.id === activeId)?.label[loc]}
                </p>
                <div ref={scroller} className="mt-3 flex-1 space-y-3 overflow-y-auto pr-1">
                  {active.messages.map((m, i) => (
                    <div
                      key={`${m.role}${i}`}
                      className={m.role === 'assistant' ? 'text-sm text-slate-800' : 'rounded-lg bg-amber-50 px-3 py-2 text-sm text-slate-900'}
                    >
                      {m.text}
                    </div>
                  ))}
                  {busy ? <Loader2 className="h-4 w-4 animate-spin text-amber-700" /> : null}
                </div>
                <textarea
                  value={talk}
                  onChange={(e) => setTalk(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      void sendDiag();
                    }
                  }}
                  placeholder={t.placeholder}
                  rows={3}
                  className="mt-3 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                />
                <button
                  type="button"
                  disabled={busy || !talk.trim()}
                  onClick={() => void sendDiag()}
                  className="mt-2 self-end rounded-lg bg-amber-800 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                >
                  {t.send}
                </button>
              </section>
              <aside className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
                {confirm ? (
                  <div className="space-y-2">
                    <label className="block text-xs font-semibold uppercase text-slate-400">{t.level}</label>
                    <select
                      value={confirm.level}
                      onChange={(e) => setConfirm({ ...confirm, level: Number(e.target.value) as AuroraMaturity })}
                      className="w-full rounded-lg border px-2 py-1.5 text-sm"
                    >
                      {([1, 2, 3, 4, 5] as AuroraMaturity[]).map((n) => (
                        <option key={n} value={n}>
                          {n} · {AURORA_MATURITY[n].short[loc]}
                        </option>
                      ))}
                    </select>
                    <label className="block text-xs font-semibold uppercase text-slate-400">{t.situation}</label>
                    <textarea
                      value={confirm.situation}
                      onChange={(e) => setConfirm({ ...confirm, situation: e.target.value })}
                      rows={3}
                      className="w-full rounded-lg border px-2 py-1.5 text-sm"
                    />
                    <label className="block text-xs font-semibold uppercase text-slate-400">{t.gap}</label>
                    <textarea
                      value={confirm.gap}
                      onChange={(e) => setConfirm({ ...confirm, gap: e.target.value })}
                      rows={2}
                      className="w-full rounded-lg border px-2 py-1.5 text-sm"
                    />
                    <label className="block text-xs font-semibold uppercase text-slate-400">{t.pot}</label>
                    <textarea
                      value={confirm.potential}
                      onChange={(e) => setConfirm({ ...confirm, potential: e.target.value })}
                      rows={2}
                      className="w-full rounded-lg border px-2 py-1.5 text-sm"
                    />
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void saveConfirm()}
                      className="w-full rounded-lg bg-amber-800 px-3 py-2 text-sm font-medium text-white"
                    >
                      {t.confirm}
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3 text-sm text-slate-600">
                    <div>
                      <p className="text-xs font-semibold uppercase text-slate-400">{t.gap}</p>
                      <p className="mt-1">{active.gap || '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase text-slate-400">{t.pot}</p>
                      <p className="mt-1">{active.potential || '—'}</p>
                    </div>
                  </div>
                )}
              </aside>
            </div>
          )}

          {progress.complete ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void flowPost({ action: 'systematize' }).then((d) => d && setUiPhase('radio'))}
              className="rounded-lg bg-amber-800 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
            >
              {t.systematize}
            </button>
          ) : null}
        </div>
      ) : null}

      {uiPhase === 'radio' ? (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
          <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
            <h2 className="font-serif text-xl text-slate-900">{radiography?.title || phaseLabels.radio}</h2>
            <textarea
              value={radioBody}
              onChange={(e) => setRadioBody(e.target.value)}
              rows={18}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 font-serif text-sm leading-relaxed text-slate-900"
            />
            <div className="flex flex-wrap gap-2">
              {!radiography ? (
                <button
                  type="button"
                  disabled={busy || !progress.complete}
                  onClick={() => void flowPost({ action: 'systematize' })}
                  className="rounded-lg bg-amber-800 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                >
                  {t.systematize}
                </button>
              ) : (
                <button
                  type="button"
                  disabled={busy || !radioBody.trim()}
                  onClick={() =>
                    void flowPost({ action: 'saveRadiography', body: radioBody, hypothesis: radioHypo })
                  }
                  className="rounded-lg bg-amber-800 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                >
                  {t.saveRadio}
                </button>
              )}
              {radiography ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setUiPhase('validate')}
                  className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-950"
                >
                  {phaseLabels.validate} →
                </button>
              ) : null}
            </div>
          </section>
          <aside className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
            <label className="text-xs font-semibold uppercase text-slate-400">Hipótesis</label>
            <textarea
              value={radioHypo}
              onChange={(e) => setRadioHypo(e.target.value)}
              rows={5}
              className="w-full rounded-lg border px-3 py-2 text-sm"
            />
            <ul className="space-y-2 text-xs text-slate-600">
              {(radiography?.blockSummaries || []).map((b) => (
                <li key={b.id} className="rounded-lg bg-slate-50 px-2 py-1.5">
                  <span className="font-semibold">{b.label}</span> · {b.levelLabel}
                </li>
              ))}
            </ul>
          </aside>
        </div>
      ) : null}

      {uiPhase === 'validate' ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-2xl border border-slate-200 bg-white p-4">
            <h2 className="font-serif text-xl text-slate-900">{radiography?.title || phaseLabels.radio}</h2>
            <pre className="mt-3 max-h-[50vh] overflow-auto whitespace-pre-wrap font-serif text-sm leading-relaxed text-slate-800">
              {radioBody || radiography?.body || '—'}
            </pre>
            <p className="mt-3 text-sm font-medium text-slate-900">{radioHypo || radiography?.hypothesis}</p>
          </section>
          <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-sm text-slate-600">{t.validateHint}</p>
            {validation?.aiNotes ? (
              <div className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-950">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-800">{t.aiSays}</p>
                <p className="mt-1">{validation.aiNotes}</p>
              </div>
            ) : null}
            <textarea
              value={techNotes}
              onChange={(e) => setTechNotes(e.target.value)}
              placeholder={loc === 'es' ? 'Notas del técnico…' : loc === 'en' ? 'Technician notes…' : 'Notas do técnico…'}
              rows={4}
              className="w-full rounded-lg border px-3 py-2 text-sm"
            />
            <button
              type="button"
              disabled={busy || !radiography}
              onClick={() =>
                void flowPost({ action: 'validate', accept: true, techNotes }).then((d) => d && setUiPhase('route'))
              }
              className="w-full rounded-lg bg-amber-800 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
            >
              {t.validate}
            </button>
            {validation?.techAccepted ? (
              <p className="text-sm text-emerald-800">
                {loc === 'es' ? 'Radiografía aprobada.' : loc === 'en' ? 'Radiography approved.' : 'Radiografia aprovada.'}
              </p>
            ) : null}
          </section>
        </div>
      ) : null}

      {uiPhase === 'route' || uiPhase === 'live' ? (
        <div className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
            <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="font-serif text-xl text-slate-900">{phaseLabels.route}</h2>
                  <p className="text-xs text-slate-500">
                    {t.allActivities}: {doneCount}/{visibleBets.length || 0} · {routePct}%
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {openBets.length < 2 ? (
                    <button
                      type="button"
                      disabled={busy || !validation?.techAccepted}
                      onClick={() => void flowPost({ action: 'proposeRoute' })}
                      className="rounded-lg bg-amber-800 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
                    >
                      {t.proposeRoute}
                    </button>
                  ) : null}
                  {openBets.length >= 2 && phase !== 'live' ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void flowPost({ action: 'markLive' })}
                      className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-900"
                    >
                      {t.markLive}
                    </button>
                  ) : null}
                </div>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-amber-700 transition-all" style={{ width: `${routePct}%` }} />
              </div>
              {visibleBets.length === 0 ? (
                <p className="text-sm text-slate-500">{t.emptyRoute}</p>
              ) : (
                <ul className="space-y-2">
                  {visibleBets.map((b) => {
                    const next = nextAuroraBetStatuses(b.status);
                    return (
                      <li key={b.id} className="rounded-xl border border-slate-200 px-3 py-2">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-slate-900">{b.title}</p>
                            {b.why ? <p className="mt-1 text-sm text-slate-600">{b.why}</p> : null}
                            {b.indicator ? <p className="mt-1 text-xs text-amber-900">{b.indicator}</p> : null}
                            <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                              {auroraBetStatusLabel(b.status, loc)}
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {next.map((status) => (
                              <button
                                key={status}
                                type="button"
                                disabled={busy}
                                onClick={() => void flowPost({ action: 'updateBet', betId: b.id, status })}
                                className="rounded-md border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                              >
                                → {auroraBetStatusLabel(status, loc)}
                              </button>
                            ))}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
            <section className="flex min-h-[48vh] flex-col rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{t.routeChat}</p>
              <div ref={chatScroller} className="mt-3 flex-1 space-y-3 overflow-y-auto pr-1">
                {routeChat.map((m, i) => (
                  <div
                    key={`${m.role}${i}`}
                    className={m.role === 'assistant' ? 'text-sm text-slate-800' : 'rounded-lg bg-amber-50 px-3 py-2 text-sm text-slate-900'}
                  >
                    {m.text}
                  </div>
                ))}
              </div>
              <textarea
                value={routeMsg}
                onChange={(e) => setRouteMsg(e.target.value)}
                placeholder={t.routePlaceholder}
                rows={3}
                className="mt-3 w-full rounded-xl border px-3 py-2 text-sm"
              />
              <button
                type="button"
                disabled={busy || !routeMsg.trim()}
                onClick={() => {
                  const message = routeMsg.trim();
                  setRouteMsg('');
                  void flowPost({ action: 'routeChat', message });
                }}
                className="mt-2 self-end rounded-lg bg-amber-800 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {t.send}
              </button>
            </section>
          </div>

          <section className="rounded-2xl border border-slate-200 bg-white p-4">
            <h3 className="text-sm font-semibold text-slate-900">{t.weekTitle}</h3>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              <textarea
                value={week.happened}
                onChange={(e) => setWeek((w) => ({ ...w, happened: e.target.value }))}
                placeholder={t.happened}
                rows={2}
                className="rounded-lg border px-3 py-2 text-sm"
              />
              <textarea
                value={week.blocked}
                onChange={(e) => setWeek((w) => ({ ...w, blocked: e.target.value }))}
                placeholder={t.blocked}
                rows={2}
                className="rounded-lg border px-3 py-2 text-sm"
              />
              <textarea
                value={week.nextStep}
                onChange={(e) => setWeek((w) => ({ ...w, nextStep: e.target.value }))}
                placeholder={t.nextStep}
                rows={2}
                className="rounded-lg border px-3 py-2 text-sm"
              />
            </div>
            <button
              type="button"
              disabled={busy || (!week.happened.trim() && !week.nextStep.trim())}
              onClick={() =>
                void flowPost({ action: 'logWeek', ...week }).then((d) => {
                  if (d) setWeek({ happened: '', blocked: '', nextStep: '' });
                })
              }
              className="mt-3 rounded-lg bg-amber-800 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {t.logWeek}
            </button>
          </section>
        </div>
      ) : null}
    </div>
  );
}
