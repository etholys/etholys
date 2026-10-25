'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Check,
  ChevronRight,
  ImagePlus,
  Loader2,
  MapPinned,
  Plane,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { radarLoc, radarT, type RadarLoc } from '@/lib/radar/i18n';
import { gpsFromImageFile } from '@/lib/radar/drone/exif-gps';
import type { DroneOrganizeProposal } from '@/lib/radar/drone/types';
import {
  DRONE_MAPPING_HONEST_LIMIT_EN,
  DRONE_MAPPING_HONEST_LIMIT_ES,
  DRONE_MAPPING_HONEST_LIMIT_PT,
} from '@/lib/radar/drone/prompt';

type PropertyRow = {
  id: string;
  name: string;
  moduleId: string | null;
  areaHa: number | null;
  lat: number | null;
  lng: number | null;
};

type LocalImage = {
  id: string;
  name: string;
  mimeType: string;
  base64: string;
  previewUrl: string;
  gps: { lat: number; lng: number } | null;
};

type Step = 1 | 2 | 3 | 4 | 5;

function honest(loc: RadarLoc) {
  if (loc === 'es') return DRONE_MAPPING_HONEST_LIMIT_ES;
  if (loc === 'en') return DRONE_MAPPING_HONEST_LIMIT_EN;
  return DRONE_MAPPING_HONEST_LIMIT_PT;
}

async function fileToLocalImage(file: File): Promise<LocalImage | null> {
  if (!file.type.startsWith('image/')) return null;
  if (file.size > 2_500_000) return null;
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  const base64 = btoa(binary);
  const gps = await gpsFromImageFile(file);
  return {
    id: `img_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    name: file.name.slice(0, 120),
    mimeType: file.type || 'image/jpeg',
    base64,
    previewUrl: URL.createObjectURL(file),
    gps,
  };
}

export function RadarDroneMapping({
  companyId,
  engagementId,
  locale,
  initialPropertyId,
  qs,
}: {
  companyId: string;
  engagementId?: string | null;
  locale: string;
  initialPropertyId?: string | null;
  qs: string;
}) {
  const loc = radarLoc(locale);
  const [step, setStep] = useState<Step>(1);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [properties, setProperties] = useState<PropertyRow[]>([]);
  const [propertyId, setPropertyId] = useState(initialPropertyId || '');
  const [images, setImages] = useState<LocalImage[]>([]);
  const [plantTypes, setPlantTypes] = useState('');
  const [notes, setNotes] = useState('');
  const [boundsMode, setBoundsMode] = useState<'none' | 'center_size'>('none');
  const [centerLat, setCenterLat] = useState('');
  const [centerLng, setCenterLng] = useState('');
  const [widthM, setWidthM] = useState('50');
  const [heightM, setHeightM] = useState('50');
  const [siteSideM, setSiteSideM] = useState('');
  const [proposal, setProposal] = useState<DroneOrganizeProposal | null>(null);
  const [acceptedMsg, setAcceptedMsg] = useState<string | null>(null);

  const selected = useMemo(
    () => properties.find((p) => p.id === propertyId) || null,
    [properties, propertyId],
  );

  const load = useCallback(() => {
    if (!companyId) return;
    const q = new URLSearchParams({ companyId, all: '1' });
    if (engagementId) q.set('engagementId', engagementId);
    void fetch(`/api/radar/properties?${q}`, { cache: 'no-store' })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || 'Erro');
        const rows = (Array.isArray(d.properties) ? d.properties : []) as Array<
          Record<string, unknown>
        >;
        const mapped: PropertyRow[] = rows.map((p) => ({
          id: String(p.id),
          name: String(p.name || ''),
          moduleId: (p.moduleId as string) || null,
          areaHa: p.areaHa == null ? null : Number(p.areaHa),
          lat: p.lat == null ? null : Number(p.lat),
          lng: p.lng == null ? null : Number(p.lng),
        }));
        setProperties(mapped);
        const pick =
          (initialPropertyId && mapped.some((m) => m.id === initialPropertyId) && initialPropertyId) ||
          mapped[0]?.id ||
          '';
        if (pick) setPropertyId((prev) => prev || pick);
      })
      .catch((e: unknown) => setErr(e instanceof Error ? e.message : 'Erro'));
  }, [companyId, engagementId, initialPropertyId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!selected) return;
    if (selected.lat != null && selected.lng != null) {
      setCenterLat(String(selected.lat));
      setCenterLng(String(selected.lng));
    }
  }, [selected]);

  useEffect(() => {
    return () => {
      for (const img of images) URL.revokeObjectURL(img.previewUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- revoke on unmount only
  }, []);

  const onFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setErr(null);
    const next: LocalImage[] = [];
    for (const file of Array.from(files).slice(0, 3)) {
      const local = await fileToLocalImage(file);
      if (!local) {
        setErr(
          radarT(
            loc,
            'Imagem inválida ou > 2,5 MB. Usa JPEG/PNG/WebP.',
            'Imagen inválida o > 2,5 MB. Usá JPEG/PNG/WebP.',
            'Invalid image or > 2.5 MB. Use JPEG/PNG/WebP.',
          ),
        );
        continue;
      }
      next.push(local);
    }
    setImages((prev) => {
      for (const p of prev) URL.revokeObjectURL(p.previewUrl);
      return next.slice(0, 3);
    });
  };

  const removeImage = (id: string) => {
    setImages((prev) => {
      const hit = prev.find((i) => i.id === id);
      if (hit) URL.revokeObjectURL(hit.previewUrl);
      return prev.filter((i) => i.id !== id);
    });
  };

  const runOrganize = async () => {
    if (!propertyId) return;
    setBusy(true);
    setErr(null);
    setProposal(null);
    setAcceptedMsg(null);
    try {
      const hints: Record<string, unknown> = {
        plantTypes: plantTypes || undefined,
        notes: notes || undefined,
        siteSideM: siteSideM ? Number(siteSideM) : undefined,
      };
      if (boundsMode === 'center_size' && centerLat && centerLng && widthM && heightM) {
        hints.bounds = {
          mode: 'center_size',
          lat: Number(centerLat),
          lng: Number(centerLng),
          widthM: Number(widthM),
          heightM: Number(heightM),
        };
      }
      const res = await fetch('/api/radar/drone/organize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          engagementId: engagementId || undefined,
          propertyId,
          locale: loc,
          images: images.map((i) => ({
            base64: i.base64,
            mimeType: i.mimeType,
            filename: i.name,
            gps: i.gps,
          })),
          hints,
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Erro');
      setProposal(d.proposal as DroneOrganizeProposal);
      setStep(4);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Erro');
    } finally {
      setBusy(false);
    }
  };

  const runAccept = async () => {
    if (!propertyId || !proposal) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch('/api/radar/drone/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          engagementId: engagementId || undefined,
          propertyId,
          locale: loc,
          proposal,
          createUnits: true,
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Erro');
      setAcceptedMsg(String(d.message || 'OK'));
      setStep(5);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Erro');
    } finally {
      setBusy(false);
    }
  };

  const steps: Array<{ n: Step; label: string }> = [
    {
      n: 1,
      label: radarT(loc, 'Propriedade', 'Propiedad', 'Property'),
    },
    {
      n: 2,
      label: radarT(loc, 'Imagens', 'Imágenes', 'Images'),
    },
    {
      n: 3,
      label: radarT(loc, 'Limites e pistas', 'Límites y pistas', 'Bounds & hints'),
    },
    {
      n: 4,
      label: radarT(loc, 'Pré-visualizar', 'Vista previa', 'Preview'),
    },
    {
      n: 5,
      label: radarT(loc, 'Confirmar', 'Confirmar', 'Confirm'),
    },
  ];

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-1 py-2">
      <header className="space-y-2">
        <div className="flex items-center gap-2 text-teal-300/90">
          <Plane className="h-5 w-5" aria-hidden />
          <span className="text-xs font-semibold uppercase tracking-[0.14em]">
            {radarT(loc, 'Mapeamento aéreo', 'Mapeo aéreo', 'Aerial mapping')}
          </span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-white">
          {radarT(loc, 'Drone', 'Drone', 'Drone')}
        </h1>
        <p className="max-w-2xl text-sm text-white/55">{honest(loc)}</p>
      </header>

      <ol className="flex flex-wrap gap-2">
        {steps.map((s) => (
          <li
            key={s.n}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
              step === s.n
                ? 'bg-teal-300 text-slate-950'
                : step > s.n
                  ? 'bg-teal-500/20 text-teal-100'
                  : 'bg-white/5 text-white/45'
            }`}
          >
            {step > s.n ? <Check className="h-3 w-3" /> : <span>{s.n}</span>}
            {s.label}
          </li>
        ))}
      </ol>

      {err ? (
        <p className="rounded-xl border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">
          {err}
        </p>
      ) : null}

      {step === 1 ? (
        <section className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <h2 className="text-sm font-semibold text-white">
            {radarT(loc, 'Escolhe a propriedade', 'Elegí la propiedad', 'Choose the property')}
          </h2>
          {properties.length === 0 ? (
            <p className="text-sm text-white/50">
              {radarT(
                loc,
                'Ainda não há propriedades neste âmbito.',
                'Todavía no hay propiedades en este ámbito.',
                'No properties in this scope yet.',
              )}
            </p>
          ) : (
            <select
              className="w-full rounded-xl border border-white/15 bg-[#0a1620] px-3 py-2.5 text-sm text-white"
              value={propertyId}
              onChange={(e) => setPropertyId(e.target.value)}
            >
              {properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {p.areaHa != null ? ` · ${p.areaHa} ha` : ''}
                </option>
              ))}
            </select>
          )}
          <button
            type="button"
            disabled={!propertyId}
            onClick={() => setStep(2)}
            className="inline-flex items-center gap-1.5 rounded-full bg-teal-300 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-40"
          >
            {radarT(loc, 'Continuar', 'Continuar', 'Continue')}
            <ChevronRight className="h-4 w-4" />
          </button>
        </section>
      ) : null}

      {step === 2 ? (
        <section className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <h2 className="text-sm font-semibold text-white">
            {radarT(
              loc,
              'Carrega ortofoto / foto aérea',
              'Subí ortofoto / foto aérea',
              'Upload orthophoto / aerial photo',
            )}
          </h2>
          <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-white/20 bg-black/20 px-4 py-10 text-center hover:border-teal-400/40">
            <ImagePlus className="h-8 w-8 text-teal-300/80" />
            <span className="text-sm text-white/70">
              {radarT(
                loc,
                'JPEG, PNG ou WebP · até 3 imagens · máx. 2,5 MB cada',
                'JPEG, PNG o WebP · hasta 3 imágenes · máx. 2,5 MB cada',
                'JPEG, PNG or WebP · up to 3 images · max 2.5 MB each',
              )}
            </span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              className="hidden"
              onChange={(e) => void onFiles(e.target.files)}
            />
          </label>
          {images.length > 0 ? (
            <ul className="grid gap-3 sm:grid-cols-3">
              {images.map((img) => (
                <li key={img.id} className="relative overflow-hidden rounded-xl border border-white/10">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img.previewUrl} alt={img.name} className="h-28 w-full object-cover" />
                  <div className="flex items-center justify-between gap-1 px-2 py-1.5 text-[11px] text-white/60">
                    <span className="truncate">{img.name}</span>
                    <button
                      type="button"
                      className="rounded p-1 text-rose-300 hover:bg-rose-500/15"
                      onClick={() => removeImage(img.id)}
                      aria-label="remove"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  {img.gps ? (
                    <p className="px-2 pb-1.5 text-[10px] text-teal-200/80">
                      GPS {img.gps.lat.toFixed(5)}, {img.gps.lng.toFixed(5)}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-white/45">
              {radarT(
                loc,
                'Sem imagem, a IA usa só pistas estruturadas (passo seguinte).',
                'Sin imagen, la IA usa solo pistas estructuradas (paso siguiente).',
                'Without an image, AI uses structured hints only (next step).',
              )}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="rounded-full px-4 py-2 text-sm text-white/60 hover:text-white"
            >
              {radarT(loc, 'Voltar', 'Volver', 'Back')}
            </button>
            <button
              type="button"
              onClick={() => setStep(3)}
              className="inline-flex items-center gap-1.5 rounded-full bg-teal-300 px-4 py-2 text-sm font-semibold text-slate-950"
            >
              {radarT(loc, 'Continuar', 'Continuar', 'Continue')}
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </section>
      ) : null}

      {step === 3 ? (
        <section className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <h2 className="text-sm font-semibold text-white">
            {radarT(
              loc,
              'Limites do mapa e tipos de planta (opcional)',
              'Límites del mapa y tipos de planta (opcional)',
              'Map bounds and plant types (optional)',
            )}
          </h2>

          <label className="block space-y-1.5 text-sm text-white/70">
            {radarT(loc, 'Culturas / zonas', 'Cultivos / zonas', 'Crops / zones')}
            <input
              className="w-full rounded-xl border border-white/15 bg-[#0a1620] px-3 py-2 text-sm text-white"
              value={plantTypes}
              onChange={(e) => setPlantTypes(e.target.value)}
              placeholder={radarT(
                loc,
                'ex.: milho, hortícolas, caminho',
                'ej.: maíz, hortalizas, camino',
                'e.g. maize, vegetables, path',
              )}
            />
          </label>

          <label className="block space-y-1.5 text-sm text-white/70">
            {radarT(loc, 'Notas', 'Notas', 'Notes')}
            <textarea
              className="min-h-[72px] w-full rounded-xl border border-white/15 bg-[#0a1620] px-3 py-2 text-sm text-white"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={radarT(
                loc,
                'ex.: lado norte é irrigado; sul é pousio',
                'ej.: lado norte irrigado; sur en barbecho',
                'e.g. north side irrigated; south fallow',
              )}
            />
          </label>

          <label className="block space-y-1.5 text-sm text-white/70">
            {radarT(loc, 'Lado do sítio (m)', 'Lado del sitio (m)', 'Site side (m)')}
            <input
              type="number"
              min={5}
              className="w-full rounded-xl border border-white/15 bg-[#0a1620] px-3 py-2 text-sm text-white"
              value={siteSideM}
              onChange={(e) => setSiteSideM(e.target.value)}
              placeholder="63"
            />
          </label>

          <div className="space-y-3 rounded-xl border border-white/10 bg-black/20 p-3">
            <div className="flex items-center gap-2 text-sm text-white/80">
              <MapPinned className="h-4 w-4 text-teal-300" />
              {radarT(loc, 'Centro + largura/altura (m)', 'Centro + ancho/alto (m)', 'Center + width/height (m)')}
            </div>
            <label className="flex items-center gap-2 text-xs text-white/55">
              <input
                type="checkbox"
                checked={boundsMode === 'center_size'}
                onChange={(e) => setBoundsMode(e.target.checked ? 'center_size' : 'none')}
              />
              {radarT(loc, 'Definir limites', 'Definir límites', 'Set bounds')}
            </label>
            {boundsMode === 'center_size' ? (
              <div className="grid grid-cols-2 gap-2">
                <input
                  className="rounded-lg border border-white/15 bg-[#0a1620] px-2 py-1.5 text-sm text-white"
                  value={centerLat}
                  onChange={(e) => setCenterLat(e.target.value)}
                  placeholder="lat"
                />
                <input
                  className="rounded-lg border border-white/15 bg-[#0a1620] px-2 py-1.5 text-sm text-white"
                  value={centerLng}
                  onChange={(e) => setCenterLng(e.target.value)}
                  placeholder="lng"
                />
                <input
                  className="rounded-lg border border-white/15 bg-[#0a1620] px-2 py-1.5 text-sm text-white"
                  value={widthM}
                  onChange={(e) => setWidthM(e.target.value)}
                  placeholder="width m"
                />
                <input
                  className="rounded-lg border border-white/15 bg-[#0a1620] px-2 py-1.5 text-sm text-white"
                  value={heightM}
                  onChange={(e) => setHeightM(e.target.value)}
                  placeholder="height m"
                />
              </div>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setStep(2)}
              className="rounded-full px-4 py-2 text-sm text-white/60 hover:text-white"
            >
              {radarT(loc, 'Voltar', 'Volver', 'Back')}
            </button>
            <button
              type="button"
              disabled={busy || (!images.length && !plantTypes && !notes && boundsMode === 'none')}
              onClick={() => void runOrganize()}
              className="inline-flex items-center gap-1.5 rounded-full bg-teal-300 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-40"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {radarT(loc, 'Organizar com IA', 'Organizar con IA', 'Organize with AI')}
            </button>
          </div>
        </section>
      ) : null}

      {step === 4 && proposal ? (
        <section className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-white">
                {radarT(loc, 'Pré-visualização', 'Vista previa', 'Preview')}
              </h2>
              <p className="mt-1 text-sm text-white/60">{proposal.summary}</p>
            </div>
            <span
              className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase ${
                proposal.confidence === 'high'
                  ? 'bg-teal-500/20 text-teal-100'
                  : proposal.confidence === 'medium'
                    ? 'bg-amber-500/20 text-amber-100'
                    : 'bg-white/10 text-white/60'
              }`}
            >
              {proposal.confidence}
            </span>
          </div>

          <p className="text-xs text-white/45">
            {proposal.visionUsed
              ? radarT(
                  loc,
                  'Visão: imagens enviadas ao modelo.',
                  'Visión: imágenes enviadas al modelo.',
                  'Vision: images sent to the model.',
                )
              : radarT(
                  loc,
                  'Sem visão: layout só a partir de pistas.',
                  'Sin visión: layout solo desde pistas.',
                  'No vision: layout from hints only.',
                )}
          </p>

          <div className="relative aspect-[4/3] overflow-hidden rounded-xl border border-white/10 bg-[#061018]">
            {images[0] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={images[0].previewUrl}
                alt=""
                className="absolute inset-0 h-full w-full object-cover opacity-40"
              />
            ) : null}
            {proposal.spaces.map((s) => (
              <div
                key={s.tempId}
                className="absolute rounded-md border border-teal-300/70 bg-teal-400/20 px-1 py-0.5 text-[10px] font-medium text-teal-50"
                style={{
                  left: `${s.x}%`,
                  top: `${s.y}%`,
                  width: `${s.w}%`,
                  height: `${s.h}%`,
                }}
                title={s.notes || s.name}
              >
                <span className="line-clamp-2">{s.name}</span>
                {s.widthM != null && s.lengthM != null ? (
                  <span className="block text-[9px] text-teal-100/80">
                    ~{s.widthM}×{s.lengthM} m
                  </span>
                ) : null}
              </div>
            ))}
          </div>

          <ul className="divide-y divide-white/10 rounded-xl border border-white/10">
            {proposal.spaces.map((s) => (
              <li key={s.tempId} className="flex flex-wrap items-baseline justify-between gap-2 px-3 py-2.5 text-sm">
                <div>
                  <p className="font-medium text-white">{s.name}</p>
                  <p className="text-xs text-white/45">
                    {s.crop || radarT(loc, 'sem cultura', 'sin cultivo', 'no crop')}
                    {s.reuseUnitId ? ` · reuse ${s.reuseUnitId.slice(0, 8)}…` : ''}
                  </p>
                </div>
                <p className="text-xs text-white/50">
                  {s.widthM != null && s.lengthM != null
                    ? `~${s.widthM} × ${s.lengthM} m`
                    : `${s.w.toFixed(0)}% × ${s.h.toFixed(0)}%`}
                </p>
              </li>
            ))}
          </ul>

          {proposal.crops.length > 0 ? (
            <p className="text-xs text-white/50">
              {radarT(loc, 'Culturas sugeridas:', 'Cultivos sugeridos:', 'Suggested crops:')}{' '}
              {proposal.crops.map((c) => c.name).join(', ')}
            </p>
          ) : null}

          <ul className="space-y-1 text-xs text-amber-100/80">
            {proposal.limitations.map((l) => (
              <li key={l}>• {l}</li>
            ))}
          </ul>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setStep(3)}
              className="rounded-full px-4 py-2 text-sm text-white/60 hover:text-white"
            >
              {radarT(loc, 'Ajustar pistas', 'Ajustar pistas', 'Adjust hints')}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void runAccept()}
              className="inline-flex items-center gap-1.5 rounded-full bg-teal-300 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-40"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              {radarT(loc, 'Aceitar e gravar', 'Aceptar y guardar', 'Accept and save')}
            </button>
          </div>
        </section>
      ) : null}

      {step === 5 ? (
        <section className="space-y-4 rounded-2xl border border-teal-400/25 bg-teal-500/10 p-5">
          <h2 className="text-sm font-semibold text-teal-50">
            {radarT(loc, 'Layout aplicado', 'Layout aplicado', 'Layout applied')}
          </h2>
          <p className="text-sm text-white/70">{acceptedMsg}</p>
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/hub/radar/properties/${propertyId}${qs}`}
              className="inline-flex items-center gap-1.5 rounded-full bg-teal-300 px-4 py-2 text-sm font-semibold text-slate-950"
            >
              {radarT(loc, 'Abrir mapa da propriedade', 'Abrir mapa de la propiedad', 'Open property map')}
            </Link>
            <button
              type="button"
              onClick={() => {
                setStep(1);
                setProposal(null);
                setAcceptedMsg(null);
                setImages((prev) => {
                  for (const p of prev) URL.revokeObjectURL(p.previewUrl);
                  return [];
                });
              }}
              className="rounded-full px-4 py-2 text-sm text-white/70 hover:text-white"
            >
              {radarT(loc, 'Novo mapeamento', 'Nuevo mapeo', 'New mapping')}
            </button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
