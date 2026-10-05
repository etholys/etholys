'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Loader2, Radio, Sprout } from 'lucide-react';
import { RADAR_MODULES, type RadarModuleId } from '@/lib/etholys-products';
import { isRadarModuleId, spaceKindMeta } from '@/lib/radar/space';
import type { PropertyStepId, PropertyStepState } from '@/lib/radar/property-progress';
import { RadarProgressRail } from '@/components/radar/RadarProgressRail';
import { RadarGeoPin } from '@/components/radar/RadarGeoPin';
import { RadarSiteMap } from '@/components/radar/RadarSiteMap';
import { RadarOpsView } from '@/components/radar/RadarViews';
import { RadarCropsPanel } from '@/components/radar/RadarCropsPanel';
import { RadarAddParcelForm } from '@/components/radar/RadarAddParcelForm';
import { RadarChainBoard } from '@/components/radar/RadarChainBoard';
import { RadarSpaceOpsPanel } from '@/components/radar/RadarSpaceOpsPanel';
import type { RadarCrop } from '@/lib/radar/site-layout';

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
  units: Array<{ id: string; name: string; kind: string; crop: string | null; areaHa: number | null }>;
  sensors: Array<{ id: string; name: string; metric: string; unitId: string | null }>;
  crops?: RadarCrop[];
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
}: {
  companyId: string;
  propertyId: string;
  engagementId?: string | null;
  locale: string;
  backHref: string;
}) {
  const loc: Loc = locale === 'es' || locale === 'en' ? locale : 'pt';
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
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [addingParcel, setAddingParcel] = useState(false);
  const [mode, setMode] = useState<'operate' | 'setup'>('operate');

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
      setFocusedId(p.units[0]?.id || null);
      if (!Array.isArray(p.crops)) (p as PropertyDetail).crops = [];
      const done = Boolean(p.steps.find((s) => s.id === 'characterize')?.done);
      if (!done) {
        setMode('setup');
        setStep('characterize');
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro');
    } finally {
      setLoading(false);
    }
  }, [companyId, propertyId, engagementId]);

  useEffect(() => {
    void load();
  }, [load]);

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
      if (!r.ok) throw new Error(d.error || 'Falha');
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
    .map((u) => ({
      id: u.id,
      name: u.name,
      crop: u.crop,
      areaHa: u.areaHa,
      moisture: null as number | null,
      nextAction: 'ok' as const,
      harvestBlocked: false,
      alerts: [] as Array<{ severity: string }>,
    }));

  const showOperate = Boolean(characterized) && mode === 'operate';
  const companyQ = engagementId
    ? `company=${companyId}&engagement=${engagementId}`
    : `company=${companyId}`;
  const chainHref = `/hub/radar/cadeia?${companyQ}`;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href={backHref} className="inline-flex items-center gap-1.5 text-xs text-white/45 hover:text-white/70">
            <ArrowLeft className="h-3.5 w-3.5" />
            {loc === 'es' ? 'Volver' : loc === 'en' ? 'Back' : 'Voltar'}
          </Link>
          <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/40">
            RADAR · {data.clientName || (loc === 'en' ? 'Space' : 'Espaço')}
          </p>
          <h1 className="mt-1 font-serif text-3xl text-white sm:text-4xl">{data.name}</h1>
        </div>
        {characterized && (
          <div className="inline-flex rounded-xl border border-white/15 bg-black/20 p-1">
            <button
              type="button"
              onClick={() => setMode('operate')}
              className={`rounded-lg px-3 py-1.5 text-xs ${mode === 'operate' ? 'bg-emerald-500 font-semibold text-[#04110c]' : 'text-white/60'}`}
            >
              {loc === 'en' ? 'Operate' : 'Operar'}
            </button>
            <button
              type="button"
              onClick={() => setMode('setup')}
              className={`rounded-lg px-3 py-1.5 text-xs ${mode === 'setup' ? 'bg-emerald-500 font-semibold text-[#04110c]' : 'text-white/60'}`}
            >
              {loc === 'en' ? 'Setup' : 'Configurar'}
            </button>
          </div>
        )}
      </div>

      {err && <p className="rounded-xl border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">{err}</p>}

      {showOperate ? (
        <div className="space-y-6">
          <RadarSiteMap
            companyId={companyId}
            engagementId={engagementId}
            propertyId={propertyId}
            locale={loc}
            mode="ops"
            parcels={mapParcels}
            sensors={data.sensors.map((s) => ({
              id: s.id,
              name: s.name,
              unitId: s.unitId,
              lastValue: null,
            }))}
            focusedId={focusedId}
            onFocus={setFocusedId}
            onSaved={() => void load()}
            onRequestAddParcel={() => {
              setMode('setup');
              setStep('draw');
              setAddingParcel(true);
            }}
          />

          {data.moduleId === 'agriculture' ? (
            <RadarOpsView companyId={companyId} engagementId={engagementId} locale={loc} />
          ) : (
            <div className="space-y-4">
              <RadarSpaceOpsPanel
                companyId={companyId}
                engagementId={engagementId}
                locale={loc}
                moduleId={data.moduleId}
                propertyName={data.name}
                units={data.units}
                focusedId={focusedId}
                onFocus={setFocusedId}
                chainHref={chainHref}
              />
              <RadarChainBoard
                companyId={companyId}
                engagementId={engagementId}
                locale={loc}
                unitId={focusedId}
                unitCrop={data.units.find((u) => u.id === focusedId)?.crop || data.crop}
                unitOptions={data.units.map((u) => ({
                  id: u.id,
                  name: u.name,
                  crop: u.crop,
                  propertyName: data.name,
                }))}
              />
            </div>
          )}
        </div>
      ) : (
        <>
          <RadarProgressRail
            steps={data.steps}
            active={step}
            locale={loc}
            percent={data.progressPercent}
            onSelect={setStep}
          />

          <div className="rounded-[1.5rem] border border-white/10 bg-gradient-to-br from-white/[0.05] to-transparent px-5 py-6 sm:px-7">
            {/* setup steps stay below — unchanged block continues */}
            {step === 'characterize' && (
          <div className="space-y-5">
            <div>
              <h2 className="font-serif text-2xl text-white">
                {loc === 'es' ? 'Caracterizar' : loc === 'en' ? 'Characterize' : 'Caracterizar'}
              </h2>
              <p className="mt-1 text-sm text-white/55">
                {loc === 'es'
                  ? 'Tipo productivo, cultivo y área. Esto abre el lazo operativo.'
                  : loc === 'en'
                    ? 'Productive type, crop and area. This opens the ops loop.'
                    : 'Tipo produtivo, cultura e área. Isto abre o laço operativo.'}
              </p>
            </div>
            <label className="block">
              <span className="text-xs uppercase tracking-wide text-white/45">
                {loc === 'en' ? 'Name' : 'Nome'}
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
                  .then(() => {
                    setMode('setup');
                    setStep('draw');
                  })
                  .catch((e) => setErr(e.message))
              }
              className="inline-flex items-center gap-2 rounded-2xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-[#04110c] disabled:opacity-40"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sprout className="h-4 w-4" />}
              {loc === 'en' ? 'Save & continue' : 'Guardar e continuar'}
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
                text={
                  loc === 'en'
                    ? 'Characterize the property first.'
                    : 'Caracteriza a propriedade primeiro.'
                }
                onClick={() => setStep('characterize')}
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
                  mode="empresa"
                  parcels={mapParcels}
                  sensors={data.sensors.map((s) => ({
                    id: s.id,
                    name: s.name,
                    unitId: s.unitId,
                    lastValue: null,
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
            {characterized && (
              <button
                type="button"
                onClick={() => setStep('geolocate')}
                className="rounded-2xl border border-white/15 px-4 py-2.5 text-sm text-white/80"
              >
                {loc === 'en' ? 'Continue to geolocate' : 'Continuar para geolocalizar'}
              </button>
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
              setStep('sensors');
            }}
          />
        )}

        {step === 'sensors' && (
          <div className="space-y-5">
            <div>
              <h2 className="font-serif text-2xl text-white">
                {loc === 'es' ? 'Conectar sensores' : loc === 'en' ? 'Connect sensors' : 'Conectar sensores'}
              </h2>
              <p className="mt-1 text-sm text-white/55">
                {loc === 'es'
                  ? 'Emití un token de ingest. Guardalo — solo se muestra una vez.'
                  : loc === 'en'
                    ? 'Issue an ingest token. Save it — shown only once.'
                    : 'Emite um token de ingest. Guarda-o — só aparece uma vez.'}
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
              <input
                value={sensorName}
                onChange={(e) => setSensorName(e.target.value)}
                placeholder={loc === 'en' ? 'Sensor name' : 'Nome do sensor'}
                className="min-w-[12rem] flex-1 rounded-2xl border border-white/15 bg-black/30 px-4 py-3 text-sm text-white outline-none focus:ring-2 focus:ring-emerald-400/40"
              />
              <button
                type="button"
                disabled={busy || sensorName.trim().length < 2}
                onClick={() =>
                  void patch({
                    action: 'sensor',
                    name: sensorName,
                    metric: 'soil_moisture',
                    unitId: focusedId || data.units[0]?.id,
                  })
                    .then((d) => {
                      setTokenFlash(d.token as string);
                      setSensorName('');
                      return load();
                    })
                    .catch((e) => setErr(e.message))
                }
                className="inline-flex items-center gap-2 rounded-2xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-[#04110c] disabled:opacity-40"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Radio className="h-4 w-4" />}
                {loc === 'en' ? 'Issue token' : 'Emitir token'}
              </button>
            </div>
            {tokenFlash && (
              <div className="rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-50">
                <p className="font-medium">{loc === 'en' ? 'Copy now' : 'Copia agora'}</p>
                <code className="mt-1 block break-all text-xs">{tokenFlash}</code>
              </div>
            )}
          </div>
        )}
      </div>
        </>
      )}
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
          {locale === 'en' ? 'Crop on' : 'Cultivo em'} {unit.name}
        </p>
        {crops.length > 0 ? (
          <select
            value={crop}
            onChange={(e) => setCrop(e.target.value)}
            className="mt-1 w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm text-white"
          >
            <option value="">{locale === 'en' ? 'None' : 'Nenhum'}</option>
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
