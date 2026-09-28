'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import {
  DEFAULT_IRRIGATION_MM,
  MOISTURE_THRESHOLD,
  type AgricultureDecision,
  type AgricultureLineKind,
  type ParcelAction,
} from '@/lib/radar/agriculture';
import { RadarChainBoard } from '@/components/radar/RadarChainBoard';

type Loc = 'pt' | 'es' | 'en';

type Alert = { code: string; severity: 'warning' | 'critical'; message: Record<Loc, string> };
type Parcel = {
  id: string;
  name: string;
  areaHa: number | null;
  crop: string | null;
  moisture: number | null;
  moistureAt: string | null;
  moistureSource: string | null;
  irrigationMm: number | null;
  irrigationAt: string | null;
  lastLineAt: string | null;
  phiDaysLeft: number | null;
  phiProduct: string | null;
  harvestBlocked: boolean;
  nextAction: ParcelAction;
  alerts: Alert[];
};
type Line = { id: string; kind: string; occurredAt: string; channel: string; note: string; unitName: string | null };
type Sensor = {
  id: string;
  name: string;
  metric: string;
  unitId: string | null;
  lastSeenAt: string | null;
  lastValue: number | null;
  lastRecordedAt: string | null;
};
type Rule = { kind: string; label: string; enabled: boolean };
type Board = {
  decision: AgricultureDecision;
  parcels: Parcel[];
  lines: Line[];
  sensors: Sensor[];
  rules: Rule[];
  whatsapp: {
    phoneE164: string;
    lastInboundAt?: string | null;
    lastOutboundAt?: string | null;
    pendingCommandKind?: string | null;
  } | null;
  whatsappConfigured?: boolean;
};

const COPY = {
  pt: {
    today: 'Hoje',
    irrigated: 'Já irriguei',
    askWa: 'Pedir no WhatsApp',
    walked: 'Percorri',
    notePh: 'O que viste no campo',
    mm: 'mm',
    wa: 'Canal do campo',
    link: 'Ligar WhatsApp',
    sensor: 'Sensor',
    issue: 'Ligar aparelho',
    book: 'No campo',
    waiting: 'À espera da primeira linha — humidade 18 ou irrigação 12 mm.',
    irrigOn: 'Irrigação automática',
    alertsOn: 'Alertas WhatsApp',
    more: 'Outra parcela',
    harvest: 'Não colher',
    criterion: 'Em critério',
    dry: 'Irrigar',
    walk: 'Percorrer',
    listen: 'A ouvir',
    moisture: 'Humidade',
    lastIrrig: 'Última irrigação',
    phi: 'Carência',
    free: 'Livre',
    noRead: 'Sem leitura',
    examples: 'O campo escreve',
    open: 'Abrir',
    parcelPh: 'Nome',
  },
  es: {
    today: 'Hoy',
    irrigated: 'Ya regué',
    askWa: 'Pedir al WhatsApp',
    walked: 'Recorrí',
    notePh: 'Qué viste en el campo',
    mm: 'mm',
    wa: 'Canal del campo',
    link: 'Vincular WhatsApp',
    sensor: 'Sensor',
    issue: 'Ligar aparato',
    book: 'En el campo',
    waiting: 'Esperando la primera línea — humedad 18 o riego 12 mm.',
    irrigOn: 'Riego automático',
    alertsOn: 'Alertas WhatsApp',
    more: 'Otra parcela',
    harvest: 'No cosechar',
    criterion: 'En criterio',
    dry: 'Irrigar',
    walk: 'Recorrer',
    listen: 'Escuchando',
    moisture: 'Humedad',
    lastIrrig: 'Último riego',
    phi: 'Carencia',
    free: 'Libre',
    noRead: 'Sin lectura',
    examples: 'El campo escribe',
    open: 'Abrir',
    parcelPh: 'Nombre',
  },
  en: {
    today: 'Today',
    irrigated: 'Already irrigated',
    askWa: 'Ask on WhatsApp',
    walked: 'Walked it',
    notePh: 'What you saw in the field',
    mm: 'mm',
    wa: 'Field channel',
    link: 'Link WhatsApp',
    sensor: 'Sensor',
    issue: 'Connect device',
    book: 'In the field',
    waiting: 'Waiting for the first line — moisture 18 or irrigation 12 mm.',
    irrigOn: 'Auto irrigation',
    alertsOn: 'WhatsApp alerts',
    more: 'Another parcel',
    harvest: 'Do not harvest',
    criterion: 'On criterion',
    dry: 'Irrigate',
    walk: 'Walk',
    listen: 'Listening',
    moisture: 'Moisture',
    lastIrrig: 'Last irrigation',
    phi: 'PHI',
    free: 'Clear',
    noRead: 'No reading',
    examples: 'The field texts',
    open: 'Open',
    parcelPh: 'Name',
  },
} as const;

function when(iso: string | null | undefined, loc: Loc) {
  if (!iso) return '';
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

function actionLabel(action: ParcelAction, loc: Loc) {
  if (action === 'irrigate') return COPY[loc].dry;
  if (action === 'hold_harvest') return COPY[loc].harvest;
  if (action === 'scout') return COPY[loc].walk;
  if (action === 'await_signal') return COPY[loc].listen;
  return COPY[loc].criterion;
}

function lineLabel(line: Line, loc: Loc) {
  if (line.note) return line.note;
  if (line.kind === 'irrigation') return loc === 'es' ? 'Riego' : loc === 'en' ? 'Irrigation' : 'Irrigação';
  if (line.kind === 'input') return loc === 'es' ? 'Insumo' : 'Insumo';
  return loc === 'es' ? 'Observación' : loc === 'en' ? 'Observation' : 'Observação';
}

export function RadarAgricultureBoard({
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
  const [board, setBoard] = useState<Board | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState('');
  const [mm, setMm] = useState(String(DEFAULT_IRRIGATION_MM));
  const [note, setNote] = useState('');
  const [phone, setPhone] = useState('');
  const [showSensor, setShowSensor] = useState(false);
  const [showParcel, setShowParcel] = useState(false);
  const [issued, setIssued] = useState<{ token: string; ingestPath: string } | null>(null);

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
      const r = await fetch(`/api/radar/agriculture?${q}`);
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Falha');
      setBoard(d);
      if (d.whatsapp?.phoneE164) setPhone(d.whatsapp.phoneE164);
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
      return d as { token?: string; ingestPath?: string; command?: { sent?: boolean } };
    } finally {
      setBusy(false);
    }
  };

  const logLine = async (kind: AgricultureLineKind, extra?: Record<string, unknown>) => {
    const unitId = extra?.unitId || board?.decision.parcelId || board?.parcels[0]?.id;
    if (!unitId) return;
    await post({ action: 'line', unitId, kind, ...extra });
    setNote('');
    await load();
  };

  const askIrrigation = async () => {
    await post({ action: 'command', kind: 'irrigation' });
    await load();
  };

  const savePhone = async () => {
    setBusy(true);
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
      setBusy(false);
    }
  };

  const addSensor = async () => {
    const unitId = board?.decision.parcelId || board?.parcels[0]?.id;
    const d = await post({
      action: 'sensor',
      name: (board?.parcels.find((p) => p.id === unitId)?.name || 'Campo') + ' humedad',
      unitId,
      metric: 'soil_moisture',
    });
    if (d?.token) setIssued({ token: d.token, ingestPath: d.ingestPath || '/api/nexus/ingest/readings' });
    await load();
  };

  const toggleRule = async (kind: string, enabled: boolean) => {
    await post({ action: 'rule', kind, enabled });
    await load();
  };

  if (loading && !board) {
    return (
      <div className="flex min-h-[30vh] items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-violet-300" />
      </div>
    );
  }

  const decision = board?.decision;
  const parcels = board?.parcels || [];
  const focus = parcels.find((p) => p.id === decision?.parcelId) || parcels[0];
  const liveSensor = (board?.sensors || []).find((s) => s.lastValue != null) || board?.sensors[0];
  const irrigRule = board?.rules.find((r) => r.kind === 'irrigation');
  const alertRule = board?.rules.find((r) => r.kind === 'whatsapp_alerts');
  const phi = parcels.find((p) => p.harvestBlocked);

  return (
    <div className="space-y-5">
      {err && <p className="rounded-lg border border-rose-400/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">{err}</p>}

      {decision && (
        <section
          className={`rounded-2xl border px-5 py-5 ${
            decision.severity === 'critical'
              ? 'border-rose-400/40 bg-rose-500/10'
              : decision.severity === 'ok'
                ? 'border-emerald-400/25 bg-emerald-500/10'
                : 'border-amber-400/30 bg-amber-500/10'
          }`}
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/50">{copy.today}</p>
          <h2 className="mt-1 font-serif text-3xl text-white">{decision.title[loc]}</h2>
          <p className="mt-2 max-w-2xl text-sm text-white/70">{decision.detail[loc]}</p>

          {decision.code === 'irrigate' && (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <input value={mm} onChange={(e) => setMm(e.target.value)} inputMode="decimal" className="w-24 rounded-lg border px-3 py-2 text-sm" />
              <span className="text-xs text-white/50">{copy.mm}</span>
              <button type="button" disabled={busy} onClick={() => void logLine('irrigation', { mm: Number(mm) || DEFAULT_IRRIGATION_MM }).catch((e) => setErr(e.message))} className="rounded-lg bg-violet-500 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
                {copy.irrigated}
              </button>
              <button type="button" disabled={busy} onClick={() => void askIrrigation().catch((e) => setErr(e.message))} className="rounded-lg border border-white/20 px-4 py-2 text-sm text-white/80 disabled:opacity-50">
                {copy.askWa}
              </button>
            </div>
          )}

          {(decision.code === 'scout' || decision.code === 'await_signal') && (
            <div className="mt-4 flex flex-wrap gap-2">
              <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={copy.notePh} className="min-w-[200px] flex-1 rounded-lg border px-3 py-2 text-sm" />
              <button type="button" disabled={busy || !note.trim()} onClick={() => void logLine('observation', { note: note.trim() }).catch((e) => setErr(e.message))} className="rounded-lg border border-white/20 px-4 py-2 text-sm text-white/80 disabled:opacity-50">
                {copy.walked}
              </button>
            </div>
          )}
        </section>
      )}

      <RadarChainBoard
        companyId={companyId}
        engagementId={engagementId}
        locale={locale}
        unitId={focus?.id || null}
        unitCrop={focus?.crop || null}
        harvestBlocked={Boolean(focus?.harvestBlocked)}
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-4">
          <p className="text-[11px] uppercase tracking-wide text-white/40">{copy.moisture}</p>
          <p className="mt-1 font-serif text-3xl text-white">{focus?.moisture == null ? '—' : `${focus.moisture}%`}</p>
          <p className="mt-1 text-xs text-white/45">
            {focus?.moisture == null ? copy.noRead : when(focus.moistureAt, loc) || copy.noRead}
            {' · '}
            {MOISTURE_THRESHOLD}%
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-4">
          <p className="text-[11px] uppercase tracking-wide text-white/40">{copy.lastIrrig}</p>
          <p className="mt-1 font-serif text-3xl text-white">{focus?.irrigationMm == null ? '—' : `${focus.irrigationMm} mm`}</p>
          <p className="mt-1 text-xs text-white/45">{when(focus?.irrigationAt, loc) || copy.noRead}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-4">
          <p className="text-[11px] uppercase tracking-wide text-white/40">{copy.phi}</p>
          <p className="mt-1 font-serif text-3xl text-white">{phi?.phiDaysLeft != null ? `${phi.phiDaysLeft}d` : copy.free}</p>
          <p className="mt-1 text-xs text-white/45">{phi?.phiProduct || copy.free}</p>
        </div>
      </div>

      {parcels.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          {parcels.map((p) => {
            const hot = p.nextAction === 'hold_harvest' || p.nextAction === 'irrigate';
            const width = p.moisture == null ? 0 : Math.max(4, Math.min(100, p.moisture));
            return (
              <article key={p.id} className={`rounded-2xl border px-4 py-4 ${hot ? 'border-white/25 bg-white/[0.06]' : 'border-white/10 bg-white/[0.03]'}`}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-white">{p.name}</p>
                    <p className="text-xs text-white/45">{p.crop || (p.areaHa != null ? `${p.areaHa} ha` : copy.listen)}</p>
                  </div>
                  <span className="rounded-full border border-white/15 px-2 py-0.5 text-[11px] text-white/70">{actionLabel(p.nextAction, loc)}</span>
                </div>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
                  <div className={`h-full ${p.moisture == null ? 'bg-white/20' : p.moisture < MOISTURE_THRESHOLD ? 'bg-amber-400' : 'bg-emerald-400/80'}`} style={{ width: `${p.moisture == null ? 8 : width}%` }} />
                </div>
                <dl className="mt-3 grid grid-cols-3 gap-2 text-xs text-white/65">
                  <div>
                    <dt className="text-white/35">{copy.moisture}</dt>
                    <dd>{p.moisture == null ? '—' : `${p.moisture}%`}</dd>
                  </div>
                  <div>
                    <dt className="text-white/35">{copy.lastIrrig}</dt>
                    <dd>{p.irrigationMm == null ? '—' : `${p.irrigationMm} mm`}</dd>
                  </div>
                  <div>
                    <dt className="text-white/35">{copy.phi}</dt>
                    <dd>{p.harvestBlocked && p.phiDaysLeft != null ? `${p.phiDaysLeft}d` : copy.free}</dd>
                  </div>
                </dl>
              </article>
            );
          })}
        </div>
      )}

      <section className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-white/45">{copy.wa}</p>
        <p className="mt-1 text-sm text-white/55">{copy.examples}: <span className="text-white/80">humedad 18</span> · <span className="text-white/80">riego 12 mm</span></p>
        <div className="mt-3 flex flex-wrap gap-2">
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+54 9 …" className="min-w-[200px] flex-1 rounded-lg border px-3 py-2 text-sm" />
          <button type="button" disabled={busy} onClick={() => void savePhone()} className="rounded-lg bg-violet-500 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
            {copy.link}
          </button>
        </div>
        {board?.whatsapp && (
          <p className="mt-2 text-xs text-white/55">
            {board.whatsapp.phoneE164}
            {board.whatsapp.lastInboundAt ? ` · ${when(board.whatsapp.lastInboundAt, loc)}` : ''}
            {board.whatsapp.pendingCommandKind ? (loc === 'es' ? ' · esperando SI para riego' : loc === 'en' ? ' · waiting YES' : ' · à espera de SIM') : ''}
          </p>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          {alertRule && (
            <button type="button" disabled={busy} onClick={() => void toggleRule('whatsapp_alerts', !alertRule.enabled).catch((e) => setErr(e.message))} className={`rounded-full border px-3 py-1 text-[11px] ${alertRule.enabled ? 'border-violet-400/40 text-violet-100' : 'border-white/15 text-white/45'}`}>
              {copy.alertsOn}: {alertRule.enabled ? 'on' : 'off'}
            </button>
          )}
          {irrigRule && (
            <button type="button" disabled={busy} onClick={() => void toggleRule('irrigation', !irrigRule.enabled).catch((e) => setErr(e.message))} className={`rounded-full border px-3 py-1 text-[11px] ${irrigRule.enabled ? 'border-violet-400/40 text-violet-100' : 'border-white/15 text-white/45'}`}>
              {copy.irrigOn}: {irrigRule.enabled ? 'on' : 'off'}
            </button>
          )}
        </div>
        <div className="mt-4 border-t border-white/10 pt-3">
          <p className="text-[11px] uppercase tracking-wide text-white/40">{copy.sensor}</p>
          {liveSensor?.lastValue != null ? (
            <p className="mt-1 text-sm text-white/80">{liveSensor.name}: {liveSensor.lastValue}%{liveSensor.lastRecordedAt ? ` · ${when(liveSensor.lastRecordedAt, loc)}` : ''}</p>
          ) : showSensor ? (
            <div className="mt-2 space-y-2">
              <button type="button" disabled={busy} onClick={() => void addSensor().catch((e) => setErr(e.message))} className="rounded-lg border border-white/20 px-3 py-2 text-sm text-white/80">{copy.issue}</button>
              {issued && <p className="break-all font-mono text-[11px] text-white/45">{issued.token}<br />{issued.ingestPath}</p>}
            </div>
          ) : (
            <button type="button" onClick={() => setShowSensor(true)} className="mt-1 text-sm text-white/45 hover:text-white">{copy.issue}</button>
          )}
        </div>
      </section>

      <section>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-white/45">{copy.book}</p>
        {(board?.lines || []).length ? (
          <ol className="mt-2 space-y-1">
            {board!.lines.slice(0, 8).map((line) => (
              <li key={line.id} className="flex flex-wrap gap-x-2 text-sm text-white/75">
                <span className="text-white/40">{when(line.occurredAt, loc)}</span>
                <span>{lineLabel(line, loc)}</span>
                {line.unitName && <span className="text-white/40">{line.unitName}</span>}
                {line.channel === 'whatsapp' && <span className="text-white/40">WhatsApp</span>}
              </li>
            ))}
          </ol>
        ) : (
          <p className="mt-2 text-sm text-white/45">{copy.waiting}</p>
        )}
      </section>

      <button type="button" onClick={() => setShowParcel(!showParcel)} className="text-xs text-white/35 hover:text-white/70">{copy.more}</button>
      {showParcel && (
        <div className="flex flex-wrap gap-2">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder={copy.parcelPh} className="min-w-[160px] rounded-lg border px-3 py-2 text-sm" />
          <button
            type="button"
            disabled={busy || name.trim().length < 2}
            onClick={() => void post({ action: 'open', name: name.trim() }).then(() => { setName(''); setShowParcel(false); return load(); }).catch((e) => setErr(e.message))}
            className="rounded-lg border border-white/20 px-3 py-2 text-sm text-white/80"
          >
            {copy.open}
          </button>
        </div>
      )}
    </div>
  );
}
