'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Loader2, Radio, Sprout } from 'lucide-react';
import { RADAR_MODULES, type RadarModuleId } from '@/lib/etholys-products';
import { isRadarModuleId, spaceKindMeta } from '@/lib/radar/space';
import { radarLoc, radarT } from '@/lib/radar/i18n';
import { PROPERTY_STEP_COPY, type PropertyStepId, type PropertyStepState } from '@/lib/radar/property-progress';
import { RadarGeoPin } from '@/components/radar/RadarGeoPin';
import { RadarSiteMap } from '@/components/radar/RadarSiteMap';
import { RadarSpatialTwin } from '@/components/radar/RadarSpatialTwin';
import { RadarCropsPanel } from '@/components/radar/RadarCropsPanel';
import { RadarAddParcelForm } from '@/components/radar/RadarAddParcelForm';
import { RadarFocusSheet } from '@/components/radar/RadarFocusSheet';
import { RadarSpaceTree } from '@/components/radar/RadarSpaceTree';
import type { RadarCrop } from '@/lib/radar/site-layout';
import { MOISTURE_THRESHOLD } from '@/lib/radar/agriculture';
import { RADAR_DEVICE_CATALOG } from '@/lib/radar/devices';
import { isTraceStage, TRACE_STAGE_LABEL, type TraceStage } from '@/lib/radar/trace';

type Loc = 'pt' | 'es' | 'en';

type PropertyDetail = {
  id: string;
  name: string;
  moduleId: string | null;
  crop: string | null;
  areaHa: number | null;
  lat: number | null;
  lng: number | null;
  clientId: string | null;
  clientName: string | null;
  units: Array<{
    id: string;
    name: string;
    kind: string;
    crop: string | null;
    areaHa: number | null;
    moisture?: number | null;
  }>;
  sensors: Array<{
    id: string;
    name: string;
    metric: string;
    unitId: string | null;
    lastValue?: number | null;
  }>;
  crops?: RadarCrop[];
  latestByUnit?: Record<string, Record<string, number>>;
  devices?: Array<{ sensorId: string; sku: string; devEui: string | null; unitId: string | null }>;
  steps: PropertyStepState[];
  nextStep: PropertyStepId;
  progressPercent: number;
};

export function RadarPropertyWorkspace({
  companyId,
  propertyId,
  engagementId,
  locale,
  backHref,
  initialUnitId,
}: {
  companyId: string;
  propertyId: string;
  engagementId?: string | null;
  locale: string;
  backHref: string;
  initialUnitId?: string | null;
}) {
  const loc = radarLoc(locale);
  const [data, setData] = useState<PropertyDetail | null>(null);
  const [step, setStep] = useState<PropertyStepId>('characterize');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [tokenFlash, setTokenFlash] = useState<string | null>(null);

  // characterize form
  const [name, setName] = useState('');
  const [moduleId, setModuleId] = useState<RadarModuleId | null>(null);
  const [crop, setCrop] = useState('');
  const [area, setArea] = useState('');
  const [sensorName, setSensorName] = useState('');
  const [sensorSku, setSensorSku] = useState('SE01-LB');
  const [devEui, setDevEui] = useState('');
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [addingParcel, setAddingParcel] = useState(false);
  const [panel, setPanel] = useState<PropertyStepId | null>(null);
  const [tool, setTool] = useState<'crops' | 'space' | null>(null);
  const [openLot, setOpenLot] = useState<{ code: string; currentStage: TraceStage } | null>(null);

  const load = useCallback(async () => {
    if (!companyId || !propertyId) return;
    setLoading(true);
    setErr(null);
    try {
      const q = new URLSearchParams({ companyId });
      if (engagementId) q.set('engagementId', engagementId);
      const r = await fetch(`/api/radar/properties/${propertyId}?${q}`);
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Falha');
      const p = d.property as PropertyDetail;
      p.crops = Array.isArray(p.crops) ? p.crops : [];
      setData(p);
      setName(p.name);
      setModuleId(p.moduleId && isRadarModuleId(p.moduleId) ? p.moduleId : null);
      setCrop(p.crop || '');
      setArea(p.areaHa != null ? String(p.areaHa) : '');
      setStep((prev) => (p.steps.some((s) => s.id === prev) ? prev : p.nextStep));
      const prefer =
        (initialUnitId && p.units.some((u) => u.id === initialUnitId) && initialUnitId) ||
        p.units[0]?.id ||
        null;
      setFocusedId(prefer);
      if (!Array.isArray(p.crops)) (p as PropertyDetail).crops = [];
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro');
    } finally {
      setLoading(false);
    }
  }, [companyId, propertyId, engagementId, initialUnitId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!companyId) return;
    let cancelled = false;
    void (async () => {
      const q = new URLSearchParams({ companyId });
      if (engagementId) q.set('engagementId', engagementId);
      const r = await fetch(`/api/radar/lots?${q}`, { cache: 'no-store' });
      const d = await r.json().catch(() => ({}));
      if (cancelled || !r.ok) return;
      const open = (d.lots || []).find((l: { status: string }) => l.status === 'open');
      if (open && isTraceStage(open.currentStage)) {
        setOpenLot({ code: open.code, currentStage: open.currentStage });
      } else setOpenLot(null);
    })();
    return () => {
      cancelled = true;
    };
  }, [companyId, engagementId, data?.id]);

  const patch = async (payload: Record<string, unknown>) => {
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch(`/api/radar/properties/${propertyId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, engagementId, ...payload }),
      });
      const d = await r.json();
      if (!r.ok) {
        const msg = typeof d.error === 'string' ? d.error : 'Falha ao gravar';
        setErr(msg);
        throw new Error(msg);
      }
      return d;
    } finally {
      setBusy(false);
    }
  };

  if (loading && !data) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-emerald-300" />
      </div>
    );
  }

  if (!data) {
    return <p className="text-sm text-rose-200">{err || '—'}</p>;
  }

  const characterized = data.steps.find((s) => s.id === 'characterize')?.done;
  const kindMeta = spaceKindMeta(data.moduleId);
  const mapParcels = data.units
    .filter((u) => u.kind === 'parcel' || u.kind === 'lot' || u.kind === 'herd' || u.kind === 'generic')
    .map((u) => {
      const moisture = u.moisture ?? null;
      const nextAction =
        moisture != null && moisture < MOISTURE_THRESHOLD ? ('irrigate' as const) : ('ok' as const);
      return {
        id: u.id,
        name: u.name,
        crop: u.crop,
        areaHa: u.areaHa,
        moisture,
        nextAction,
        harvestBlocked: false,
        alerts: [] as Array<{ severity: string }>,
      };
    });

  const next = data.steps.find((s) => !s.done) ?? null;
  const companyQ = engagementId
    ? `company=${companyId}&engagement=${engagementId}`
    : `company=${companyId}`;
  const chainHref = `/hub/radar/cadeia?${companyQ}`;
  const openStep = (id: PropertyStepId) => {
    setPanel((cur) => (cur === id ? null : id));
    setStep(id);
    if (id !== 'draw') setTool(null);
  };
  const nextLabel: Record<PropertyStepId, string> = {
    characterize: radarT(loc, 'Falta caracterizar o sítio', 'Falta caracterizar el sitio', 'Characterize this site'),
    draw: radarT(loc, 'Falta criar o primeiro espaço', 'Falta crear el primer espacio', 'Add the first space'),
    geolocate: radarT(loc, 'Falta marcar o sítio no mapa', 'Falta marcar el sitio en el mapa', 'Pin this site'),
    sensors: radarT(loc, 'Falta ligar sensores', 'Falta conectar sensores', 'Connect sensors'),
  };
  const nextButton: Record<PropertyStepId, string> = {
    characterize: radarT(loc, 'Caracterizar', 'Caracterizar', 'Characterize'),
    draw: radarT(loc, 'Novo espaço', 'Nuevo espacio', 'New space'),
    geolocate: radarT(loc, 'Marcar no mapa', 'Marcar en el mapa', 'Pin on map'),
    sensors: radarT(loc, 'Ligar sensores', 'Conectar sensores', 'Connect sensors'),
  };
  const actionBtn = (on: boolean) =>
    `rounded-lg px-3.5 py-2 text-sm font-semibold shadow-sm ${
      on ? 'bg-emerald-400 text-slate-950' : 'bg-white text-slate-900 hover:bg-emerald-50'
    }`;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href={backHref} className="inline-flex items-center gap-1.5 text-xs text-white/45 hover:text-white/70">
            <ArrowLeft className="h-3.5 w-3.5" />
            {radarT(loc, 'Lugares', 'Lugares', 'Places')}
          </Link>
          <h1 className="mt-1 font-serif text-3xl text-white sm:text-4xl">{data.name}</h1>
          {data.clientName && <p className="mt-0.5 text-sm text-white/45">{data.clientName}</p>}
        </div>
        {!next && (
          <button type="button" onClick={() => openStep('characterize')} className={actionBtn(panel === 'characterize')}>
            {radarT(loc, 'Ficha', 'Ficha', 'File')}
          </button>
        )}
      </div>

      {err && <p className="rounded-xl border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">{err}</p>}

      {next && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-amber-50 px-4 py-3 text-amber-950">
          <p className="text-sm font-semibold">{nextLabel[next.id]}</p>
          <button
            type="button"
            onClick={() => openStep(next.id)}
            className="rounded-lg bg-slate-950 px-3.5 py-2 text-sm font-semibold text-white"
          >
            {panel === next.id
              ? radarT(loc, 'Fechar', 'Cerrar', 'Close')
              : nextButton[next.id]}
          </button>
        </div>
      )}

      <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setTool(tool === 'space' ? null : 'space');
                setPanel(null);
              }}
              className={actionBtn(tool === 'space')}
            >
              {radarT(loc, 'Novo espaço', 'Nuevo espacio', 'New space')}
            </button>
            {data.moduleId === 'agriculture' && (
              <button
                type="button"
                onClick={() => {
                  setTool(tool === 'crops' ? null : 'crops');
                  setPanel(null);
                }}
                className={actionBtn(tool === 'crops')}
              >
                {radarT(loc, 'Cultivos', 'Cultivos', 'Crops')}
              </button>
            )}
            <button
              type="button"
              onClick={() => openStep('sensors')}
              className={actionBtn(panel === 'sensors')}
            >
              {radarT(loc, 'Sensores', 'Sensores', 'Sensors')}
            </button>
          </div>
          {tool === 'crops' && data.moduleId === 'agriculture' && (
            <RadarCropsPanel
              locale={loc}
              crops={data.crops || []}
              busy={busy}
              onAdd={async (input) => {
                await patch({ action: 'crop_add', ...input });
                await load();
              }}
              onRemove={async (cropId) => {
                await patch({ action: 'crop_remove', cropId });
                await load();
              }}
            />
          )}
          {tool === 'space' && (
            <RadarAddParcelForm
              locale={loc}
              moduleId={data.moduleId}
              crops={data.crops || []}
              busy={busy}
              onCancel={() => setTool(null)}
              onSubmit={async (input) => {
                const d = await patch({ action: 'parcel', ...input });
                await load();
                if (d?.unit?.id) setFocusedId(d.unit.id as string);
                setTool(null);
              }}
            />
          )}
          {openLot && (
            <Link href={chainHref} className="text-xs text-emerald-300/80 hover:text-emerald-200">
              {radarT(loc, 'Lote', 'Lote', 'Lot')} {openLot.code} · {TRACE_STAGE_LABEL[openLot.currentStage][loc]} →
            </Link>
          )}
          {/* Ref pattern: tree (nav) | plant map | what to do */}
          <div className="grid gap-2 lg:grid-cols-[minmax(148px,188px)_minmax(0,1fr)_minmax(220px,260px)] lg:items-stretch">
            <RadarSpaceTree
              locale={loc}
              moduleId={data.moduleId}
              propertyName={data.name}
              units={data.units}
              sensors={data.sensors}
              focusedId={focusedId}
              onFocus={setFocusedId}
            />
            <div className="relative min-h-0 min-w-0">
            <RadarSpatialTwin
              locale={loc}
              moduleId={data.moduleId}
              parcels={mapParcels}
              sensors={data.sensors.map((s) => ({
                id: s.id,
                name: s.name,
                unitId: s.unitId,
                lastValue: s.lastValue ?? null,
              }))}
              focusedId={focusedId}
              onFocus={setFocusedId}
              hero
            />
              {panel && (
                <div className="absolute inset-x-3 top-3 z-20 max-h-[min(72%,34rem)] overflow-y-auto rounded-xl border border-slate-700 bg-slate-950 px-4 py-4 shadow-2xl">
<div className="mb-4 flex flex-wrap gap-2">
              {data.steps.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => {
                    setPanel(s.id);
                    setStep(s.id);
                  }}
                  className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold ${
                    panel === s.id ? 'bg-white text-slate-950' : 'bg-slate-800 text-slate-100'
                  }`}
                >
                  {PROPERTY_STEP_COPY[s.id][loc].label}
                </button>
              ))}
            </div>
            {step === 'characterize' && (
          <div className="space-y-5">
            <div>
              <h2 className="font-serif text-2xl text-white">
                {loc === 'es' ? 'Caracterizar' : loc === 'en' ? 'Characterize' : 'Caracterizar'}
              </h2>
              <p className="mt-1 text-sm text-white/55">
                {radarT(loc, 'Tipo, cultura e hectares.', 'Tipo, cultivo y hectáreas.', 'Type, crop and hectares.')}
              </p>
            </div>
            <label className="block">
              <span className="text-xs uppercase tracking-wide text-white/45">
                {radarT(loc, 'Nome', 'Nombre', 'Name')}
              </span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-2 w-full rounded-2xl border border-white/15 bg-black/30 px-4 py-3 text-sm text-white outline-none focus:ring-2 focus:ring-emerald-400/40"
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              {RADAR_MODULES.map((m) => {
                const active = moduleId === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => isRadarModuleId(m.id) && setModuleId(m.id)}
                    className={`rounded-2xl border px-4 py-4 text-left ${
                      active ? 'border-emerald-400/50 bg-emerald-500/15' : 'border-white/10 bg-white/[0.03]'
                    }`}
                  >
                    <p className="font-medium text-white">{m[loc]}</p>
                    <p className="mt-1 text-xs text-white/45">{m.hint[loc]}</p>
                  </button>
                );
              })}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="text-xs uppercase tracking-wide text-white/45">
                  {moduleId ? spaceKindMeta(moduleId).secondaryLabel[loc] : loc === 'es' ? 'Cultivo' : loc === 'en' ? 'Crop' : 'Cultura'}
                </span>
                <input
                  value={crop}
                  onChange={(e) => setCrop(e.target.value)}
                  className="mt-2 w-full rounded-2xl border border-white/15 bg-black/30 px-4 py-3 text-sm text-white outline-none focus:ring-2 focus:ring-emerald-400/40"
                />
              </label>
              <label className="block">
                <span className="text-xs uppercase tracking-wide text-white/45">
                  {moduleId ? spaceKindMeta(moduleId).areaUnit[loc] : 'ha'}
                </span>
                <input
                  value={area}
                  onChange={(e) => setArea(e.target.value)}
                  inputMode="decimal"
                  className="mt-2 w-full rounded-2xl border border-white/15 bg-black/30 px-4 py-3 text-sm text-white outline-none focus:ring-2 focus:ring-emerald-400/40"
                />
              </label>
            </div>
            <button
              type="button"
              disabled={busy || !moduleId || name.trim().length < 2}
              onClick={() =>
                void patch({
                  action: 'characterize',
                  name,
                  moduleId,
                  crop,
                  areaHa: area ? Number(area) : null,
                })
                  .then(() => load())
                  .then(() => setPanel(null))
                  .catch((e) => setErr(e.message))
              }
              className="inline-flex items-center gap-2 rounded-2xl bg-emerald-400 px-5 py-3 text-sm font-semibold text-slate-950 disabled:opacity-40"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sprout className="h-4 w-4" />}
              {radarT(loc, 'Guardar', 'Guardar', 'Save')}
            </button>
          </div>
        )}

        {step === 'draw' && (
          <div className="space-y-5">
            <div>
              <h2 className="font-serif text-2xl text-white">{kindMeta.drawTitle[loc]}</h2>
              <p className="mt-1 text-sm text-white/55">{kindMeta.hint[loc]}</p>
            </div>
            {!characterized ? (
              <EmptyHint
                locale={loc}
                text={radarT(loc, 'Caracteriza o sítio primeiro.', 'Caracterizá el sitio primero.', 'Characterize the site first.')}
                onClick={() => {
                  setPanel('characterize');
                  setStep('characterize');
                }}
              />
            ) : (
              <>
                {data.moduleId === 'agriculture' && (
                  <RadarCropsPanel
                    locale={loc}
                    crops={data.crops || []}
                    busy={busy}
                    onAdd={async (input) => {
                      await patch({ action: 'crop_add', ...input });
                      await load();
                    }}
                    onRemove={async (cropId) => {
                      await patch({ action: 'crop_remove', cropId });
                      await load();
                    }}
                  />
                )}

                {addingParcel || mapParcels.length === 0 ? (
                  <RadarAddParcelForm
                    locale={loc}
                    moduleId={data.moduleId}
                    crops={data.crops || []}
                    busy={busy}
                    onCancel={mapParcels.length > 0 ? () => setAddingParcel(false) : undefined}
                    onSubmit={async (input) => {
                      const d = await patch({ action: 'parcel', ...input });
                      setAddingParcel(false);
                      await load();
                      if (d?.unit?.id) setFocusedId(d.unit.id as string);
                    }}
                  />
                ) : null}

                <RadarSiteMap
                  companyId={companyId}
                  engagementId={engagementId}
                  propertyId={propertyId}
                  locale={loc}
                  moduleId={data.moduleId}
                  mode="empresa"
                  parcels={mapParcels}
                  sensors={data.sensors.map((s) => ({
                    id: s.id,
                    name: s.name,
                    unitId: s.unitId,
                    lastValue: s.lastValue ?? null,
                  }))}
                  focusedId={focusedId}
                  onFocus={setFocusedId}
                  onSaved={() => void load()}
                  onRequestAddParcel={() => setAddingParcel(true)}
                />

                {focusedId && mapParcels.length > 0 && data.moduleId === 'agriculture' && (
                  <ParcelAssignCrop
                    locale={loc}
                    unit={data.units.find((u) => u.id === focusedId)}
                    crops={data.crops || []}
                    busy={busy}
                    onSave={async (cropName) => {
                      await patch({ action: 'parcel_update', unitId: focusedId, crop: cropName });
                      await load();
                    }}
                  />
                )}
              </>
            )}
          </div>
        )}

        {step === 'geolocate' && (
          <RadarGeoPin
            locale={loc}
            lat={data.lat}
            lng={data.lng}
            busy={busy}
            onSave={async (lat, lng) => {
              await patch({ action: 'geolocate', lat, lng });
              await load();
              setPanel(null);
            }}
          />
        )}

        {step === 'sensors' && (
          <div className="space-y-5">
            <div>
              <h2 className="font-serif text-2xl text-white">
                {radarT(loc, 'Sensores', 'Sensores', 'Sensors')}
              </h2>
              <p className="mt-1 text-sm text-white/55">
                {radarT(
                  loc,
                  'Aparelho, espaço e DevEUI. O token aparece uma vez.',
                  'Equipo, espacio y DevEUI. El token aparece una vez.',
                  'Device, space and DevEUI. The token is shown once.',
                )}
              </p>
            </div>
            {data.sensors.length > 0 && (
              <ul className="space-y-2">
                {data.sensors.map((s) => (
                  <li
                    key={s.id}
                    className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white/80"
                  >
                    <Radio className="h-4 w-4 text-emerald-300" />
                    <span>{s.name}</span>
                    <span className="text-white/35">· {s.metric}</span>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex flex-wrap gap-2">
              <select
                value={sensorSku}
                onChange={(e) => setSensorSku(e.target.value)}
                className="min-w-[14rem] rounded-2xl border border-slate-500 bg-slate-950 px-3 py-3 text-sm text-slate-100 [&>option]:bg-slate-950 [&>option]:text-slate-100"
              >
                {RADAR_DEVICE_CATALOG.map((d) => (
                  <option key={d.sku} value={d.sku}>
                    {d.sku} — {d.label[loc]}
                  </option>
                ))}
              </select>
              <input
                value={sensorName}
                onChange={(e) => setSensorName(e.target.value)}
                placeholder={radarT(loc, 'Nome no sítio', 'Nombre en el sitio', 'Name on the site')}
                className="min-w-[12rem] flex-1 rounded-2xl border border-white/15 bg-black/30 px-4 py-3 text-sm text-white outline-none focus:ring-2 focus:ring-emerald-400/40"
              />
              <input
                value={devEui}
                onChange={(e) => setDevEui(e.target.value)}
                placeholder="DevEUI"
                className="min-w-[10rem] rounded-2xl border border-white/15 bg-black/30 px-4 py-3 text-sm text-white outline-none focus:ring-2 focus:ring-emerald-400/40"
              />
              <button
                type="button"
                disabled={busy || sensorName.trim().length < 2}
                onClick={() =>
                  void patch({
                    action: 'sensor',
                    name: sensorName,
                    sku: sensorSku,
                    devEui,
                    unitId: focusedId || data.units[0]?.id,
                  })
                    .then((d) => {
                      setTokenFlash(`${d.token as string}  →  ${d.ingestPath as string}`);
                      setSensorName('');
                      setDevEui('');
                      return load();
                    })
                    .catch((e) => setErr(e.message))
                }
                className="inline-flex items-center gap-2 rounded-2xl bg-emerald-400 px-5 py-3 text-sm font-semibold text-slate-950 disabled:opacity-40"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Radio className="h-4 w-4" />}
                {radarT(loc, 'Emitir token', 'Emitir token', 'Issue token')}
              </button>
            </div>
            {tokenFlash && (
              <div className="rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-50">
                <p className="font-medium">{radarT(loc, 'Copia agora', 'Copiá ahora', 'Copy now')}</p>
                <code className="mt-1 block break-all text-xs">{tokenFlash}</code>
              </div>
            )}
          </div>
        )}
                </div>
              )}
            </div>
            <RadarFocusSheet
              companyId={companyId}
              engagementId={engagementId}
              propertyId={propertyId}
              locale={loc}
              moduleId={data.moduleId}
              units={data.units}
              focusedId={focusedId}
              latest={focusedId ? data.latestByUnit?.[focusedId] : null}
              hasValve={Boolean(
                data.devices?.some((d) => d.unitId === focusedId && d.sku === 'SVC01-LS2'),
              )}
            />
          </div>
        </div>

    </div>
  );
}

function EmptyHint({ locale, text, onClick }: { locale: Loc; text: string; onClick: () => void }) {
  return (
    <div className="rounded-2xl border border-dashed border-white/15 bg-black/20 px-6 py-10 text-center">
      <p className="text-sm text-white/55">{text}</p>
      <button
        type="button"
        onClick={onClick}
        className="mt-4 rounded-xl bg-emerald-500/90 px-4 py-2 text-sm font-semibold text-[#04110c]"
      >
        {locale === 'en' ? 'Go' : 'Ir'}
      </button>
    </div>
  );
}

function ParcelAssignCrop({
  locale,
  unit,
  crops,
  busy,
  onSave,
}: {
  locale: Loc;
  unit?: { id: string; name: string; crop: string | null };
  crops: RadarCrop[];
  busy?: boolean;
  onSave: (crop: string) => Promise<void>;
}) {
  const [crop, setCrop] = useState(unit?.crop || '');
  useEffect(() => {
    setCrop(unit?.crop || '');
  }, [unit?.id, unit?.crop]);
  if (!unit) return null;
  return (
    <div className="flex flex-wrap items-end gap-2 rounded-xl border border-white/10 bg-black/20 px-4 py-3">
      <div className="min-w-[10rem] flex-1">
        <p className="text-[10px] uppercase tracking-wide text-white/40">
          {locale === 'es' ? 'Cultivo en' : locale === 'en' ? 'Crop on' : 'Cultivo em'} {unit.name}
        </p>
        {crops.length > 0 ? (
          <select
            value={crop}
            onChange={(e) => setCrop(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-500 bg-slate-950 px-3 py-2 text-sm text-slate-100"
          >
            <option value="">{locale === 'es' ? 'Ninguno' : locale === 'en' ? 'None' : 'Nenhum'}</option>
            {crops.map((c) => (
              <option key={c.id} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>
        ) : (
          <input
            value={crop}
            onChange={(e) => setCrop(e.target.value)}
            className="mt-1 w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm text-white"
            placeholder={locale === 'en' ? 'Crop name' : 'Nome do cultivo'}
          />
        )}
      </div>
      <button
        type="button"
        disabled={busy}
        onClick={() => void onSave(crop)}
        className="rounded-lg bg-emerald-500/90 px-3 py-2 text-xs font-semibold text-[#04110c] disabled:opacity-40"
      >
        {locale === 'en' ? 'Assign' : 'Associar'}
      </button>
    </div>
  );
}
