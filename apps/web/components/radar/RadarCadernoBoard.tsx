'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { BookOpen, Loader2, MapPinned, Trash2 } from 'lucide-react';
import { useRadarClientScopeOptional } from '@/components/radar/RadarClientScopeContext';
import {
  cadernoCopy,
  cadernoFieldLabel,
  cadernoFieldPlaceholder,
  cadernoFieldsForKind,
  cadernoKindLabel,
  optionLabel,
  type CadernoFieldId,
} from '@/lib/radar/caderno';
import { radarLoc, radarT } from '@/lib/radar/i18n';
import { spaceKindMeta } from '@/lib/radar/space';
import { RADAR_SCOPE_OWN } from '@/lib/radar/client-scope';

type EntryRow = {
  id: string;
  kind: string;
  occurredAt: string;
  note: string;
  unitId: string | null;
  unitName: string | null;
  authorName: string | null;
  payload?: Record<string, unknown> | null;
};

type PropRow = {
  id: string;
  name: string;
  moduleId: string | null;
  units: Array<{ id: string; name: string; kind: string; crop: string | null }>;
};

const EMPTY_FORM: Record<CadernoFieldId, string> = {
  note: '',
  product: '',
  dose: '',
  adjuvant: '',
  targetPest: '',
  sprayVolumeL: '',
  areaHa: '',
  phiDays: '',
  mm: '',
  duration: '',
  frequencyDays: '',
  cultivar: '',
  plantsCount: '',
  density: '',
  practice: '',
  quantity: '',
  equipment: '',
  pestName: '',
  present: '',
  level: '',
  weightKg: '',
  yieldKgHa: '',
  eventType: '',
};

function payloadExtraLine(payload: Record<string, unknown> | null | undefined, loc: 'pt' | 'es' | 'en'): string {
  if (!payload) return '';
  const bits: string[] = [];
  const add = (v: unknown) => {
    if (v == null || v === '') return;
    bits.push(String(v));
  };
  if (payload.practice) {
    const def = cadernoFieldsForKind('cultural').find((f) => f.id === 'practice');
    bits.push(def ? optionLabel(def, String(payload.practice), loc) : String(payload.practice));
  }
  if (payload.eventType) {
    const def = cadernoFieldsForKind('weather').find((f) => f.id === 'eventType');
    bits.push(def ? optionLabel(def, String(payload.eventType), loc) : String(payload.eventType));
  }
  add(payload.product);
  add(payload.cultivar);
  add(payload.pestName);
  add(payload.dose);
  if (payload.phiDays != null) bits.push(`PHI ${payload.phiDays}d`);
  if (payload.mm != null) bits.push(`${payload.mm} mm`);
  if (payload.weightKg != null) bits.push(`${payload.weightKg} kg`);
  if (payload.areaHa != null) bits.push(`${payload.areaHa} ha`);
  add(payload.quantity);
  add(payload.adjuvant);
  add(payload.targetPest);
  return bits.filter(Boolean).join(' · ');
}

export function RadarCadernoBoard({
  companyId,
  engagementId,
  locale,
  initialPropertyId,
  initialUnitId,
}: {
  companyId: string;
  engagementId?: string | null;
  locale: string;
  initialPropertyId?: string | null;
  initialUnitId?: string | null;
}) {
  const loc = radarLoc(locale);
  const scope = useRadarClientScopeOptional()?.scope || RADAR_SCOPE_OWN;
  const [properties, setProperties] = useState<PropRow[]>([]);
  const [propertyId, setPropertyId] = useState(initialPropertyId || '');
  const [unitId, setUnitId] = useState(initialUnitId || '');
  const [moduleId, setModuleId] = useState<string | null>('agriculture');
  const [kinds, setKinds] = useState<string[]>(['observation']);
  const [entries, setEntries] = useState<EntryRow[]>([]);
  const [kind, setKind] = useState('observation');
  const [form, setForm] = useState<Record<CadernoFieldId, string>>({ ...EMPTY_FORM });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const copy = useMemo(() => cadernoCopy(moduleId, loc), [moduleId, loc]);
  const spaceMeta = spaceKindMeta(moduleId);
  const fieldDefs = useMemo(() => cadernoFieldsForKind(kind), [kind]);

  const companyQ = engagementId
    ? `company=${companyId}&engagement=${engagementId}`
    : `company=${companyId}`;

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    setErr(null);
    try {
      const q = new URLSearchParams({ companyId, clientId: scope });
      if (engagementId) q.set('engagementId', engagementId);
      if (propertyId) q.set('propertyId', propertyId);
      if (unitId) q.set('unitId', unitId);
      const r = await fetch(`/api/radar/entries?${q}`, { cache: 'no-store' });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Falha');
      const props: PropRow[] = d.properties || [];
      setProperties(props);
      const nextProp = d.propertyId || propertyId || props[0]?.id || '';
      if (nextProp && nextProp !== propertyId) setPropertyId(nextProp);
      setModuleId(d.moduleId || props.find((p) => p.id === nextProp)?.moduleId || 'agriculture');
      const nextKinds: string[] = d.kinds?.length ? d.kinds : ['observation', 'note'];
      setKinds(nextKinds);
      setKind((cur) => (nextKinds.includes(cur) ? cur : nextKinds[0]));
      setEntries(d.entries || []);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro');
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [companyId, engagementId, propertyId, unitId, scope]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (initialUnitId) setUnitId(initialUnitId);
  }, [initialUnitId]);

  useEffect(() => {
    if (initialPropertyId) setPropertyId(initialPropertyId);
  }, [initialPropertyId]);

  const setField = (id: CadernoFieldId, value: string) => {
    setForm((prev) => ({ ...prev, [id]: value }));
  };

  const selected = properties.find((p) => p.id === propertyId);
  const units = selected?.units || [];

  const save = async () => {
    setBusy(true);
    setErr(null);
    setOk(false);
    try {
      const body: Record<string, unknown> = {
        companyId,
        engagementId,
        propertyId: propertyId || null,
        unitId: unitId || null,
        kind,
      };
      for (const f of fieldDefs) {
        const v = form[f.id]?.trim();
        if (!v) continue;
        if (f.input === 'number') body[f.id] = Number(v);
        else body[f.id] = v;
      }

      const r = await fetch('/api/radar/entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Falha');
      setForm({ ...EMPTY_FORM });
      setOk(true);
      await load();
      window.setTimeout(() => setOk(false), 1800);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    if (!window.confirm(radarT(loc, 'Apagar este registo?', '¿Borrar este registro?', 'Delete this entry?'))) {
      return;
    }
    setBusy(true);
    try {
      const q = new URLSearchParams({ companyId, id });
      if (engagementId) q.set('engagementId', engagementId);
      const r = await fetch(`/api/radar/entries?${q}`, { method: 'DELETE' });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Falha');
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro');
    } finally {
      setBusy(false);
    }
  };

  const canSave = fieldDefs.some((f) => {
    const v = form[f.id]?.trim();
    if (!v) return false;
    if (f.input === 'number') return Number.isFinite(Number(v));
    return v.length >= 1;
  });

  const primaryFields = fieldDefs.filter((f) => f.id !== 'note');
  const noteField = fieldDefs.find((f) => f.id === 'note');

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/40">RADAR</p>
          <h1 className="mt-2 flex items-center gap-2 font-serif text-4xl text-white">
            <BookOpen className="h-8 w-8 text-teal-300/80" />
            {copy.title}
          </h1>
          <p className="mt-2 max-w-xl text-sm text-white/50">{copy.subtitle}</p>
        </div>
        <Link
          href={
            propertyId
              ? `/hub/radar/properties/${propertyId}?${companyQ}${unitId ? `&unit=${unitId}` : ''}`
              : `/hub/radar?${companyQ}`
          }
          className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-4 py-2.5 text-sm text-white/80 hover:bg-white/5"
        >
          <MapPinned className="h-4 w-4" />
          {radarT(loc, 'Abrir mapa', 'Abrir mapa', 'Open map')}
        </Link>
      </div>

      <section className="rounded-2xl border border-white/12 bg-slate-950/80 p-4 sm:p-5">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block text-xs text-white/55">
            {radarT(loc, 'Operação', 'Operación', 'Operation')}
            <select
              value={propertyId}
              onChange={(e) => {
                setPropertyId(e.target.value);
                setUnitId('');
              }}
              className="mt-1 w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-teal-500/40"
            >
              {properties.length === 0 && (
                <option value="">{radarT(loc, 'Sem sítios', 'Sin sitios', 'No sites')}</option>
              )}
              {properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-xs text-white/55">
            {spaceMeta.unitLabel[loc]}
            <select
              value={unitId}
              onChange={(e) => setUnitId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-teal-500/40"
            >
              <option value="">{radarT(loc, 'Toda a operação', 'Toda la operación', 'Whole operation')}</option>
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                  {u.crop ? ` · ${u.crop}` : ''}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-xs text-white/55 sm:col-span-2 lg:col-span-2">
            {copy.whatLabel}
            <select
              value={kind}
              onChange={(e) => {
                setKind(e.target.value);
                setForm({ ...EMPTY_FORM });
              }}
              className="mt-1 w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-teal-500/40"
            >
              {kinds.map((k) => (
                <option key={k} value={k}>
                  {cadernoKindLabel(k, loc)}
                </option>
              ))}
            </select>
          </label>
        </div>

        {primaryFields.length > 0 && (
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {primaryFields.map((f) => (
              <label key={f.id} className="block text-xs text-white/55">
                {cadernoFieldLabel(f.id, loc)}
                {f.required ? ' *' : ''}
                {f.input === 'select' ? (
                  <select
                    value={form[f.id]}
                    onChange={(e) => setField(f.id, e.target.value)}
                    className="mt-1 w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-teal-500/40"
                  >
                    <option value="">{radarT(loc, 'Escolher…', 'Elegir…', 'Choose…')}</option>
                    {(f.options || []).map((o) => (
                      <option key={o.value} value={o.value}>
                        {radarT(loc, o.pt, o.es, o.en)}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type={f.input === 'number' ? 'number' : 'text'}
                    inputMode={f.input === 'number' ? 'decimal' : undefined}
                    step={f.input === 'number' ? 'any' : undefined}
                    value={form[f.id]}
                    onChange={(e) => setField(f.id, e.target.value)}
                    placeholder={cadernoFieldPlaceholder(f.id, loc)}
                    className="mt-1 w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none placeholder:text-white/30 focus:ring-2 focus:ring-teal-500/40"
                  />
                )}
              </label>
            ))}
          </div>
        )}

        {noteField && (
          <label className="mt-3 block text-xs text-white/55">
            {cadernoFieldLabel('note', loc)}
            {noteField.required ? ' *' : ''}
            <textarea
              value={form.note}
              onChange={(e) => setField('note', e.target.value)}
              rows={2}
              placeholder={cadernoFieldPlaceholder('note', loc) || copy.notesPlaceholder}
              className="mt-1 w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none placeholder:text-white/30 focus:ring-2 focus:ring-teal-500/40"
            />
          </label>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={busy || !canSave || !propertyId}
            onClick={() => void save()}
            className="inline-flex items-center gap-2 rounded-xl bg-teal-500 px-4 py-2.5 text-sm font-semibold text-slate-950 disabled:opacity-40"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <BookOpen className="h-4 w-4" />}
            {radarT(loc, 'Guardar no caderno', 'Guardar en el cuaderno', 'Save to notebook')}
          </button>
          {ok && <p className="text-sm text-emerald-300">{radarT(loc, 'Guardado', 'Guardado', 'Saved')}</p>}
          {err && <p className="text-sm text-rose-300">{err}</p>}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-white/70">
          {radarT(loc, 'Registos recentes', 'Registros recientes', 'Recent entries')}
        </h2>
        {loading ? (
          <Loader2 className="h-6 w-6 animate-spin text-teal-300" />
        ) : entries.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/15 px-5 py-10 text-center">
            <BookOpen className="mx-auto h-7 w-7 text-teal-300/60" />
            <p className="mt-3 text-sm text-white/55">{copy.empty}</p>
          </div>
        ) : (
          <ul className="divide-y divide-white/10 rounded-2xl border border-white/12 bg-slate-950/60">
            {entries.map((e) => {
              const payload =
                e.payload && typeof e.payload === 'object' ? (e.payload as Record<string, unknown>) : null;
              const extra = payloadExtraLine(payload, loc);
              return (
                <li key={e.id} className="flex items-start justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-sm text-white">
                      <span className="font-medium text-teal-200/90">{cadernoKindLabel(e.kind, loc)}</span>
                      {e.unitName ? (
                        <span className="text-white/45">
                          {' · '}
                          {e.unitName}
                        </span>
                      ) : null}
                    </p>
                    <p className="mt-0.5 text-sm text-white/70">{e.note || extra || '—'}</p>
                    {extra && e.note && e.note !== extra ? (
                      <p className="mt-0.5 text-xs text-white/40">{extra}</p>
                    ) : null}
                    <p className="mt-1 text-[11px] text-white/35">
                      {new Date(e.occurredAt).toLocaleString(loc === 'es' ? 'es' : loc === 'en' ? 'en' : 'pt-BR', {
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                      {e.authorName ? ` · ${e.authorName}` : ''}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void remove(e.id)}
                    className="shrink-0 rounded-lg p-2 text-white/35 hover:bg-white/5 hover:text-rose-300"
                    title={radarT(loc, 'Apagar', 'Borrar', 'Delete')}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
