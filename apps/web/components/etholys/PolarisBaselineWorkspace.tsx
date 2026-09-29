'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useApp } from '@/app/providers';
import {
  AURORA_DIAG_BLOCKS,
  AURORA_MATURITY,
  type AuroraDiagBlockId,
  type AuroraDiagnosticState,
  type AuroraMaturity,
  emptyAuroraDiagnostic,
} from '@/lib/aurora-diagnostic';

function levelTone(level: AuroraMaturity | null | undefined) {
  if (!level) return 'border-white/20 bg-white/5 text-white/50';
  if (level <= 2) return 'border-rose-400/40 bg-rose-500/15 text-rose-100';
  if (level === 3) return 'border-amber-400/40 bg-amber-500/15 text-amber-50';
  return 'border-teal-400/40 bg-teal-500/15 text-teal-50';
}

/** Linha de base POLARIS — maturidade 1–5 por bloco + situação real. Alimenta o guia de autodesenvolvimento (IA). */
export function PolarisBaselineWorkspace({ embedded = false }: { embedded?: boolean }) {
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
  const [diagnostic, setDiagnostic] = useState<AuroraDiagnosticState>(emptyAuroraDiagnostic());
  const [progress, setProgress] = useState({
    done: 0,
    total: 6,
    complete: false,
    avgLevel: null as number | null,
  });
  const [talk, setTalk] = useState('');
  const [confirm, setConfirm] = useState<{
    level: AuroraMaturity;
    situation: string;
    gap: string;
    potential: string;
  } | null>(null);

  const qCompany = companyId
    ? `?${new URLSearchParams({
        company: companyId,
        ...(engagementId ? { engagement: engagementId } : {}),
      })}`
    : '';

  const t =
    loc === 'es'
      ? {
          title: 'Línea base',
          line: 'Antes de orientar, POLARIS necesita saber de dónde partís. Una área a la vez: contá cómo es hoy, confirmá la madurez. Eso se junta con FundHub, Work, Meet y el resto del ecosistema.',
          pick: 'Elegí un área para construir la línea base',
          send: 'Enviar',
          placeholder: 'Cómo es hoy, en tus palabras…',
          confirm: 'Confirmar este bloque',
          situation: 'Situación real',
          gap: 'Brecha',
          pot: 'Potencial',
          level: 'Madurez',
          done: 'listos',
          of: 'de',
          map: 'Abrir guía de autodesarrollo',
          needCompany: 'Elegí una empresa.',
          next: 'Seguir',
          complete: 'Línea base completa. La IA del sistema ya tiene de dónde partir.',
        }
      : loc === 'en'
        ? {
            title: 'Baseline',
            line: 'Before guiding, POLARIS needs to know where you start. One area at a time: say how it is today, confirm maturity. That joins FundHub, Work, Meet and the rest of the ecosystem.',
            pick: 'Pick an area to build the baseline',
            send: 'Send',
            placeholder: 'How it is today, in your words…',
            confirm: 'Confirm this block',
            situation: 'Real situation',
            gap: 'Gap',
            pot: 'Potential',
            level: 'Maturity',
            done: 'done',
            of: 'of',
            map: 'Open self-development guide',
            needCompany: 'Pick a company.',
            next: 'Continue',
            complete: 'Baseline complete. The system AI has somewhere to start from.',
          }
        : {
            title: 'Linha base',
            line: 'Antes de orientar, o POLARIS precisa de saber de onde partes. Uma área de cada vez: conta como é hoje, confirma a maturidade. Isso junta-se ao FundHub, Work, Meet e ao resto do ecossistema.',
            pick: 'Escolhe uma área para construir a linha base',
            send: 'Enviar',
            placeholder: 'Como é hoje, nas tuas palavras…',
            confirm: 'Confirmar este bloco',
            situation: 'Situação real',
            gap: 'Brecha',
            pot: 'Potencial',
            level: 'Maturidade',
            done: 'feitos',
            of: 'de',
            map: 'Abrir guia de autodesenvolvimento',
            needCompany: 'Escolhe uma empresa.',
            next: 'Seguir',
            complete: 'Linha base completa. A IA do sistema já tem de onde partir.',
          };

  const apply = (d: {
    companyName?: string;
    diagnostic?: AuroraDiagnosticState;
    progress?: { done: number; total: number; complete: boolean; avgLevel: number | null };
  }) => {
    if (d.companyName) setCompanyName(d.companyName);
    if (d.diagnostic) setDiagnostic(d.diagnostic);
    if (d.progress) setProgress(d.progress);
  };

  const load = useCallback(async () => {
    if (!companyId) {
      setLoading(false);
      setErr(t.needCompany);
      return;
    }
    setLoading(true);
    try {
      const q = new URLSearchParams({ companyId });
      if (engagementId) q.set('engagementId', engagementId);
      const r = await fetch(`/api/business-dossier/diagnostic?${q}`, { cache: 'no-store' });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Falha');
      apply(d);
      setErr(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro');
    } finally {
      setLoading(false);
    }
  }, [companyId, engagementId, t.needCompany]);

  useEffect(() => {
    void load();
  }, [load]);

  const activeId = diagnostic.activeBlockId;
  const active = activeId ? diagnostic.blocks[activeId] : null;

  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [active?.messages, busy]);

  useEffect(() => {
    const p = active?.pending;
    if (p?.ready && p.level) {
      setConfirm({
        level: p.level,
        situation: p.situation || '',
        gap: p.gap || '',
        potential: p.potential || '',
      });
    } else {
      setConfirm(null);
    }
  }, [active?.pending]);

  const openBlock = async (blockId: AuroraDiagBlockId) => {
    setBusy(true);
    try {
      const r = await fetch('/api/business-dossier/diagnostic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, engagementId, blockId, open: true, locale: loc, product: 'polaris' }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Falha');
      apply(d);
      setTalk('');
      setErr(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro');
    } finally {
      setBusy(false);
    }
  };

  const send = async () => {
    if (!activeId || !talk.trim() || busy) return;
    const message = talk.trim();
    setBusy(true);
    setTalk('');
    try {
      const r = await fetch('/api/business-dossier/diagnostic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          engagementId,
          blockId: activeId,
          message,
          locale: loc,
          product: 'polaris',
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Falha');
      apply(d);
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
        body: JSON.stringify({
          companyId,
          engagementId,
          blockId: activeId,
          confirm: true,
          locale: loc,
          product: 'polaris',
          ...confirm,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Falha');
      apply(d);
      setConfirm(null);
      setTalk('');
      setErr(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-teal-300" />
      </div>
    );
  }

  return (
    <div className={`mx-auto max-w-6xl space-y-5 ${embedded ? '' : ''}`}>
      <header className="space-y-2">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-200/80">
              {companyName ? `${companyName} · ${t.title}` : t.title}
            </p>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/70">{t.line}</p>
          </div>
          <div className="text-right text-sm text-white/70">
            <p className="font-semibold text-white">
              {progress.done} {t.of} {progress.total} {t.done}
            </p>
            {progress.avgLevel != null ? (
              <p>
                {t.level}: {progress.avgLevel}
              </p>
            ) : null}
            {progress.complete ? (
              <Link href={`/hub/polaris${qCompany}`} className="mt-1 inline-block text-teal-200 hover:underline">
                {t.map}
              </Link>
            ) : null}
          </div>
        </div>
        {progress.complete ? <p className="rounded-lg border border-teal-300/30 bg-teal-400/10 px-3 py-2 text-sm text-teal-50">{t.complete}</p> : null}
      </header>

      {err && <p className="rounded-lg border border-rose-400/30 bg-rose-500/15 px-3 py-2 text-sm text-rose-100">{err}</p>}

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
                activeBlock ? 'ring-2 ring-teal-300 ring-offset-2 ring-offset-[#041018]' : ''
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
        <div className="rounded-2xl border border-dashed border-white/25 bg-white/[0.04] px-5 py-12 text-center text-sm text-white/60">
          {t.pick}
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
          <section className="flex min-h-[52vh] flex-col rounded-2xl border border-white/15 bg-white/[0.06] p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-white/40">
              {AURORA_DIAG_BLOCKS.find((b) => b.id === activeId)?.label[loc]}
            </p>
            <div ref={scroller} className="mt-3 flex-1 space-y-3 overflow-y-auto pr-1">
              {active.messages.map((m, i) => (
                <div
                  key={`${m.role}${i}`}
                  className={
                    m.role === 'assistant'
                      ? 'text-sm leading-relaxed text-white'
                      : 'rounded-xl bg-white/10 px-3 py-2 text-sm text-white'
                  }
                >
                  {m.text}
                </div>
              ))}
              {busy && <Loader2 className="h-4 w-4 animate-spin text-teal-300" />}
            </div>
            <textarea
              value={talk}
              onChange={(e) => setTalk(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
              placeholder={t.placeholder}
              rows={3}
              className="mt-3 w-full rounded-lg border border-white/25 bg-white/10 px-3 py-2 text-sm text-white placeholder:text-white/40"
            />
            <button
              type="button"
              disabled={busy || !talk.trim()}
              onClick={() => void send()}
              className="mt-2 self-end rounded-lg bg-teal-300 px-4 py-2 text-sm font-medium text-[#041018] disabled:opacity-40"
            >
              {t.send}
            </button>
          </section>

          <div className="space-y-4">
            {confirm ? (
              <section className="rounded-2xl border border-teal-300/30 bg-teal-400/10 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-teal-100">{t.confirm}</p>
                <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-white/50">{t.level}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {([1, 2, 3, 4, 5] as AuroraMaturity[]).map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setConfirm((c) => (c ? { ...c, level: n } : c))}
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                        confirm.level === n ? 'bg-teal-300 text-[#041018]' : 'border border-white/20 bg-white/5 text-white/80'
                      }`}
                    >
                      {n} · {AURORA_MATURITY[n].short[loc]}
                    </button>
                  ))}
                </div>
                <p className="mt-1 text-[11px] text-white/60">{AURORA_MATURITY[confirm.level].line[loc]}</p>
                <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-white/50">{t.situation}</p>
                <textarea
                  value={confirm.situation}
                  onChange={(e) => setConfirm((c) => (c ? { ...c, situation: e.target.value } : c))}
                  rows={4}
                  className="mt-1 w-full rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm text-white"
                />
                <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-white/50">{t.gap}</p>
                <input
                  value={confirm.gap}
                  onChange={(e) => setConfirm((c) => (c ? { ...c, gap: e.target.value } : c))}
                  className="mt-1 w-full rounded-lg border border-white/20 bg-white/10 px-3 py-1.5 text-sm text-white"
                />
                <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-white/50">{t.pot}</p>
                <input
                  value={confirm.potential}
                  onChange={(e) => setConfirm((c) => (c ? { ...c, potential: e.target.value } : c))}
                  className="mt-1 w-full rounded-lg border border-white/20 bg-white/10 px-3 py-1.5 text-sm text-white"
                />
                <button
                  type="button"
                  disabled={busy || confirm.situation.trim().length < 12}
                  onClick={() => void saveConfirm()}
                  className="mt-4 rounded-lg bg-teal-300 px-4 py-2 text-sm font-medium text-[#041018] disabled:opacity-40"
                >
                  {t.next}
                </button>
              </section>
            ) : active.pending && !active.pending.ready ? (
              <section className="rounded-2xl border border-white/15 bg-white/[0.06] p-4 text-sm text-white/70">
                <p className="text-xs font-semibold uppercase tracking-wide text-white/40">{t.next}</p>
                <p className="mt-2">{active.pending.reply}</p>
              </section>
            ) : active.status === 'done' ? (
              <section className="rounded-2xl border border-teal-300/25 bg-teal-400/10 p-4 text-sm">
                <p className="font-medium text-teal-50">
                  {active.level ? AURORA_MATURITY[active.level].short[loc] : ''}
                </p>
                <p className="mt-2 whitespace-pre-wrap text-white/80">{active.situation}</p>
                {active.gap ? (
                  <p className="mt-2 text-xs text-rose-200">
                    {t.gap}: {active.gap}
                  </p>
                ) : null}
                {active.potential ? (
                  <p className="mt-1 text-xs text-teal-100">
                    {t.pot}: {active.potential}
                  </p>
                ) : null}
              </section>
            ) : null}

            <section className="rounded-2xl border border-white/15 bg-white/[0.06] p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-white/40">{t.gap}</p>
              <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-white/75">
                {AURORA_DIAG_BLOCKS.map((def) => {
                  const g = diagnostic.blocks[def.id]?.gap;
                  if (!g) return null;
                  return (
                    <li key={def.id}>
                      <span className="text-white/40">{def.label[loc]}:</span> {g}
                    </li>
                  );
                })}
              </ul>
              <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-white/40">{t.pot}</p>
              <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-white/75">
                {AURORA_DIAG_BLOCKS.map((def) => {
                  const p = diagnostic.blocks[def.id]?.potential;
                  if (!p) return null;
                  return (
                    <li key={def.id}>
                      <span className="text-white/40">{def.label[loc]}:</span> {p}
                    </li>
                  );
                })}
              </ul>
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
