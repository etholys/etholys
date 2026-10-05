'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Loader2, MessageCircle, Radio, Droplets, ShieldAlert, Sprout } from 'lucide-react';
import {
  DEFAULT_IRRIGATION_MM,
  MOISTURE_THRESHOLD,
  type AgricultureDecision,
  type ParcelAction,
} from '@/lib/radar/agriculture';
import { RadarChainBoard } from '@/components/radar/RadarChainBoard';
import { RadarSiteMap } from '@/components/radar/RadarSiteMap';
import { TRACE_STAGES, TRACE_STAGE_LABEL, type TraceStage } from '@/lib/radar/trace';

type Loc = 'pt' | 'es' | 'en';

type Alert = { code: string; severity: 'warning' | 'critical'; message: Record<Loc, string> };
type Parcel = {
  id: string;
  name: string;
  areaHa: number | null;
  crop: string | null;
  moisture: number | null;
  moistureAt: string | null;
  irrigationMm: number | null;
  irrigationAt: string | null;
  phiDaysLeft: number | null;
  phiProduct: string | null;
  harvestBlocked: boolean;
  nextAction: ParcelAction;
  alerts: Alert[];
};
type Line = { id: string; kind: string; occurredAt: string; channel: string; note: string; unitName: string | null };
type Board = {
  decision: AgricultureDecision;
  parcels: Parcel[];
  lines: Line[];
  sensors: Array<{ id: string; name: string; unitId?: string | null; lastValue: number | null; lastRecordedAt: string | null }>;
  rules: Array<{ kind: string; enabled: boolean }>;
  whatsapp: { phoneE164: string; lastInboundAt?: string | null; pendingCommandKind?: string | null } | null;
};

type LotSummary = {
  id: string;
  code: string;
  currentStage: TraceStage;
  status: string;
  sharePath: string;
  crop: string | null;
  qty: number | null;
};

const COPY = {
  pt: {
    live: 'Ao vivo',
    spaces: 'Espaços',
    channel: 'Canais',
    chain: 'Cadeia',
    wa: 'WhatsApp',
    sensor: 'Sensor',
    linkWa: 'Ligar',
    irrig: 'Registar irrigação',
    scout: 'Registar passagem',
    askWa: 'Pedir no WhatsApp',
    listening: 'A ouvir o campo',
    openLot: 'Abrir lote',
    noLot: 'Sem lote aberto',
    free: 'Livre',
    moisture: 'Humidade',
    irrigLabel: 'Última irrigação',
    phi: 'Carência',
    field: 'No campo',
    mm: 'mm',
    notePh: 'O que viste',
    walked: 'Registar',
  },
  es: {
    live: 'En vivo',
    spaces: 'Espacios',
    channel: 'Canales',
    chain: 'Cadena',
    wa: 'WhatsApp',
    sensor: 'Sensor',
    linkWa: 'Vincular',
    irrig: 'Registrar riego',
    scout: 'Registrar recorrido',
    askWa: 'Pedir al WhatsApp',
    listening: 'Escuchando el campo',
    openLot: 'Abrir lote',
    noLot: 'Sin lote abierto',
    free: 'Libre',
    moisture: 'Humedad',
    irrigLabel: 'Último riego',
    phi: 'Carencia',
    field: 'En el campo',
    mm: 'mm',
    notePh: 'Qué viste',
    walked: 'Registrar',
  },
  en: {
    live: 'Live',
    spaces: 'Spaces',
    channel: 'Channels',
    chain: 'Chain',
    wa: 'WhatsApp',
    sensor: 'Sensor',
    linkWa: 'Link',
    irrig: 'Log irrigation',
    scout: 'Log walk',
    askWa: 'Ask on WhatsApp',
    listening: 'Listening to the field',
    openLot: 'Open lot',
    noLot: 'No open lot',
    free: 'Clear',
    moisture: 'Moisture',
    irrigLabel: 'Last irrigation',
    phi: 'PHI',
    field: 'In the field',
    mm: 'mm',
    notePh: 'What you saw',
    walked: 'Log',
  },
} as const;

function when(iso: string | null | undefined, loc: Loc) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString(loc === 'es' ? 'es' : loc === 'en' ? 'en' : 'pt-BR', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function actionTone(action: ParcelAction) {
  if (action === 'irrigate' || action === 'hold_harvest') return 'critical';
  if (action === 'scout' || action === 'await_signal') return 'warn';
  return 'ok';
}

export function useRadarAgriculture(companyId: string, engagementId?: string | null, loc: Loc = 'pt') {
  const [board, setBoard] = useState<Board | null>(null);
  const [lots, setLots] = useState<LotSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!companyId) {
      setLoading(false);
      setErr(loc === 'es' ? 'Elegí una empresa.' : loc === 'en' ? 'Pick a company.' : 'Escolhe uma empresa.');
      return;
    }
    setLoading(true);
    setErr(null);
    try {
      const q = new URLSearchParams({ companyId });
      if (engagementId) q.set('engagementId', engagementId);
      const [ag, lt] = await Promise.all([
        fetch(`/api/radar/agriculture?${q}`),
        fetch(`/api/radar/lots?${q}`),
      ]);
      const ad = await ag.json();
      if (!ag.ok) throw new Error(ad.error || 'Falha');
      setBoard(ad);
      if (lt.ok) {
        const ld = await lt.json();
        setLots((ld.lots || []) as LotSummary[]);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro');
    } finally {
      setLoading(false);
    }
  }, [companyId, engagementId, loc]);

  useEffect(() => {
    void load();
  }, [load]);

  const post = async (payload: Record<string, unknown>) => {
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch('/api/radar/agriculture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, engagementId, ...payload }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Falha');
      return d;
    } finally {
      setBusy(false);
    }
  };

  return { board, lots, loading, err, setErr, busy, load, post };
}

export function RadarOpsView({
  companyId,
  engagementId,
  locale,
}: {
  companyId: string;
  engagementId?: string | null;
  locale: string;
}) {
  const loc: Loc = locale === 'es' || locale === 'en' ? locale : 'pt';
  const copy = COPY[loc];
  const { board, lots, loading, err, setErr, busy, load, post } = useRadarAgriculture(companyId, engagementId, loc);
  const [phone, setPhone] = useState('');
  const [mm, setMm] = useState(String(DEFAULT_IRRIGATION_MM));
  const [linking, setLinking] = useState(false);
  const [focusedId, setFocusedId] = useState<string | null>(null);

  useEffect(() => {
    if (board?.whatsapp?.phoneE164) setPhone(board.whatsapp.phoneE164);
  }, [board?.whatsapp?.phoneE164]);

  useEffect(() => {
    if (!board?.parcels?.length) return;
    const preferred = board.decision?.parcelId || board.parcels[0]?.id || null;
    setFocusedId((prev) => (prev && board.parcels.some((p) => p.id === prev) ? prev : preferred));
  }, [board?.parcels, board?.decision?.parcelId]);

  if (loading && !board) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-emerald-300" />
      </div>
    );
  }

  const decision = board?.decision;
  const parcels = board?.parcels || [];
  const focus = parcels.find((p) => p.id === focusedId) || parcels.find((p) => p.id === decision?.parcelId) || parcels[0];
  const openLot = lots.find((l) => l.status === 'open') || lots[0];
  const sensorLive =
    (board?.sensors || []).find((s) => s.unitId === focus?.id && s.lastValue != null) ||
    (board?.sensors || []).find((s) => s.lastValue != null);
  const irrigRule = board?.rules.find((r) => r.kind === 'irrigation');
  const alertRule = board?.rules.find((r) => r.kind === 'whatsapp_alerts');
  const mapSensors = (board?.sensors || []).map((s) => ({
    id: s.id,
    name: s.name,
    unitId: s.unitId ?? null,
    lastValue: s.lastValue,
  }));

  const savePhone = async () => {
    setLinking(true);
    setErr(null);
    try {
      const r = await fetch('/api/nexus/whatsapp/link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, engagementId, phone }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Falha');
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro');
    } finally {
      setLinking(false);
    }
  };

  return (
    <div className="space-y-6">
      {err && <p className="rounded-xl border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">{err}</p>}

      {/* Hero decisão */}
      {decision && (
        <section className="relative overflow-hidden rounded-[1.75rem] border border-white/10 bg-gradient-to-br from-white/[0.06] to-transparent px-6 py-7 sm:px-8">
          <div className="absolute inset-y-0 right-0 w-1/3 bg-[radial-gradient(ellipse_at_top_right,rgba(52,211,153,0.18),transparent_60%)]" />
          <div className="relative flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-2xl">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
                </span>
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/45">{copy.live}</p>
              </div>
              <h2 className="mt-2 font-serif text-3xl text-white sm:text-4xl">{decision.title[loc]}</h2>
              <p className="mt-2 text-sm leading-relaxed text-white/65">{decision.detail[loc]}</p>
            </div>
            {decision.code === 'irrigate' && (
              <div className="flex flex-wrap items-center gap-2">
                <input
                  value={mm}
                  onChange={(e) => setMm(e.target.value)}
                  className="w-20 rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm text-white"
                />
                <span className="text-xs text-white/45">{copy.mm}</span>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    void post({ action: 'line', kind: 'irrigation', unitId: focus?.id, mm: Number(mm) || DEFAULT_IRRIGATION_MM })
                      .then(() => load())
                      .catch((e) => setErr(e.message))
                  }
                  className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-[#04110c] disabled:opacity-50"
                >
                  {copy.irrig}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void post({ action: 'command', kind: 'irrigation' }).then(() => load()).catch((e) => setErr(e.message))}
                  className="rounded-xl border border-white/20 px-4 py-2 text-sm text-white/80"
                >
                  {copy.askWa}
                </button>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Planta 2D */}
      <RadarSiteMap
        companyId={companyId}
        engagementId={engagementId}
        locale={loc}
        moduleId="agriculture"
        mode="ops"
        parcels={parcels}
        sensors={mapSensors}
        focusedId={focus?.id || null}
        onFocus={setFocusedId}
      />

      {/* Métricas + espaços */}
      <div className="grid gap-4 lg:grid-cols-12">
        <div className="grid gap-3 sm:grid-cols-3 lg:col-span-5 lg:grid-cols-1">
          <Metric
            icon={<Droplets className="h-4 w-4" />}
            label={copy.moisture}
            value={focus?.moisture == null ? '—' : `${focus.moisture}%`}
            hint={focus?.moisture == null ? `≤ ${MOISTURE_THRESHOLD}%` : when(focus.moistureAt, loc)}
            tone={focus?.moisture != null && focus.moisture < MOISTURE_THRESHOLD ? 'warn' : 'ok'}
          />
          <Metric
            icon={<Sprout className="h-4 w-4" />}
            label={copy.irrigLabel}
            value={focus?.irrigationMm == null ? '—' : `${focus.irrigationMm} mm`}
            hint={when(focus?.irrigationAt, loc)}
          />
          <Metric
            icon={<ShieldAlert className="h-4 w-4" />}
            label={copy.phi}
            value={focus?.harvestBlocked && focus.phiDaysLeft != null ? `${focus.phiDaysLeft}d` : copy.free}
            hint={focus?.phiProduct || copy.free}
            tone={focus?.harvestBlocked ? 'critical' : 'ok'}
          />
        </div>

        <div className="lg:col-span-7">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/40">{copy.spaces}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {parcels.map((p) => {
              const tone = actionTone(p.nextAction);
              const width = p.moisture == null ? 8 : Math.max(6, Math.min(100, p.moisture));
              const isFocus = focus?.id === p.id;
              return (
                <article
                  key={p.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setFocusedId(p.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setFocusedId(p.id);
                    }
                  }}
                  className={`rounded-2xl border px-4 py-4 transition ${
                    isFocus ? 'ring-2 ring-emerald-300/70' : ''
                  } ${
                    tone === 'critical'
                      ? 'border-rose-400/30 bg-rose-500/10'
                      : tone === 'warn'
                        ? 'border-amber-400/25 bg-amber-500/10'
                        : 'border-white/10 bg-white/[0.04]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-base font-semibold text-white">{p.name}</p>
                      <p className="text-xs text-white/45">{[p.crop, p.areaHa != null ? `${p.areaHa} ha` : null].filter(Boolean).join(' · ') || '—'}</p>
                    </div>
                    <span className="rounded-full border border-white/15 px-2 py-0.5 text-[10px] uppercase tracking-wide text-white/70">
                      {labelAction(p.nextAction, loc)}
                    </span>
                  </div>
                  <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-black/30">
                    <div
                      className={`h-full rounded-full transition-all ${
                        p.moisture == null ? 'bg-white/20' : p.moisture < MOISTURE_THRESHOLD ? 'bg-amber-400' : 'bg-emerald-400'
                      }`}
                      style={{ width: `${width}%` }}
                    />
                  </div>
                  <dl className="mt-3 grid grid-cols-3 gap-2 text-[11px] text-white/60">
                    <div>
                      <dt className="text-white/35">{copy.moisture}</dt>
                      <dd className="font-medium text-white">{p.moisture == null ? '—' : `${p.moisture}%`}</dd>
                    </div>
                    <div>
                      <dt className="text-white/35">{copy.irrigLabel}</dt>
                      <dd className="font-medium text-white">{p.irrigationMm == null ? '—' : `${p.irrigationMm}`}</dd>
                    </div>
                    <div>
                      <dt className="text-white/35">{copy.phi}</dt>
                      <dd className="font-medium text-white">{p.harvestBlocked ? `${p.phiDaysLeft}d` : copy.free}</dd>
                    </div>
                  </dl>
                </article>
              );
            })}
          </div>
        </div>
      </div>

      {/* Canais + cadeia */}
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/40">{copy.channel}</p>
          <div className="mt-4 space-y-4">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-200">
                <MessageCircle className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-white">{copy.wa}</p>
                <p className="text-xs text-white/45">humedad 18 · riego 12 mm</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+54 9 …"
                    className="min-w-[160px] flex-1 rounded-xl border border-white/15 bg-black/25 px-3 py-2 text-sm text-white"
                  />
                  <button
                    type="button"
                    disabled={busy || linking}
                    onClick={() => void savePhone()}
                    className="rounded-xl bg-emerald-500/90 px-3 py-2 text-sm font-medium text-[#04110c]"
                  >
                    {copy.linkWa}
                  </button>
                </div>
                {board?.whatsapp && (
                  <p className="mt-1.5 text-xs text-white/50">
                    {board.whatsapp.phoneE164}
                    {board.whatsapp.lastInboundAt ? ` · ${when(board.whatsapp.lastInboundAt, loc)}` : ''}
                  </p>
                )}
                <div className="mt-2 flex flex-wrap gap-2">
                  {alertRule && (
                    <button
                      type="button"
                      onClick={() => void post({ action: 'rule', kind: 'whatsapp_alerts', enabled: !alertRule.enabled }).then(() => load())}
                      className={`rounded-full border px-2.5 py-1 text-[11px] ${alertRule.enabled ? 'border-emerald-400/40 text-emerald-100' : 'border-white/15 text-white/40'}`}
                    >
                      Alertas {alertRule.enabled ? 'on' : 'off'}
                    </button>
                  )}
                  {irrigRule && (
                    <button
                      type="button"
                      onClick={() => void post({ action: 'rule', kind: 'irrigation', enabled: !irrigRule.enabled }).then(() => load())}
                      className={`rounded-full border px-2.5 py-1 text-[11px] ${irrigRule.enabled ? 'border-emerald-400/40 text-emerald-100' : 'border-white/15 text-white/40'}`}
                    >
                      Auto-irrig {irrigRule.enabled ? 'on' : 'off'}
                    </button>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-start gap-3 border-t border-white/10 pt-4">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/15 text-violet-200">
                <Radio className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm font-medium text-white">{copy.sensor}</p>
                {sensorLive?.lastValue != null ? (
                  <p className="mt-1 text-sm text-white/70">
                    {sensorLive.name}: {sensorLive.lastValue}%
                    {sensorLive.lastRecordedAt ? ` · ${when(sensorLive.lastRecordedAt, loc)}` : ''}
                  </p>
                ) : (
                  <button
                    type="button"
                    disabled={busy || !focus}
                    onClick={() =>
                      void post({
                        action: 'sensor',
                        name: `${focus?.name || 'Campo'} humedad`,
                        unitId: focus?.id,
                        metric: 'soil_moisture',
                      }).then(() => load())
                    }
                    className="mt-1 text-sm text-white/45 underline-offset-2 hover:text-white hover:underline"
                  >
                    {copy.linkWa} aparelho
                  </button>
                )}
              </div>
            </div>
          </div>
        </section>

        <div className="space-y-3">
          {openLot ? (
            <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/40">{copy.chain}</p>
              <p className="mt-2 font-serif text-2xl text-white">{openLot.code}</p>
              <p className="text-xs text-white/50">
                {[openLot.crop, openLot.qty != null ? `${openLot.qty}` : null].filter(Boolean).join(' · ') || copy.listening}
              </p>
              <ol className="mt-4 grid grid-cols-4 gap-1.5">
                {TRACE_STAGES.map((s) => {
                  const cur = TRACE_STAGES.indexOf(openLot.currentStage);
                  const i = TRACE_STAGES.indexOf(s);
                  return (
                    <li
                      key={s}
                      className={`rounded-lg px-1 py-2 text-center text-[10px] ${
                        i <= cur ? 'bg-emerald-500/20 text-emerald-100' : 'bg-white/5 text-white/30'
                      }`}
                    >
                      {TRACE_STAGE_LABEL[s][loc]}
                    </li>
                  );
                })}
              </ol>
            </div>
          ) : (
            <div className="rounded-[1.5rem] border border-dashed border-white/15 px-5 py-6 text-sm text-white/45">{copy.noLot}</div>
          )}
          <RadarChainBoard
            companyId={companyId}
            engagementId={engagementId}
            locale={locale}
            unitId={focus?.id || null}
            unitCrop={focus?.crop || null}
            harvestBlocked={Boolean(focus?.harvestBlocked)}
          />
        </div>
      </div>

      <section>
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/40">{copy.field}</p>
        <ol className="mt-3 space-y-2">
          {(board?.lines || []).slice(0, 6).map((line) => (
            <li key={line.id} className="flex flex-wrap gap-x-3 text-sm text-white/70">
              <span className="text-white/35">{when(line.occurredAt, loc)}</span>
              <span>{line.note || line.kind}</span>
              {line.unitName && <span className="text-white/35">{line.unitName}</span>}
            </li>
          ))}
          {!board?.lines?.length && <p className="text-sm text-white/40">{copy.listening}</p>}
        </ol>
      </section>
    </div>
  );
}

/** @deprecated use RadarOpsView — single operational surface for all roles. */
export const RadarEmpresaView = RadarOpsView;

function Metric({
  icon,
  label,
  value,
  hint,
  tone = 'ok',
}: {
  icon: ReactNode;
  label: string;
  value: string;
  hint: string;
  tone?: 'ok' | 'warn' | 'critical';
}) {
  return (
    <div
      className={`rounded-2xl border px-4 py-4 ${
        tone === 'critical'
          ? 'border-rose-400/30 bg-rose-500/10'
          : tone === 'warn'
            ? 'border-amber-400/25 bg-amber-500/10'
            : 'border-white/10 bg-white/[0.04]'
      }`}
    >
      <div className="flex items-center gap-2 text-white/45">
        {icon}
        <p className="text-[11px] uppercase tracking-wide">{label}</p>
      </div>
      <p className="mt-2 font-serif text-3xl text-white">{value}</p>
      <p className="mt-1 text-xs text-white/45">{hint}</p>
    </div>
  );
}

function labelAction(action: ParcelAction, loc: Loc) {
  if (action === 'irrigate') return loc === 'es' ? 'Irrigar' : loc === 'en' ? 'Irrigate' : 'Irrigar';
  if (action === 'hold_harvest') return loc === 'es' ? 'No cosechar' : loc === 'en' ? 'Hold' : 'Não colher';
  if (action === 'scout') return loc === 'es' ? 'Recorrer' : loc === 'en' ? 'Walk' : 'Percorrer';
  if (action === 'await_signal') return loc === 'es' ? 'Escuchar' : loc === 'en' ? 'Listen' : 'Ouvir';
  return loc === 'es' ? 'OK' : 'OK';
}
