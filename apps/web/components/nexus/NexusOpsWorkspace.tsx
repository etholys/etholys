'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useApp } from '@/app/providers';
import { fieldEntryKindLabel, L, type FieldEntryKind, type L3 } from '@/lib/nexus-sector-modules';
import { touchRunwayChapter } from '@/lib/nexus-runway';

type View = 'campo' | 'monitor';

type Unit = {
  id: string;
  name: string;
  kind: string;
  areaHa: number | null;
  qty?: number | null;
  crop: string | null;
};

type Entry = {
  id: string;
  kind: string;
  occurredAt: string;
  payloadJson: Record<string, unknown>;
  unit?: { id: string; name: string } | null;
  author?: { id: string; name: string } | null;
};

type Sensor = {
  id: string;
  name: string;
  metric: string;
  lastSeenAt: string | null;
  unit?: { id: string; name: string } | null;
};

type Reading = {
  id: string;
  metric: string;
  value: number;
  unit: string;
  source: string;
  recordedAt: string;
  sensor?: { id: string; name: string } | null;
  unit?: { id: string; name: string } | null;
};

type Alert = { code: string; severity: string; message: L3 };

type Summary = {
  companyId: string;
  sectorIds: string[];
  module: {
    moduleId: string;
    unitKind: string;
    unitLabel: L3;
    bookLabel: L3;
    monitorLabel: L3;
    intro?: L3;
    namePlaceholder?: L3;
    showAreaHa?: boolean;
    qtyLabel?: L3 | null;
    cropLabel?: L3 | null;
    entryKinds: FieldEntryKind[];
    metrics: Array<{ id: string; label: L3; unit: string }>;
    protocols: Array<{ id: string; title: L3; summary: L3; dxQuestionIds?: string[] }>;
  };
  units: Unit[];
  recentEntries: Entry[];
  sensors: Sensor[];
  readings: Reading[];
  latestDiagnosis: { id: string; overall: number; createdAt: string } | null;
  alerts: Alert[];
};

function locOf(locale: string): 'es' | 'pt' | 'en' {
  if (locale === 'es' || locale === 'en') return locale;
  return 'pt';
}

function qs(companyId: string, engagementId: string | null) {
  const p = new URLSearchParams({ companyId });
  if (engagementId) p.set('engagementId', engagementId);
  return p.toString();
}

export function NexusOpsWorkspace({ view }: { view: View }) {
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
  const [tokenOnce, setTokenOnce] = useState<string | null>(null);

  const [unitName, setUnitName] = useState('');
  const [unitHa, setUnitHa] = useState('');
  const [unitQty, setUnitQty] = useState('');
  const [unitCrop, setUnitCrop] = useState('');
  const [entryValue, setEntryValue] = useState('');
  const [entryKind, setEntryKind] = useState<FieldEntryKind>('observation');
  const [entryUnit, setEntryUnit] = useState('');
  const [entryNote, setEntryNote] = useState('');
  const [entryPhi, setEntryPhi] = useState('7');
  const [entryMm, setEntryMm] = useState('');
  const [sensorName, setSensorName] = useState('');
  const [sensorMetric, setSensorMetric] = useState('soil_moisture');
  const [sensorUnit, setSensorUnit] = useState('');

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
      const kinds = (sum.module?.entryKinds || ['observation']) as FieldEntryKind[];
      setEntryKind((prev) => (kinds.includes(prev) ? prev : kinds[0] || 'observation'));
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
    touchRunwayChapter(view === 'monitor' ? 'monitor' : 'campo');
  }, [view]);

  const addUnit = async () => {
    if (!unitName.trim()) return;
    setBusy(true);
    try {
      const r = await fetch('/api/nexus/ops/units', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          engagementId,
          name: unitName,
          areaHa: unitHa ? Number(unitHa) : null,
          qty: unitQty ? Number(unitQty) : null,
          crop: unitCrop,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Falha');
      setUnitName('');
      setUnitHa('');
      setUnitQty('');
      setUnitCrop('');
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro');
    } finally {
      setBusy(false);
    }
  };

  const addEntry = async () => {
    if (!entryNote.trim() && entryKind !== 'irrigation') return;
    setBusy(true);
    try {
      const payload: Record<string, unknown> = { note: entryNote.trim() };
      if (entryKind === 'input' || entryKind === 'health') payload.phiDays = Number(entryPhi) || 7;
      if (entryKind === 'irrigation' && entryMm) payload.mm = Number(entryMm);
      const metricByKind: Partial<Record<FieldEntryKind, string>> = {
        irrigation: 'irrigation_mm',
        egg: 'egg_count',
        milking: 'milk_l',
        health: 'mortality_pct',
        hive_inspect: 'varroa_count',
        process: 'waste_pct',
      };
      const metric = metricByKind[entryKind];
      const numeric =
        entryKind === 'irrigation' && entryMm
          ? Number(entryMm)
          : entryValue
            ? Number(entryValue)
            : undefined;
      const r = await fetch('/api/nexus/ops/entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          engagementId,
          unitId: entryUnit || null,
          kind: entryKind,
          payload,
          metric: numeric != null && Number.isFinite(numeric) ? metric : undefined,
          value: numeric != null && Number.isFinite(numeric) ? numeric : undefined,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Falha');
      setEntryNote('');
      setEntryMm('');
      setEntryValue('');
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
        body: JSON.stringify({
          companyId,
          engagementId,
          name: sensorName,
          metric: sensorMetric,
          unitId: sensorUnit || null,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Falha');
      setTokenOnce(d.token || null);
      setSensorName('');
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro');
    } finally {
      setBusy(false);
    }
  };

  const title = useMemo(() => {
    if (!summary) return view === 'monitor' ? 'Monitor' : 'Caderno';
    return view === 'monitor' ? L(summary.module.monitorLabel, loc) : L(summary.module.bookLabel, loc);
  }, [summary, view, loc]);

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-teal-700" />
      </div>
    );
  }

  const showAreaHa = Boolean(summary?.module.showAreaHa);
  const qtyLabel = summary?.module.qtyLabel ? L(summary.module.qtyLabel, loc) : null;
  const cropLabel = summary?.module.cropLabel ? L(summary.module.cropLabel, loc) : null;
  const intro = summary?.module.intro
    ? L(summary.module.intro, loc)
    : loc === 'es'
      ? 'Diario operativo del sector.'
      : loc === 'en'
        ? 'Sector operations diary.'
        : 'Diário operativo do setor.';

  return (
    <div className="space-y-5">
      <header className="rounded-3xl bg-[#0c1222] px-6 py-8 text-white shadow-xl">
        <p className="text-xs font-semibold tracking-[0.2em] text-teal-300/90">NEXUS</p>
        <h1 className="mt-2 font-serif text-3xl tracking-tight">{title}</h1>
        <p className="mt-2 max-w-xl text-sm text-slate-300">{intro}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href={withCtx('/hub/nexus/campo')} className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium hover:bg-white/15">
            {summary ? L(summary.module.bookLabel, loc) : loc === 'es' ? 'Cuaderno' : 'Caderno'}
          </Link>
          <Link href={withCtx('/hub/nexus/monitor')} className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium hover:bg-white/15">
            {summary ? L(summary.module.monitorLabel, loc) : 'Monitor'}
          </Link>
          <Link href={withCtx('/hub/nexus/diagnosis')} className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium hover:bg-white/15">
            {loc === 'es' ? 'Diagnóstico' : loc === 'en' ? 'Diagnosis' : 'Diagnóstico'}
          </Link>
          <Link href={withCtx('/hub/nexus/roadmap')} className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium hover:bg-white/15">
            {loc === 'es' ? 'Plan' : loc === 'en' ? 'Plan' : 'Plano'}
          </Link>
        </div>
      </header>

      {err && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900" role="alert">
          {err}
        </p>
      )}

      {summary?.alerts && summary.alerts.length > 0 && (
        <ul className="space-y-2">
          {summary.alerts.map((a, i) => (
            <li
              key={`${a.code}-${i}`}
              className={`rounded-xl border px-3 py-2 text-sm ${
                a.severity === 'critical'
                  ? 'border-amber-300 bg-amber-50 text-amber-950'
                  : 'border-slate-200 bg-slate-50 text-slate-800'
              }`}
            >
              {L(a.message, loc)}
            </li>
          ))}
        </ul>
      )}

      {summary?.latestDiagnosis && (
        <p className="text-xs text-slate-500">
          {loc === 'es' ? 'Último diagnóstico' : loc === 'en' ? 'Latest diagnosis' : 'Último diagnóstico'}:{' '}
          {summary.latestDiagnosis.overall}/100
        </p>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-900">
          {summary ? L(summary.module.unitLabel, loc) : loc === 'es' ? 'Unidades' : 'Unidades'}
        </h2>
        {summary?.units.length ? (
          <ul className="mt-2 divide-y text-sm">
            {summary.units.map((u) => (
              <li key={u.id} className="flex items-baseline justify-between gap-3 py-2">
                <span className="font-medium text-slate-800">{u.name}</span>
                <span className="text-xs text-slate-500">
                  {[
                    u.crop,
                    u.areaHa != null ? `${u.areaHa} ha` : null,
                    u.qty != null && qtyLabel ? `${u.qty} ${qtyLabel.toLowerCase()}` : null,
                  ]
                    .filter(Boolean)
                    .join(' · ') || u.kind}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-slate-500">
            {loc === 'es'
              ? `Todavía no hay ${summary ? L(summary.module.unitLabel, loc).toLowerCase() : 'unidades'}. Registrá la primera.`
              : loc === 'en'
                ? `No ${summary ? L(summary.module.unitLabel, loc).toLowerCase() : 'units'} yet. Register the first one.`
                : `Ainda não há ${summary ? L(summary.module.unitLabel, loc).toLowerCase() : 'unidades'}. Regista a primeira.`}
          </p>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          <input
            value={unitName}
            onChange={(e) => setUnitName(e.target.value)}
            placeholder={summary?.module.namePlaceholder ? L(summary.module.namePlaceholder, loc) : loc === 'es' ? 'Nombre' : 'Nome'}
            className="rounded-lg border px-3 py-2 text-sm"
          />
          {showAreaHa && (
            <input
              value={unitHa}
              onChange={(e) => setUnitHa(e.target.value)}
              placeholder="ha"
              className="w-20 rounded-lg border px-3 py-2 text-sm"
            />
          )}
          {qtyLabel && (
            <input
              value={unitQty}
              onChange={(e) => setUnitQty(e.target.value)}
              placeholder={qtyLabel}
              className="w-28 rounded-lg border px-3 py-2 text-sm"
            />
          )}
          {cropLabel && (
            <input
              value={unitCrop}
              onChange={(e) => setUnitCrop(e.target.value)}
              placeholder={cropLabel}
              className="rounded-lg border px-3 py-2 text-sm"
            />
          )}
          <button
            type="button"
            disabled={busy}
            onClick={() => void addUnit()}
            className="rounded-lg bg-[#0c1222] px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {loc === 'es' ? 'Registrar' : loc === 'en' ? 'Register' : 'Registar'}
          </button>
        </div>
      </section>

      {view === 'campo' && (
        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            <select
              value={entryKind}
              onChange={(e) => setEntryKind(e.target.value as FieldEntryKind)}
              className="rounded-lg border px-3 py-2 text-sm"
            >
              {(summary?.module.entryKinds || ['note']).map((k) => (
                <option key={k} value={k}>
                  {fieldEntryKindLabel(k, loc)}
                </option>
              ))}
            </select>
            <select
              value={entryUnit}
              onChange={(e) => setEntryUnit(e.target.value)}
              className="rounded-lg border px-3 py-2 text-sm"
            >
              <option value="">
                {loc === 'es' ? 'Sin unidad' : loc === 'en' ? 'No unit' : 'Sem unidade'}
              </option>
              {(summary?.units || []).map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
            {(entryKind === 'input' || entryKind === 'health') && (
              <input
                value={entryPhi}
                onChange={(e) => setEntryPhi(e.target.value)}
                placeholder={loc === 'es' ? 'Días carencia' : loc === 'en' ? 'Withdrawal days' : 'Dias carência'}
                className="w-28 rounded-lg border px-3 py-2 text-sm"
              />
            )}
            {entryKind === 'irrigation' && (
              <input
                value={entryMm}
                onChange={(e) => setEntryMm(e.target.value)}
                placeholder="mm"
                className="w-20 rounded-lg border px-3 py-2 text-sm"
              />
            )}
            {(entryKind === 'egg' ||
              entryKind === 'milking' ||
              entryKind === 'health' ||
              entryKind === 'hive_inspect' ||
              entryKind === 'process') && (
              <input
                value={entryValue}
                onChange={(e) => setEntryValue(e.target.value)}
                placeholder={
                  entryKind === 'egg'
                    ? loc === 'es'
                      ? 'Huevos'
                      : loc === 'en'
                        ? 'Eggs'
                        : 'Ovos'
                    : entryKind === 'milking'
                      ? 'L'
                      : entryKind === 'hive_inspect'
                        ? 'Varroa'
                        : entryKind === 'process'
                          ? loc === 'es'
                            ? 'Merma %'
                            : loc === 'en'
                              ? 'Waste %'
                              : 'Perda %'
                          : loc === 'es'
                            ? 'Mortalidad %'
                            : loc === 'en'
                              ? 'Mortality %'
                              : 'Mortalidade %'
                }
                className="w-28 rounded-lg border px-3 py-2 text-sm"
              />
            )}
            <input
              value={entryNote}
              onChange={(e) => setEntryNote(e.target.value)}
              placeholder={loc === 'es' ? 'Qué pasó' : loc === 'en' ? 'What happened' : 'O que aconteceu'}
              className="min-w-[12rem] flex-1 rounded-lg border px-3 py-2 text-sm"
            />
            <button
              type="button"
              disabled={busy}
              onClick={() => void addEntry()}
              className="rounded-lg bg-teal-800 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {loc === 'es' ? 'Anotar' : loc === 'en' ? 'Log' : 'Anotar'}
            </button>
          </div>
          <ul className="mt-4 space-y-2">
            {entries.map((e) => (
              <li key={e.id} className="rounded-lg border border-slate-100 px-3 py-2 text-sm">
                <p className="font-medium text-slate-800">
                  {fieldEntryKindLabel(e.kind as FieldEntryKind, loc)}
                  {e.unit ? ` · ${e.unit.name}` : ''}
                </p>
                <p className="text-slate-600">{String((e.payloadJson as { note?: string })?.note || '—')}</p>
                <p className="mt-1 text-[11px] text-slate-400">
                  {new Date(e.occurredAt).toLocaleString()} {e.author?.name ? `· ${e.author.name}` : ''}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {view === 'monitor' && (
        <>
          <section className="rounded-2xl border border-slate-200 bg-white p-4">
            <h2 className="text-sm font-semibold text-slate-900">
              {loc === 'es' ? 'Sensores' : loc === 'en' ? 'Sensors' : 'Sensores'}
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              POST /api/nexus/ingest/readings · Authorization: Bearer nxsens_…
            </p>
            {tokenOnce && (
              <p className="mt-2 break-all rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-xs text-teal-950">
                {loc === 'es' ? 'Token (una vez)' : loc === 'en' ? 'Token (once)' : 'Token (uma vez)'}: {tokenOnce}
              </p>
            )}
            <ul className="mt-3 divide-y text-sm">
              {(summary?.sensors || []).map((s) => (
                <li key={s.id} className="flex justify-between gap-3 py-2">
                  <span>
                    {s.name} <span className="text-xs text-slate-500">({s.metric})</span>
                  </span>
                  <span className="text-xs text-slate-400">
                    {s.lastSeenAt ? new Date(s.lastSeenAt).toLocaleString() : loc === 'es' ? 'sin señal' : 'sem sinal'}
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-3 flex flex-wrap gap-2">
              <input
                value={sensorName}
                onChange={(e) => setSensorName(e.target.value)}
                placeholder={loc === 'es' ? 'Sensor parcela 1' : 'Sensor parcela 1'}
                className="rounded-lg border px-3 py-2 text-sm"
              />
              <select
                value={sensorMetric}
                onChange={(e) => setSensorMetric(e.target.value)}
                className="rounded-lg border px-3 py-2 text-sm"
              >
                {(summary?.module.metrics || []).map((m) => (
                  <option key={m.id} value={m.id}>
                    {L(m.label, loc)}
                  </option>
                ))}
              </select>
              <select
                value={sensorUnit}
                onChange={(e) => setSensorUnit(e.target.value)}
                className="rounded-lg border px-3 py-2 text-sm"
              >
                <option value="">
                  {summary
                    ? `${loc === 'es' ? 'Sin' : loc === 'en' ? 'No' : 'Sem'} ${L(summary.module.unitLabel, loc).toLowerCase()}`
                    : loc === 'es'
                      ? 'Sin unidad'
                      : 'Sem unidade'}
                </option>
                {(summary?.units || []).map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={busy}
                onClick={() => void addSensor()}
                className="rounded-lg bg-[#0c1222] px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {loc === 'es' ? 'Registrar sensor' : loc === 'en' ? 'Register sensor' : 'Registar sensor'}
              </button>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-4">
            <h2 className="text-sm font-semibold text-slate-900">
              {loc === 'es' ? 'Lecturas' : loc === 'en' ? 'Readings' : 'Leituras'}
            </h2>
            <ul className="mt-2 divide-y text-sm">
              {(summary?.readings || []).map((r) => (
                <li key={r.id} className="flex justify-between gap-3 py-2">
                  <span>
                    {r.metric} · {r.value} {r.unit}{' '}
                    <span className="text-xs text-slate-400">{r.source}</span>
                  </span>
                  <span className="text-xs text-slate-400">{new Date(r.recordedAt).toLocaleString()}</span>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}

      {summary?.module.protocols && (
        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-slate-900">
            {loc === 'es' ? 'Protocolos del diagnóstico' : loc === 'en' ? 'Diagnosis protocols' : 'Protocolos do diagnóstico'}
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            {loc === 'es'
              ? 'Cada protocolo responde a una pregunta del diagnóstico. El plan de acción abre esta misma pantalla.'
              : loc === 'en'
                ? 'Each protocol answers a diagnosis question. The action plan opens this same screen.'
                : 'Cada protocolo responde a uma pergunta do diagnóstico. O plano de ação abre este ecrã.'}
          </p>
          <ul className="mt-2 space-y-2">
            {summary.module.protocols.map((p) => (
              <li key={p.id}>
                <p className="text-sm font-medium text-slate-800">{L(p.title, loc)}</p>
                <p className="text-xs text-slate-500">{L(p.summary, loc)}</p>
                {p.dxQuestionIds && p.dxQuestionIds.length > 0 ? (
                  <p className="mt-0.5 text-[10px] uppercase tracking-wide text-teal-800">
                    {loc === 'es' ? 'Ligado al diagnóstico' : loc === 'en' ? 'Linked to diagnosis' : 'Ligado ao diagnóstico'}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
