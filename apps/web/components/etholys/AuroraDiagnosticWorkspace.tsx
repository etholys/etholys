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
  if (!level) return 'bg-slate-100 text-slate-500 border-slate-200';
  if (level <= 2) return 'bg-rose-50 text-rose-900 border-rose-200';
  if (level === 3) return 'bg-amber-50 text-amber-950 border-amber-200';
  return 'bg-emerald-50 text-emerald-900 border-emerald-200';
}

export function AuroraDiagnosticWorkspace() {
  const { locale } = useApp();
  const search = useSearchParams();
  const loc = locale === 'es' || locale === 'en' ? locale : 'pt';
  /** Só negócio atendido via URL — nunca a incubadora do Hub. */
  const companyId = String(search.get('company') || '').trim();
  const engagementId = String(search.get('engagement') || '').trim();
  const scroller = useRef<HTMLDivElement>(null);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState('');
  const [diagnostic, setDiagnostic] = useState<AuroraDiagnosticState>(emptyAuroraDiagnostic());
  const [progress, setProgress] = useState({ done: 0, total: 6, complete: false, avgLevel: null as number | null });
  const [talk, setTalk] = useState('');
  const [confirm, setConfirm] = useState<{
    level: AuroraMaturity;
    situation: string;
    gap: string;
    potential: string;
  } | null>(null);

  const t =
    loc === 'es'
      ? {
          back: 'Cartera',
          title: 'Diagnóstico',
          line: 'Una área a la vez. Contá cómo es de verdad. Confirmá el nivel. El mapa se llena — no es un formulario.',
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
          dossier: 'Abrir dossier profundo',
          needCompany: 'Elegí un negocio atendido en el selector de AURORA o en la cartera.',
          needEngagement: 'Falta el contrato AT. Volvé a la cartera y abrí el negocio desde ahí.',
          next: 'Seguir',
        }
      : loc === 'en'
        ? {
            back: 'Portfolio',
            title: 'Diagnostic',
            line: 'One area at a time. Say how it really is. Confirm the level. The map fills in — not a form.',
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
            dossier: 'Open deep dossier',
            needCompany: 'Pick an attended business in the AURORA selector or portfolio.',
            needEngagement: 'Missing AT contract. Go back to the portfolio and open the business from there.',
            next: 'Continue',
          }
        : {
            back: 'Carteira',
            title: 'Diagnóstico',
            line: 'Uma área de cada vez. Conta como é de verdade. Confirma o nível. O mapa enche — não é um formulário.',
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
            dossier: 'Abrir dossiê profundo',
            needCompany: 'Escolhe um negócio atendido no seletor do AURORA ou na carteira.',
            needEngagement: 'Falta o contrato AT. Volta à carteira e abre o negócio a partir daí.',
            next: 'Seguir',
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
    if (!engagementId) {
      setLoading(false);
      setErr(t.needEngagement);
      return;
    }
    setLoading(true);
    try {
      const q = new URLSearchParams({ companyId, engagementId });
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
  }, [companyId, engagementId, t.needCompany, t.needEngagement]);

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
        body: JSON.stringify({ companyId, engagementId, blockId, open: true, locale: loc }),
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
        body: JSON.stringify({ companyId, engagementId, blockId: activeId, message, locale: loc }),
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

  if (!companyId || !engagementId) {
    return (
      <div className="mx-auto max-w-lg space-y-4 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-8 text-center">
        <p className="text-sm text-amber-950">{!companyId ? t.needCompany : t.needEngagement}</p>
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

  const dossierHref = `/hub/aurora/dossie?${new URLSearchParams({
    company: companyId,
    engagement: engagementId,
  })}`;

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <header className="space-y-2">
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
            {progress.avgLevel != null ? (
              <p>
                {t.level}: {progress.avgLevel}
              </p>
            ) : null}
            <Link href={dossierHref} className="text-amber-900 hover:underline">
              {t.dossier}
            </Link>
          </div>
        </div>
      </header>

      {err && <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{err}</p>}

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
          <section className="flex min-h-[52vh] flex-col rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              {AURORA_DIAG_BLOCKS.find((b) => b.id === activeId)?.label[loc]}
            </p>
            <div ref={scroller} className="mt-3 flex-1 space-y-3 overflow-y-auto pr-1">
              {active.messages.map((m, i) => (
                <div
                  key={`${m.role}${i}`}
                  className={
                    m.role === 'assistant'
                      ? 'text-sm leading-relaxed text-slate-800'
                      : 'rounded-xl bg-amber-50 px-3 py-2 text-sm text-slate-900'
                  }
                >
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
                  void send();
                }
              }}
              placeholder={t.placeholder}
              rows={3}
              className="mt-3 w-full rounded-lg border px-3 py-2 text-sm"
            />
            <button
              type="button"
              disabled={busy || !talk.trim()}
              onClick={() => void send()}
              className="mt-2 self-end rounded-lg bg-amber-800 px-4 py-2 text-sm text-white disabled:opacity-40"
            >
              {t.send}
            </button>
          </section>

          <div className="space-y-4">
            {confirm ? (
              <section className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-amber-900">{t.confirm}</p>
                <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-500">{t.level}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {([1, 2, 3, 4, 5] as AuroraMaturity[]).map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setConfirm((c) => (c ? { ...c, level: n } : c))}
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                        confirm.level === n ? 'bg-amber-900 text-white' : 'bg-white text-slate-700 border'
                      }`}
                    >
                      {n} · {AURORA_MATURITY[n].short[loc]}
                    </button>
                  ))}
                </div>
                <p className="mt-1 text-[11px] text-slate-600">{AURORA_MATURITY[confirm.level].line[loc]}</p>
                <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-500">{t.situation}</p>
                <textarea
                  value={confirm.situation}
                  onChange={(e) => setConfirm((c) => (c ? { ...c, situation: e.target.value } : c))}
                  rows={4}
                  className="mt-1 w-full rounded-lg border bg-white px-3 py-2 text-sm"
                />
                <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-500">{t.gap}</p>
                <input
                  value={confirm.gap}
                  onChange={(e) => setConfirm((c) => (c ? { ...c, gap: e.target.value } : c))}
                  className="mt-1 w-full rounded-lg border bg-white px-3 py-1.5 text-sm"
                />
                <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-500">{t.pot}</p>
                <input
                  value={confirm.potential}
                  onChange={(e) => setConfirm((c) => (c ? { ...c, potential: e.target.value } : c))}
                  className="mt-1 w-full rounded-lg border bg-white px-3 py-1.5 text-sm"
                />
                <button
                  type="button"
                  disabled={busy || confirm.situation.trim().length < 12}
                  onClick={() => void saveConfirm()}
                  className="mt-4 rounded-lg bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-40"
                >
                  {t.next}
                </button>
              </section>
            ) : active.pending && !active.pending.ready ? (
              <section className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{t.next}</p>
                <p className="mt-2">{active.pending.reply}</p>
              </section>
            ) : active.status === 'done' ? (
              <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm">
                <p className="font-medium text-emerald-950">
                  {active.level ? AURORA_MATURITY[active.level].short[loc] : ''}
                </p>
                <p className="mt-2 whitespace-pre-wrap text-slate-700">{active.situation}</p>
                {active.gap ? (
                  <p className="mt-2 text-xs text-rose-800">
                    {t.gap}: {active.gap}
                  </p>
                ) : null}
                {active.potential ? (
                  <p className="mt-1 text-xs text-emerald-900">
                    {t.pot}: {active.potential}
                  </p>
                ) : null}
              </section>
            ) : null}

            <section className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{t.gap}</p>
              <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-slate-700">
                {AURORA_DIAG_BLOCKS.map((def) => {
                  const g = diagnostic.blocks[def.id]?.gap;
                  if (!g) return null;
                  return (
                    <li key={def.id}>
                      <span className="text-slate-400">{def.label[loc]}:</span> {g}
                    </li>
                  );
                })}
              </ul>
              <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-400">{t.pot}</p>
              <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-slate-700">
                {AURORA_DIAG_BLOCKS.map((def) => {
                  const p = diagnostic.blocks[def.id]?.potential;
                  if (!p) return null;
                  return (
                    <li key={def.id}>
                      <span className="text-slate-400">{def.label[loc]}:</span> {p}
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
