'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useApp } from '@/app/providers';

type PropertyRow = { id: string; name: string; lat: number | null; lng: number | null; areaHa: number | null; crop: string | null };
type ObjectiveRow = { id: string; code: string | null; title: string; indicator: string | null; unitOfMeasure: string | null };
type VisitRow = {
  id: string;
  activityLabel: string;
  whatDone: string;
  lat: number;
  lng: number;
  onSite: boolean;
  distanceM: number | null;
  occurredAt: string;
  propertyId: string | null;
  objectiveId: string | null;
  hasPhoto: boolean;
};

function CampoInner() {
  const { locale } = useApp();
  const loc = locale === 'es' || locale === 'en' ? locale : 'pt';
  const search = useSearchParams();
  const companyId = String(search.get('company') || '').trim();
  const engagementId = String(search.get('engagement') || '').trim();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [mode, setMode] = useState<'project' | 'permanent' | null>(null);
  const [projectName, setProjectName] = useState('');
  const [properties, setProperties] = useState<PropertyRow[]>([]);
  const [objectives, setObjectives] = useState<ObjectiveRow[]>([]);
  const [visits, setVisits] = useState<VisitRow[]>([]);
  const [propertyId, setPropertyId] = useState('');
  const [objectiveId, setObjectiveId] = useState('');
  const [activityLabel, setActivityLabel] = useState('');
  const [whatDone, setWhatDone] = useState('');
  const [polygon, setPolygon] = useState<Array<{ lat: number; lng: number }>>([]);
  const [geo, setGeo] = useState<{ lat: number; lng: number; accuracyM: number | null } | null>(null);
  const [photoData, setPhotoData] = useState<string | null>(null);

  const copy =
    loc === 'es'
      ? {
          back: 'Acompañamiento',
          title: 'Campo',
          line: 'La visita guarda tu ubicación, la foto y lo que hiciste. Si el contrato está en un proyecto, cuenta en el indicador.',
          need: 'Elegí un negocio atendido.',
          permanent: 'Asistencia permanente — no hay proyecto SIEP en este contrato.',
          project: 'Asistencia del proyecto',
          property: 'Propiedad',
          none: 'Sin propiedad',
          activity: 'Qué viniste a hacer',
          done: 'Qué hiciste',
          here: 'Usar mi ubicación',
          vertex: 'Sumar este punto al área',
          photo: 'Foto',
          save: 'Registrar visita',
          on: 'En la finca',
          off: 'Fuera de la finca',
          geoWait: 'Ubicación aún no tomada.',
        }
      : loc === 'en'
        ? {
            back: 'Accompaniment',
            title: 'Field',
            line: 'The visit stores your location, the photo and what you did. If the contract sits on a project, it counts on the indicator.',
            need: 'Pick an attended business.',
            permanent: 'Standing assistance — this contract has no SIEP project.',
            project: 'Project assistance',
            property: 'Property',
            none: 'No property',
            activity: 'What you came to do',
            done: 'What you did',
            here: 'Use my location',
            vertex: 'Add this point to the area',
            photo: 'Photo',
            save: 'Record visit',
            on: 'On the farm',
            off: 'Off the farm',
            geoWait: 'Location not taken yet.',
          }
        : {
            back: 'Acompanhamento',
            title: 'Campo',
            line: 'A visita guarda a tua localização, a foto e o que fizeste. Se o contrato está num projeto, conta no indicador.',
            need: 'Escolhe um negócio atendido.',
            permanent: 'Assistência permanente — este contrato não tem projeto.',
            project: 'Assistência do projeto',
            property: 'Propriedade',
            none: 'Sem propriedade',
            activity: 'O que vieste fazer',
            done: 'O que fizeste',
            here: 'Usar a minha localização',
            vertex: 'Juntar este ponto à área',
            photo: 'Foto',
            save: 'Registar visita',
            on: 'Na finca',
            off: 'Fora da finca',
            geoWait: 'Localização ainda não tirada.',
          };

  const load = useCallback(async () => {
    if (!companyId || !engagementId) {
      setLoading(false);
      setErr(copy.need);
      return;
    }
    setLoading(true);
    try {
      const q = new URLSearchParams({ companyId, engagementId });
      const r = await fetch(`/api/aurora/campo?${q}`, { cache: 'no-store' });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Falha');
      setMode(d.engagement?.mode === 'project' ? 'project' : 'permanent');
      setProjectName(d.engagement?.project?.name || '');
      setProperties(Array.isArray(d.properties) ? d.properties : []);
      setObjectives(Array.isArray(d.objectives) ? d.objectives : []);
      setVisits(Array.isArray(d.visits) ? d.visits : []);
      setErr(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro');
    } finally {
      setLoading(false);
    }
  }, [companyId, engagementId, copy.need]);

  useEffect(() => {
    void load();
  }, [load]);

  const takeGeo = () =>
    new Promise<GeolocationPosition>((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('GPS'));
        return;
      }
      navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 });
    });

  const capture = async (addVertex: boolean) => {
    setBusy(true);
    try {
      const pos = await takeGeo();
      const point = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracyM: pos.coords.accuracy };
      setGeo(point);
      if (addVertex) setPolygon((rows) => [...rows, { lat: point.lat, lng: point.lng }].slice(-40));
      setErr(null);
    } catch {
      setErr(loc === 'en' ? 'Could not read location.' : loc === 'es' ? 'No se pudo leer la ubicación.' : 'Não foi possível ler a localização.');
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    if (!geo) {
      setErr(copy.geoWait);
      return;
    }
    setBusy(true);
    try {
      const r = await fetch('/api/aurora/campo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          engagementId,
          propertyId,
          objectiveId,
          activityLabel,
          whatDone,
          lat: geo.lat,
          lng: geo.lng,
          accuracyM: geo.accuracyM,
          photoData,
          polygon,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Falha');
      setActivityLabel('');
      setWhatDone('');
      setPolygon([]);
      setPhotoData(null);
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
        <Loader2 className="h-5 w-5 animate-spin text-amber-700" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <header className="space-y-2">
        <Link href={`/hub/aurora/diagnostico?company=${companyId}&engagement=${engagementId}`} className="text-xs text-slate-500 hover:text-slate-800">
          ← {copy.back}
        </Link>
        <h1 className="font-serif text-3xl text-slate-900">{copy.title}</h1>
        <p className="text-sm text-slate-600">{copy.line}</p>
        <p className="text-sm font-medium text-amber-950">
          {mode === 'project' ? `${copy.project}${projectName ? ` · ${projectName}` : ''}` : copy.permanent}
        </p>
      </header>
      {err ? <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{err}</p> : null}
      <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
        <label className="block text-xs font-semibold uppercase text-slate-400">{copy.property}</label>
        <select value={propertyId} onChange={(e) => setPropertyId(e.target.value)} className="w-full rounded-lg border px-2 py-1.5 text-sm">
          <option value="">{copy.none}</option>
          {properties.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
              {p.lat == null ? '' : ' · GPS'}
            </option>
          ))}
        </select>
        {mode === 'project' && objectives.length ? (
          <>
            <label className="block text-xs font-semibold uppercase text-slate-400">Indicador</label>
            <select value={objectiveId} onChange={(e) => setObjectiveId(e.target.value)} className="w-full rounded-lg border px-2 py-1.5 text-sm">
              <option value="">—</option>
              {objectives.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.code ? `${o.code} · ` : ''}
                  {o.title}
                </option>
              ))}
            </select>
          </>
        ) : null}
        <label className="block text-xs font-semibold uppercase text-slate-400">{copy.activity}</label>
        <input value={activityLabel} onChange={(e) => setActivityLabel(e.target.value)} className="w-full rounded-lg border px-2 py-1.5 text-sm" />
        <label className="block text-xs font-semibold uppercase text-slate-400">{copy.done}</label>
        <textarea value={whatDone} onChange={(e) => setWhatDone(e.target.value)} rows={3} className="w-full rounded-lg border px-2 py-1.5 text-sm" />
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={busy} onClick={() => void capture(false)} className="rounded-lg border px-3 py-1.5 text-sm">
            {copy.here}
          </button>
          <button type="button" disabled={busy || !geo} onClick={() => geo && setPolygon((rows) => [...rows, { lat: geo.lat, lng: geo.lng }].slice(-40))} className="rounded-lg border px-3 py-1.5 text-sm">
            {copy.vertex}
          </button>
          <label className="rounded-lg border px-3 py-1.5 text-sm">
            {copy.photo}
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const url = URL.createObjectURL(file);
                const img = new Image();
                img.onload = () => {
                  const max = 1280;
                  const scale = Math.min(1, max / Math.max(img.width, img.height));
                  const canvas = document.createElement('canvas');
                  canvas.width = Math.max(1, Math.round(img.width * scale));
                  canvas.height = Math.max(1, Math.round(img.height * scale));
                  canvas.getContext('2d')?.drawImage(img, 0, 0, canvas.width, canvas.height);
                  URL.revokeObjectURL(url);
                  setPhotoData(canvas.toDataURL('image/jpeg', 0.7));
                };
                img.src = url;
              }}
            />
          </label>
        </div>
        <p className="text-xs text-slate-500">
          {geo ? `${geo.lat.toFixed(5)}, ${geo.lng.toFixed(5)}` : copy.geoWait}
          {polygon.length ? ` · ${polygon.length} pts` : ''}
          {photoData ? ' · foto' : ''}
        </p>
        <button type="button" disabled={busy || !activityLabel.trim() || !geo} onClick={() => void save()} className="rounded-lg bg-amber-800 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
          {copy.save}
        </button>
      </section>
      <ul className="space-y-2">
        {visits.map((v) => (
          <li key={v.id} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">
            <p className="font-medium text-slate-900">{v.activityLabel}</p>
            {v.whatDone ? <p className="text-slate-600">{v.whatDone}</p> : null}
            <p className="mt-1 text-xs text-slate-500">
              {new Date(v.occurredAt).toLocaleString()} · {v.onSite ? copy.on : copy.off}
              {v.distanceM != null ? ` · ${v.distanceM} m` : ''}
              {v.hasPhoto ? ' · foto' : ''}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function AuroraCampo() {
  return (
    <Suspense fallback={<div className="flex min-h-[40vh] items-center justify-center" />}>
      <CampoInner />
    </Suspense>
  );
}
