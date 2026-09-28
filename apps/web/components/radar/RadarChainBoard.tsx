'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { TRACE_STAGES, TRACE_STAGE_LABEL, type TraceStage } from '@/lib/radar/trace';

type Loc = 'pt' | 'es' | 'en';

type LotSummary = {
  id: string;
  code: string;
  crop: string | null;
  qty: number | null;
  unitLabel: string;
  status: string;
  currentStage: TraceStage;
  nextStage: TraceStage | null;
  unitId: string | null;
  unitName: string | null;
  createdAt: string;
  sharePath: string;
};

const COPY = {
  pt: {
    title: 'Cadeia',
    empty: 'Ainda sem colheita — o lote nasce na primeira colheita.',
    open: 'Abrir lote na colheita',
    qty: 'Quantidade',
    crop: 'Cultura',
    advance: 'Avançar',
    note: 'Nota',
    dest: 'Destino',
    buyer: 'Comprador',
    carrier: 'Transportista',
    copy: 'Copiar link',
    copied: 'Link copiado',
    closed: 'Fechado',
    openStatus: 'Aberto',
    where: 'Onde está este lote, agora?',
    blocked: 'Carência ativa — não é possível colher.',
  },
  es: {
    title: 'Cadena',
    empty: 'Todavía sin cosecha — el lote nace en la primera cosecha.',
    open: 'Abrir lote en la cosecha',
    qty: 'Cantidad',
    crop: 'Cultivo',
    advance: 'Avanzar',
    note: 'Nota',
    dest: 'Destino',
    buyer: 'Comprador',
    carrier: 'Transportista',
    copy: 'Copiar enlace',
    copied: 'Enlace copiado',
    closed: 'Cerrado',
    openStatus: 'Abierto',
    where: '¿Dónde está este lote, ahora?',
    blocked: 'Carencia activa — no se puede cosechar.',
  },
  en: {
    title: 'Chain',
    empty: 'No harvest yet — the lot starts at the first harvest.',
    open: 'Open lot at harvest',
    qty: 'Quantity',
    crop: 'Crop',
    advance: 'Advance',
    note: 'Note',
    dest: 'Destination',
    buyer: 'Buyer',
    carrier: 'Carrier',
    copy: 'Copy link',
    copied: 'Link copied',
    closed: 'Closed',
    openStatus: 'Open',
    where: 'Where is this lot, now?',
    blocked: 'PHI active — harvest blocked.',
  },
} as const;

function stageLabel(stage: TraceStage, loc: Loc) {
  return TRACE_STAGE_LABEL[stage][loc];
}

export function RadarChainBoard({
  companyId,
  engagementId,
  locale,
  unitId,
  unitCrop,
  harvestBlocked,
}: {
  companyId: string;
  engagementId?: string | null;
  locale: string;
  unitId?: string | null;
  unitCrop?: string | null;
  harvestBlocked?: boolean;
}) {
  const loc: Loc = locale === 'es' || locale === 'en' ? locale : 'pt';
  const copy = COPY[loc];
  const [lots, setLots] = useState<LotSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [qty, setQty] = useState('');
  const [crop, setCrop] = useState('');
  const [advanceNote, setAdvanceNote] = useState('');
  const [extra, setExtra] = useState('');
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    if (!companyId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setErr(null);
    try {
      const q = new URLSearchParams({ companyId });
      if (engagementId) q.set('engagementId', engagementId);
      const r = await fetch(`/api/radar/lots?${q}`);
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Falha');
      const list = (d.lots || []) as LotSummary[];
      setLots(list);
      setFocusId((prev) => {
        if (prev && list.some((l) => l.id === prev)) return prev;
        const open = list.find((l) => l.status === 'open');
        return open?.id || list[0]?.id || null;
      });
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro');
    } finally {
      setLoading(false);
    }
  }, [companyId, engagementId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (unitCrop && !crop) setCrop(unitCrop);
  }, [unitCrop, crop]);

  const focus = lots.find((l) => l.id === focusId) || lots[0] || null;

  const openLot = async () => {
    if (!unitId) return;
    if (harvestBlocked) {
      setErr(copy.blocked);
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch('/api/radar/lots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          engagementId,
          action: 'open_from_harvest',
          unitId,
          qty: qty ? Number(qty) : null,
          crop: crop.trim() || unitCrop || null,
          note: '',
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Falha');
      setQty('');
      await load();
      if (d.lot?.id) setFocusId(d.lot.id);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro');
    } finally {
      setBusy(false);
    }
  };

  const advance = async () => {
    if (!focus?.nextStage) return;
    setBusy(true);
    setErr(null);
    try {
      const payload: Record<string, unknown> = {
        companyId,
        engagementId,
        action: 'advance',
        lotId: focus.id,
        stage: focus.nextStage,
        note: advanceNote.trim(),
      };
      if (focus.nextStage === 'transport') {
        payload.carrier = extra.trim() || undefined;
        payload.destination = extra.trim() || undefined;
      }
      if (focus.nextStage === 'sale') payload.buyer = extra.trim() || undefined;
      if (focus.nextStage === 'transform') payload.destination = extra.trim() || undefined;

      const r = await fetch('/api/radar/lots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Falha');
      setAdvanceNote('');
      setExtra('');
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro');
    } finally {
      setBusy(false);
    }
  };

  const copyLink = async () => {
    if (!focus?.sharePath) return;
    const url = `${window.location.origin}${focus.sharePath}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setErr(url);
    }
  };

  if (loading && lots.length === 0) {
    return (
      <section className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-white/45">{copy.title}</p>
        <div className="mt-3 flex justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-violet-300" />
        </div>
      </section>
    );
  }

  const extraPh =
    focus?.nextStage === 'sale'
      ? copy.buyer
      : focus?.nextStage === 'transport'
        ? copy.carrier
        : focus?.nextStage === 'transform'
          ? copy.dest
          : '';

  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-white/45">{copy.title}</p>
      <p className="mt-1 text-sm text-white/55">{copy.where}</p>
      {err && <p className="mt-2 text-sm text-rose-200">{err}</p>}

      {lots.length === 0 ? (
        <p className="mt-3 text-sm text-white/50">{copy.empty}</p>
      ) : (
        <div className="mt-3 space-y-3">
          <div className="flex flex-wrap gap-2">
            {lots.slice(0, 8).map((lot) => (
              <button
                key={lot.id}
                type="button"
                onClick={() => setFocusId(lot.id)}
                className={`rounded-lg border px-3 py-1.5 text-xs ${
                  focus?.id === lot.id ? 'border-violet-400/50 bg-violet-500/15 text-white' : 'border-white/15 text-white/60'
                }`}
              >
                {lot.code}
                {lot.status === 'closed' ? ` · ${copy.closed}` : ''}
              </button>
            ))}
          </div>

          {focus && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div>
                  <p className="font-serif text-2xl text-white">{focus.code}</p>
                  <p className="text-xs text-white/50">
                    {[focus.crop, focus.qty != null ? `${focus.qty} ${focus.unitLabel}` : null, focus.unitName]
                      .filter(Boolean)
                      .join(' · ') || copy.openStatus}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void copyLink()}
                  className="rounded-lg border border-white/20 px-3 py-1.5 text-xs text-white/80"
                >
                  {copied ? copy.copied : copy.copy}
                </button>
              </div>

              <ol className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {TRACE_STAGES.map((stage) => {
                  const idx = TRACE_STAGES.indexOf(stage);
                  const cur = TRACE_STAGES.indexOf(focus.currentStage);
                  const done = idx <= cur;
                  const current = stage === focus.currentStage;
                  return (
                    <li
                      key={stage}
                      className={`rounded-lg border px-2 py-2 text-center text-[11px] ${
                        current
                          ? 'border-emerald-400/40 bg-emerald-500/10 text-emerald-100'
                          : done
                            ? 'border-white/20 text-white/70'
                            : 'border-white/10 text-white/35'
                      }`}
                    >
                      {stageLabel(stage, loc)}
                    </li>
                  );
                })}
              </ol>

              {focus.nextStage && focus.status === 'open' && (
                <div className="flex flex-wrap gap-2">
                  <input
                    value={advanceNote}
                    onChange={(e) => setAdvanceNote(e.target.value)}
                    placeholder={copy.note}
                    className="min-w-[140px] flex-1 rounded-lg border px-3 py-2 text-sm"
                  />
                  {extraPh && (
                    <input
                      value={extra}
                      onChange={(e) => setExtra(e.target.value)}
                      placeholder={extraPh}
                      className="min-w-[140px] flex-1 rounded-lg border px-3 py-2 text-sm"
                    />
                  )}
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void advance()}
                    className="rounded-lg bg-violet-500 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                  >
                    {copy.advance}: {stageLabel(focus.nextStage, loc)}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {unitId && (
        <div className="mt-4 border-t border-white/10 pt-3">
          <div className="flex flex-wrap gap-2">
            <input
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              placeholder={copy.qty}
              inputMode="decimal"
              className="w-28 rounded-lg border px-3 py-2 text-sm"
            />
            <input
              value={crop}
              onChange={(e) => setCrop(e.target.value)}
              placeholder={copy.crop}
              className="min-w-[120px] flex-1 rounded-lg border px-3 py-2 text-sm"
            />
            <button
              type="button"
              disabled={busy || harvestBlocked}
              onClick={() => void openLot()}
              className="rounded-lg border border-white/20 px-4 py-2 text-sm text-white/80 disabled:opacity-40"
              title={harvestBlocked ? copy.blocked : undefined}
            >
              {copy.open}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
