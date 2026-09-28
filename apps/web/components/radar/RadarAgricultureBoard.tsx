'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { fieldEntryKindLabel, type FieldEntryKind } from '@/lib/nexus-sector-modules';
import { AGRICULTURE_LINE_KINDS, type AgricultureLineKind } from '@/lib/radar/agriculture';

type Loc = 'pt' | 'es' | 'en';

type Alert = { code: string; severity: 'warning' | 'critical'; message: Record<Loc, string> };
type Parcel = {
  id: string;
  name: string;
  areaHa: number | null;
  crop: string | null;
  moisture: number | null;
  irrigationMm: number | null;
  lastLineAt: string | null;
  alerts: Alert[];
};
type Line = { id: string; kind: string; occurredAt: string; channel: string; note: string; unitName: string | null };
type Sensor = { id: string; name: string; metric: string; unitId: string | null; lastSeenAt: string | null };
type Rule = { kind: string; label: string; enabled: boolean };
type Board = {
  parcels: Parcel[];
  alerts: Alert[];
  lines: Line[];
  sensors: Sensor[];
  rules: Rule[];
  whatsapp: { phoneE164: string; lastInboundAt?: string | null; pendingCommandKind?: string | null } | null;
};

const COPY = {
  pt: {
    book: 'Caderno da parcela',
    parcel: 'Nova parcela',
    name: 'Nome',
    ha: 'Hectares',
    crop: 'Cultura',
    add: 'Criar parcela',
    line: 'Nova linha',
    kind: 'Tipo',
    note: 'Nota',
    mm: 'Milímetros',
    moisture: 'Humidade agora (%)',
    product: 'Produto',
    phi: 'Dias de carência',
    save: 'Registar',
    wa: 'WhatsApp da exploração',
    waHint: 'Entra anotação, sai alerta. Um telefone por empresa.',
    link: 'Ligar',
    unlink: 'Desligar',
    sensor: 'Sensor',
    sensorHint: 'O token aparece uma vez. O aparelho envia leituras para o ingest.',
    issue: 'Emitir token',
    alerts: 'Alertas',
    empty: 'Sem parcelas ainda.',
    none: 'Sem linhas no caderno.',
    moistureLbl: 'Humidade',
    irrigLbl: 'Última irrigação',
    rules: 'Automações',
  },
  es: {
    book: 'Cuaderno de la parcela',
    parcel: 'Nueva parcela',
    name: 'Nombre',
    ha: 'Hectáreas',
    crop: 'Cultivo',
    add: 'Crear parcela',
    line: 'Nueva línea',
    kind: 'Tipo',
    note: 'Nota',
    mm: 'Milímetros',
    moisture: 'Humedad ahora (%)',
    product: 'Producto',
    phi: 'Días de carencia',
    save: 'Registrar',
    wa: 'WhatsApp de la finca',
    waHint: 'Entra anotación, sale alerta. Un teléfono por empresa.',
    link: 'Vincular',
    unlink: 'Desvincular',
    sensor: 'Sensor',
    sensorHint: 'El token aparece una vez. El aparato envía lecturas al ingest.',
    issue: 'Emitir token',
    alerts: 'Alertas',
    empty: 'Sin parcelas todavía.',
    none: 'Sin líneas en el cuaderno.',
    moistureLbl: 'Humedad',
    irrigLbl: 'Último riego',
    rules: 'Automatizaciones',
  },
  en: {
    book: 'Parcel field book',
    parcel: 'New parcel',
    name: 'Name',
    ha: 'Hectares',
    crop: 'Crop',
    add: 'Create parcel',
    line: 'New line',
    kind: 'Type',
    note: 'Note',
    mm: 'Millimetres',
    moisture: 'Moisture now (%)',
    product: 'Product',
    phi: 'PHI days',
    save: 'Log',
    wa: 'Farm WhatsApp',
    waHint: 'Notes come in, alerts go out. One phone per company.',
    link: 'Link',
    unlink: 'Unlink',
    sensor: 'Sensor',
    sensorHint: 'The token is shown once. The device posts readings to ingest.',
    issue: 'Issue token',
    alerts: 'Alerts',
    empty: 'No parcels yet.',
    none: 'No field-book lines.',
    moistureLbl: 'Moisture',
    irrigLbl: 'Last irrigation',
    rules: 'Automations',
  },
} as const;

function kindLabel(kind: string, loc: Loc) {
  const known: FieldEntryKind[] = [...AGRICULTURE_LINE_KINDS, 'note', 'visit'];
  if ((known as string[]).includes(kind)) return fieldEntryKindLabel(kind as FieldEntryKind, loc);
  return kind;
}

function when(iso: string | null, loc: Loc) {
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
  const [areaHa, setAreaHa] = useState('');
  const [crop, setCrop] = useState('');
  const [unitId, setUnitId] = useState('');
  const [kind, setKind] = useState<AgricultureLineKind>('observation');
  const [note, setNote] = useState('');
  const [mm, setMm] = useState('');
  const [moisture, setMoisture] = useState('');
  const [product, setProduct] = useState('');
  const [phiDays, setPhiDays] = useState('7');
  const [phone, setPhone] = useState('');
  const [sensorName, setSensorName] = useState('');
  const [sensorUnit, setSensorUnit] = useState('');
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
      setUnitId((prev: string) => prev || d.parcels?.[0]?.id || '');
      setSensorUnit((prev: string) => prev || d.parcels?.[0]?.id || '');
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
      return d as { token?: string; ingestPath?: string };
    } finally {
      setBusy(false);
    }
  };

  const addParcel = async () => {
    await post({ action: 'parcel', name, areaHa, crop });
    setName('');
    setAreaHa('');
    setCrop('');
    await load();
  };

  const addLine = async () => {
    await post({
      action: 'line',
      unitId,
      kind,
      note,
      mm: kind === 'irrigation' ? mm : undefined,
      moisture: moisture || undefined,
      product: kind === 'input' ? product : undefined,
      phiDays: kind === 'input' ? phiDays : undefined,
    });
    setNote('');
    setMm('');
    setMoisture('');
    setProduct('');
    await load();
  };

  const addSensor = async () => {
    const d = await post({ action: 'sensor', name: sensorName, unitId: sensorUnit || undefined, metric: 'soil_moisture' });
    setSensorName('');
    if (d?.token) setIssued({ token: d.token, ingestPath: d.ingestPath || '/api/nexus/ingest/readings' });
    await load();
  };

  const savePhone = async (unlink = false) => {
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch('/api/nexus/whatsapp/link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, engagementId, phone, unlink }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Falha');
      if (unlink) setPhone('');
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro');
    } finally {
      setBusy(false);
    }
  };

  const toggleRule = async (ruleKind: string, enabled: boolean) => {
    await post({ action: 'rule', kind: ruleKind, enabled });
    await load();
  };

  if (loading && !board) {
    return (
      <div className="flex min-h-[30vh] items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-violet-700" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {err && <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{err}</p>}

      {(board?.alerts || []).length > 0 && (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-800">{copy.alerts}</p>
          <ul className="mt-1 space-y-1 text-sm text-amber-950">
            {board!.alerts.slice(0, 4).map((a) => (
              <li key={a.code}>{a.message[loc]}</li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {(board?.parcels || []).map((p) => {
          const hot = p.alerts.some((a) => a.severity === 'critical');
          return (
            <article
              key={p.id}
              className={`rounded-2xl border px-4 py-3 ${hot ? 'border-rose-300 bg-rose-50' : 'border-slate-200 bg-white'}`}
            >
              <p className="text-sm font-semibold text-slate-900">{p.name}</p>
              <p className="mt-0.5 text-xs text-slate-500">
                {[p.crop, p.areaHa != null ? `${p.areaHa} ha` : null].filter(Boolean).join(' · ') || '—'}
              </p>
              <p className="mt-2 text-xs text-slate-700">
                {copy.moistureLbl}: {p.moisture == null ? '—' : `${p.moisture}%`}
                {' · '}
                {copy.irrigLbl}: {p.irrigationMm == null ? '—' : `${p.irrigationMm} mm`}
              </p>
              {p.alerts[0] && <p className="mt-1 text-xs text-amber-900">{p.alerts[0].message[loc]}</p>}
            </article>
          );
        })}
        {!board?.parcels.length && <p className="text-sm text-slate-500">{copy.empty}</p>}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-sm font-semibold text-slate-900">{copy.parcel}</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder={copy.name} className="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
            <input value={areaHa} onChange={(e) => setAreaHa(e.target.value)} placeholder={copy.ha} inputMode="decimal" className="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
            <input value={crop} onChange={(e) => setCrop(e.target.value)} placeholder={copy.crop} className="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
          </div>
          <button type="button" disabled={busy || name.trim().length < 2} onClick={() => void addParcel().catch((e) => setErr(e.message))} className="mt-3 rounded-lg bg-violet-700 px-3 py-2 text-sm font-medium text-white disabled:opacity-50">
            {copy.add}
          </button>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-sm font-semibold text-slate-900">{copy.line}</p>
          <div className="mt-3 grid gap-2">
            <div className="grid gap-2 sm:grid-cols-2">
              <select value={unitId} onChange={(e) => setUnitId(e.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
                {(board?.parcels || []).map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              <select value={kind} onChange={(e) => setKind(e.target.value as AgricultureLineKind)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
                {AGRICULTURE_LINE_KINDS.map((k) => (
                  <option key={k} value={k}>{kindLabel(k, loc)}</option>
                ))}
              </select>
            </div>
            {kind === 'irrigation' && (
              <input value={mm} onChange={(e) => setMm(e.target.value)} placeholder={copy.mm} inputMode="decimal" className="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
            )}
            {kind === 'input' && (
              <div className="grid gap-2 sm:grid-cols-2">
                <input value={product} onChange={(e) => setProduct(e.target.value)} placeholder={copy.product} className="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
                <input value={phiDays} onChange={(e) => setPhiDays(e.target.value)} placeholder={copy.phi} inputMode="numeric" className="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
              </div>
            )}
            <input value={moisture} onChange={(e) => setMoisture(e.target.value)} placeholder={copy.moisture} inputMode="decimal" className="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder={copy.note} className="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
          </div>
          <button type="button" disabled={busy || !unitId} onClick={() => void addLine().catch((e) => setErr(e.message))} className="mt-3 rounded-lg bg-[#0c1222] px-3 py-2 text-sm font-medium text-white disabled:opacity-50">
            {copy.save}
          </button>
        </section>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <p className="text-sm font-semibold text-slate-900">{copy.book}</p>
        <ol className="mt-3 space-y-2">
          {(board?.lines || []).map((line) => (
            <li key={line.id} className="rounded-lg bg-slate-50 px-3 py-2">
              <p className="text-sm text-slate-800">{line.note || kindLabel(line.kind, loc)}</p>
              <p className="mt-0.5 text-[11px] text-slate-500">
                {when(line.occurredAt, loc)}
                {line.unitName ? ` · ${line.unitName}` : ''}
                {line.channel === 'whatsapp' ? ' · WhatsApp' : ''}
              </p>
            </li>
          ))}
          {!board?.lines.length && <li className="text-xs text-slate-500">{copy.none}</li>}
        </ol>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-sm font-semibold text-slate-900">{copy.wa}</p>
          <p className="mt-1 text-xs text-slate-500">{copy.waHint}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+55 11 99999-0000" className="min-w-[200px] flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm" />
            <button type="button" disabled={busy} onClick={() => void savePhone(false)} className="rounded-lg bg-[#0c1222] px-3 py-2 text-sm font-medium text-white disabled:opacity-50">{copy.link}</button>
            {board?.whatsapp && (
              <button type="button" disabled={busy} onClick={() => void savePhone(true)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700">{copy.unlink}</button>
            )}
          </div>
          {board?.whatsapp?.lastInboundAt && (
            <p className="mt-2 text-xs text-violet-900">
              {board.whatsapp.phoneE164} · {when(board.whatsapp.lastInboundAt, loc)}
            </p>
          )}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-sm font-semibold text-slate-900">{copy.sensor}</p>
          <p className="mt-1 text-xs text-slate-500">{copy.sensorHint}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <input value={sensorName} onChange={(e) => setSensorName(e.target.value)} placeholder={copy.sensor} className="min-w-[140px] flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm" />
            <select value={sensorUnit} onChange={(e) => setSensorUnit(e.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
              {(board?.parcels || []).map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <button type="button" disabled={busy || sensorName.trim().length < 2} onClick={() => void addSensor().catch((e) => setErr(e.message))} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">{copy.issue}</button>
          </div>
          {issued && (
            <p className="mt-2 break-all rounded-lg bg-slate-50 px-3 py-2 font-mono text-xs text-slate-800">
              {issued.token}
              <br />
              {issued.ingestPath}
            </p>
          )}
          <ul className="mt-3 space-y-1 text-xs text-slate-600">
            {(board?.sensors || []).map((s) => (
              <li key={s.id}>{s.name} · {s.metric}{s.lastSeenAt ? ` · ${when(s.lastSeenAt, loc)}` : ''}</li>
            ))}
          </ul>
          <div className="mt-3 flex flex-wrap gap-2">
            <p className="w-full text-[11px] font-semibold uppercase tracking-wide text-slate-500">{copy.rules}</p>
            {(board?.rules || []).map((rule) => (
              <button
                key={rule.kind}
                type="button"
                disabled={busy}
                onClick={() => void toggleRule(rule.kind, !rule.enabled).catch((e) => setErr(e.message))}
                className={`rounded-full border px-3 py-1 text-xs ${rule.enabled ? 'border-violet-600 bg-violet-50 text-violet-900' : 'border-slate-200 text-slate-600'}`}
              >
                {rule.label}: {rule.enabled ? 'on' : 'off'}
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
