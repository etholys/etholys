'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Loader2, Radio, Smartphone, Thermometer, Zap } from 'lucide-react';
import { useApp } from '@/app/providers';
import { touchRunwayChapter } from '@/lib/nexus-runway';
import { L, type L3 } from '@/lib/nexus-sector-modules';

type Alert = { id?: string; title?: string; summary?: string; severity?: string };
type Entry = {
  id: string;
  kind: string;
  occurredAt: string;
  channel?: string;
  fromPhone?: string | null;
  payloadJson?: { note?: string };
  unit?: { name: string } | null;
  author?: { name: string | null } | null;
};
type Reading = {
  id: string;
  metric: string;
  value: number;
  unit: string;
  recordedAt: string;
  source: string;
  sensor?: { name: string } | null;
};
type Rule = { id: string; kind: string; label: string; enabled: boolean; lastCommandAt?: string | null };
type Summary = {
  module: {
    intro: L3;
    unitLabel: L3;
    namePlaceholder: L3;
    showAreaHa?: boolean;
    qtyLabel?: L3 | null;
    cropLabel?: L3 | null;
    metrics: Array<{ id: string; label: L3 }>;
  };
  units: Array<{ id: string; name: string }>;
  sensors: Array<{ id: string; name: string; metric: string; lastSeenAt: string | null }>;
  readings: Reading[];
  alerts: Alert[];
  latestDiagnosis: { id: string; overall: number } | null;
  whatsapp?: {
    configured: boolean;
    link: { phoneE164: string; lastInboundAt?: string | null; pendingCommandKind?: string | null } | null;
  };
  rules?: Rule[];
};

function qs(companyId: string, engagementId?: string | null) {
  const p = new URLSearchParams({ companyId });
  if (engagementId) p.set('engagementId', engagementId);
  return p.toString();
}

function locOf(locale: string): 'pt' | 'es' | 'en' {
  return locale === 'es' || locale === 'en' ? locale : 'pt';
}

function noteOf(entry: Entry): string {
  return String(entry.payloadJson?.note || entry.kind).trim();
}

function when(iso: string, loc: 'pt' | 'es' | 'en') {
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

export function NexusOpsWorkspace(_props?: { view?: 'campo' | 'monitor' }) {
  const { locale, activeCompanyId } = useApp();
  const search = useSearchParams();
  const loc = locOf(locale);
  const companyId = search.get('company') || activeCompanyId || '';
  const engagementId = search.get('engagement');
  const networkId = search.get('network');

  const [summary, setSummary] = useState<Summary | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [phone, setPhone] = useState('');
  const [showSensor, setShowSensor] = useState(false);
  const [sensorName, setSensorName] = useState('');
  const [unitName, setUnitName] = useState('');

  const withCtx = (path: string) => {
    const p = new URLSearchParams();
    if (companyId) p.set('company', companyId);
    if (engagementId) p.set('engagement', engagementId);
    if (networkId) p.set('network', networkId);
    const q = p.toString();
    return q ? `${path}?${q}` : path;
  };

  const load = useCallback(async () => {
    if (!companyId) {
      setLoading(false);
      setErr(loc === 'es' ? 'Elegí una empresa.' : loc === 'en' ? 'Pick a company.' : 'Escolhe uma empresa.');
      return;
    }
    setLoading(true);
    setErr(null);
    try {
      const [sumR, entR] = await Promise.all([
        fetch(`/api/nexus/ops/summary?${qs(companyId, engagementId)}`),
        fetch(`/api/nexus/ops/entries?${qs(companyId, engagementId)}`),
      ]);
      const sum = await sumR.json();
      const ent = await entR.json();
      if (!sumR.ok) throw new Error(sum.error || 'Falha');
      setSummary(sum as Summary);
      setEntries((ent.entries || []) as Entry[]);
      if (sum.whatsapp?.link?.phoneE164) setPhone(sum.whatsapp.link.phoneE164);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro');
    } finally {
      setLoading(false);
    }
  }, [companyId, engagementId, loc]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    touchRunwayChapter('campo');
  }, []);

  const copy = useMemo(
    () =>
      loc === 'es'
        ? {
            title: 'Central de mando',
            line: 'Anotá la producción, leé los sensores y controlá las automatizaciones. WhatsApp entra dato y sale alerta.',
            production: 'Producción',
            sensors: 'Sensores',
            automations: 'Automatizaciones',
            placeholder: 'Qué pasó hoy en el negocio…',
            send: 'Anotar',
            wa: 'WhatsApp del productor',
            waHint: 'El productor manda datos por mensaje. Alertas y pedidos de comando salen aquí.',
            link: 'Vincular',
            unlink: 'Quitar',
            noWa: 'WhatsApp Cloud aún no está configurado en el servidor. El número queda guardado.',
            addUnit: 'Nombrar el negocio',
            addSensor: 'Registrar sensor',
            dx: 'Diagnóstico',
            plan: 'Plan',
          }
        : loc === 'en'
          ? {
              title: 'Command center',
              line: 'Log production, read sensors, and control automations. WhatsApp takes data in and sends alerts out.',
              production: 'Production',
              sensors: 'Sensors',
              automations: 'Automations',
              placeholder: 'What happened on the farm today…',
              send: 'Log',
              wa: 'Producer WhatsApp',
              waHint: 'The producer sends data by message. Alerts and command requests go here.',
              link: 'Link',
              unlink: 'Remove',
              noWa: 'WhatsApp Cloud is not configured on the server yet. The number is still saved.',
              addUnit: 'Name the operation',
              addSensor: 'Register sensor',
              dx: 'Diagnosis',
              plan: 'Plan',
            }
          : {
              title: 'Central de comando',
              line: 'Anota a produção, lê os sensores e controla as automações. O WhatsApp entra dado e sai alerta.',
              production: 'Produção',
              sensors: 'Sensores',
              automations: 'Automações',
              placeholder: 'O que aconteceu hoje no negócio…',
              send: 'Anotar',
              wa: 'WhatsApp do produtor',
              waHint: 'O produtor manda os dados por mensagem. Alertas e pedidos de comando saem daqui.',
              link: 'Ligar',
              unlink: 'Tirar',
              noWa: 'WhatsApp Cloud ainda não está configurado no servidor. O número fica guardado.',
              addUnit: 'Nomear o negócio',
              addSensor: 'Registar sensor',
              dx: 'Diagnóstico',
              plan: 'Plano',
            },
    [loc]
  );

  const addNote = async () => {
    if (!note.trim()) return;
    setBusy(true);
    try {
      const r = await fetch('/api/nexus/ops/entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          engagementId,
          kind: 'observation',
          payload: { note: note.trim() },
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Falha');
      setNote('');
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro');
    } finally {
      setBusy(false);
    }
  };

  const addUnit = async () => {
    if (!unitName.trim()) return;
    setBusy(true);
    try {
      const r = await fetch('/api/nexus/ops/units', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, engagementId, name: unitName.trim() }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Falha');
      setUnitName('');
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro');
    } finally {
      setBusy(false);
    }
  };

  const addSensor = async () => {
    if (!sensorName.trim()) return;
    setBusy(true);
    try {
      const r = await fetch('/api/nexus/ops/sensors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, engagementId, name: sensorName.trim(), metric: 'soil_moisture' }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Falha');
      setSensorName('');
      setShowSensor(false);
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro');
    } finally {
      setBusy(false);
    }
  };

  const saveWhatsapp = async (unlink = false) => {
    setBusy(true);
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

  const toggleRule = async (kind: string, enabled: boolean) => {
    setBusy(true);
    try {
      const r = await fetch('/api/nexus/ops/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, engagementId, kind, enabled }),
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

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-teal-700" />
      </div>
    );
  }

  const latestByMetric = new Map<string, Reading>();
  for (const r of summary?.readings || []) {
    if (!latestByMetric.has(r.metric)) latestByMetric.set(r.metric, r);
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5 px-4 py-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-teal-700">NEXUS</p>
          <h1 className="mt-1 font-serif text-3xl text-slate-900">{copy.title}</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">{copy.line}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={withCtx('/hub/nexus/diagnosis')} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700">
            {copy.dx}
          </Link>
          <Link href={withCtx('/hub/nexus/roadmap')} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700">
            {copy.plan}
          </Link>
        </div>
      </header>

      {err && <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{err}</p>}

      {(summary?.alerts || []).length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">
            {loc === 'es' ? 'Alertas vivos' : loc === 'en' ? 'Live alerts' : 'Alertas vivos'}
          </p>
          <ul className="mt-1 space-y-1 text-sm text-amber-950">
            {(summary?.alerts || []).slice(0, 4).map((a, i) => (
              <li key={a.id || i}>{a.title || a.summary}</li>
            ))}
          </ul>
        </div>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <Smartphone className="h-4 w-4 text-teal-700" />
          {copy.wa}
        </div>
        <p className="mt-1 text-xs text-slate-500">{copy.waHint}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+55 11 99999-0000"
            className="min-w-[220px] flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
          <button
            type="button"
            disabled={busy}
            onClick={() => void saveWhatsapp(false)}
            className="rounded-lg bg-[#0c1222] px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {copy.link}
          </button>
          {summary?.whatsapp?.link && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void saveWhatsapp(true)}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700"
            >
              {copy.unlink}
            </button>
          )}
        </div>
        {summary?.whatsapp?.link && (
          <p className="mt-2 text-xs text-teal-800">
            {summary.whatsapp.link.phoneE164}
            {summary.whatsapp.link.lastInboundAt
              ? ` · ${loc === 'es' ? 'último mensaje' : loc === 'en' ? 'last inbound' : 'última mensagem'} ${when(summary.whatsapp.link.lastInboundAt, loc)}`
              : ''}
            {summary.whatsapp.link.pendingCommandKind
              ? ` · ${loc === 'es' ? 'esperando confirmación' : loc === 'en' ? 'awaiting confirm' : 'à espera de confirmação'}`
              : ''}
          </p>
        )}
        {!summary?.whatsapp?.configured && <p className="mt-2 text-xs text-slate-500">{copy.noWa}</p>}
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <Radio className="h-4 w-4 text-teal-700" />
            {copy.production}
          </div>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={4}
            placeholder={copy.placeholder}
            className="mt-3 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
          <button
            type="button"
            disabled={busy || !note.trim()}
            onClick={() => void addNote()}
            className="mt-2 w-full rounded-lg bg-teal-700 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {copy.send}
          </button>
          {!summary?.units.length && (
            <div className="mt-3 flex gap-2">
              <input
                value={unitName}
                onChange={(e) => setUnitName(e.target.value)}
                placeholder={summary ? L(summary.module.namePlaceholder, loc) : copy.addUnit}
                className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
              <button type="button" disabled={busy} onClick={() => void addUnit()} className="rounded-lg border px-3 text-xs">
                OK
              </button>
            </div>
          )}
          <ol className="mt-4 space-y-2">
            {entries.slice(0, 12).map((e) => (
              <li key={e.id} className="rounded-lg bg-slate-50 px-3 py-2">
                <p className="text-sm text-slate-800">{noteOf(e)}</p>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  {when(e.occurredAt, loc)}
                  {e.channel === 'whatsapp' ? ' · WhatsApp' : e.author?.name ? ` · ${e.author.name}` : ''}
                </p>
              </li>
            ))}
            {!entries.length && (
              <li className="text-xs text-slate-500">
                {loc === 'es' ? 'Aún no hay anotaciones.' : loc === 'en' ? 'No notes yet.' : 'Ainda não há anotações.'}
              </li>
            )}
          </ol>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <Thermometer className="h-4 w-4 text-teal-700" />
              {copy.sensors}
            </div>
            <button type="button" onClick={() => setShowSensor((v) => !v)} className="text-[11px] font-medium text-teal-800">
              {copy.addSensor}
            </button>
          </div>
          {showSensor && (
            <div className="mt-3 flex gap-2">
              <input
                value={sensorName}
                onChange={(e) => setSensorName(e.target.value)}
                placeholder={loc === 'es' ? 'Nombre del sensor' : loc === 'en' ? 'Sensor name' : 'Nome do sensor'}
                className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
              <button type="button" disabled={busy} onClick={() => void addSensor()} className="rounded-lg border px-3 text-xs">
                OK
              </button>
            </div>
          )}
          <ul className="mt-4 space-y-2">
            {Array.from(latestByMetric.values()).map((r) => (
              <li key={r.id} className="flex items-baseline justify-between rounded-lg bg-slate-50 px-3 py-2">
                <div>
                  <p className="text-sm font-medium text-slate-800">{r.sensor?.name || r.metric}</p>
                  <p className="text-[11px] text-slate-500">{when(r.recordedAt, loc)}</p>
                </div>
                <p className="text-lg font-semibold tabular-nums text-slate-900">
                  {r.value}
                  <span className="ml-1 text-xs font-normal text-slate-500">{r.unit}</span>
                </p>
              </li>
            ))}
            {!latestByMetric.size && (
              <li className="text-xs text-slate-500">
                {loc === 'es'
                  ? 'Cuando un sensor mande dato, aparece aquí.'
                  : loc === 'en'
                    ? 'When a sensor sends data, it shows here.'
                    : 'Quando um sensor mandar dado, aparece aqui.'}
              </li>
            )}
          </ul>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <Zap className="h-4 w-4 text-teal-700" />
            {copy.automations}
          </div>
          <ul className="mt-4 space-y-3">
            {(summary?.rules || []).map((rule) => (
              <li key={rule.id} className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2">
                <div>
                  <p className="text-sm font-medium text-slate-800">{rule.label}</p>
                  <p className="text-[11px] text-slate-500">
                    {rule.kind === 'whatsapp_alerts'
                      ? loc === 'es'
                        ? 'Avisa al productor cuando hay alerta'
                        : loc === 'en'
                          ? 'Notify the producer when there is an alert'
                          : 'Avisa o produtor quando há alerta'
                      : loc === 'es'
                        ? 'Pide confirmación por WhatsApp al encender'
                        : loc === 'en'
                          ? 'Asks WhatsApp confirmation when turned on'
                          : 'Pede confirmação no WhatsApp ao ligar'}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void toggleRule(rule.kind, !rule.enabled)}
                  className={`relative h-6 w-11 rounded-full transition ${rule.enabled ? 'bg-teal-700' : 'bg-slate-300'}`}
                  aria-pressed={rule.enabled}
                >
                  <span
                    className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition ${rule.enabled ? 'left-5' : 'left-0.5'}`}
                  />
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
