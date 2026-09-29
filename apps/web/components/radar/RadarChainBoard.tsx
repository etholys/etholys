'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, Crosshair, Loader2, MapPin, QrCode } from 'lucide-react';
import { TRACE_STAGES, TRACE_STAGE_LABEL, type TraceStage } from '@/lib/radar/trace';

type Loc = 'pt' | 'es' | 'en';

type LotSummary = {
  id: string;
  code: string;
  crop: string | null;
  qty: number | null;
  unitLabel: string;
  status: string;
  currentStage: TraceStage;
  nextStage: TraceStage | null;
  unitId: string | null;
  unitName: string | null;
  createdAt: string;
  sharePath: string;
  lastCheckIn?: { lat: number | null; lng: number | null; hasPhoto: boolean; checkedInAt: string | null } | null;
};

const COPY = {
  pt: {
    title: 'Cadeia de custódia',
    empty: 'Ainda sem colheita — o lote nasce no primeiro check-in de colheita.',
    open: 'Check-in de colheita',
    qty: 'Quantidade',
    crop: 'Cultura',
    checkin: 'Confirmar check-in',
    note: 'Nota (opcional)',
    dest: 'Destino',
    buyer: 'Comprador',
    carrier: 'Transportista',
    copy: 'Copiar link público',
    copied: 'Link copiado',
    closed: 'Fechado',
    openStatus: 'Aberto',
    trust: 'Cada etapa exige check-in com hora, localização e foto (evidência).',
    blocked: 'Carência ativa — não é possível colher.',
    geo: 'Capturar localização',
    geoOk: 'Localização capturada',
    photo: 'Foto de evidência',
    photoOk: 'Foto pronta',
    needGeo: 'Precisas da geolocalização para o check-in.',
    qr: 'QR do lote',
  },
  es: {
    title: 'Cadena de custodia',
    empty: 'Todavía sin cosecha — el lote nace en el primer check-in de cosecha.',
    open: 'Check-in de cosecha',
    qty: 'Cantidad',
    crop: 'Cultivo',
    checkin: 'Confirmar check-in',
    note: 'Nota (opcional)',
    dest: 'Destino',
    buyer: 'Comprador',
    carrier: 'Transportista',
    copy: 'Copiar enlace público',
    copied: 'Enlace copiado',
    closed: 'Cerrado',
    openStatus: 'Abierto',
    trust: 'Cada etapa exige check-in con hora, ubicación y foto (evidencia).',
    blocked: 'Carencia activa — no se puede cosechar.',
    geo: 'Capturar ubicación',
    geoOk: 'Ubicación capturada',
    photo: 'Foto de evidencia',
    photoOk: 'Foto lista',
    needGeo: 'Necesitás geolocalización para el check-in.',
    qr: 'QR del lote',
  },
  en: {
    title: 'Chain of custody',
    empty: 'No harvest yet — the lot starts at the first harvest check-in.',
    open: 'Harvest check-in',
    qty: 'Quantity',
    crop: 'Crop',
    checkin: 'Confirm check-in',
    note: 'Note (optional)',
    dest: 'Destination',
    buyer: 'Buyer',
    carrier: 'Carrier',
    copy: 'Copy public link',
    copied: 'Link copied',
    closed: 'Closed',
    openStatus: 'Open',
    trust: 'Each stage requires check-in with time, location and photo (evidence).',
    blocked: 'PHI active — harvest blocked.',
    geo: 'Capture location',
    geoOk: 'Location captured',
    photo: 'Evidence photo',
    photoOk: 'Photo ready',
    needGeo: 'Geolocation is required for check-in.',
    qr: 'Lot QR',
  },
} as const;

function stageLabel(stage: TraceStage, loc: Loc) {
  return TRACE_STAGE_LABEL[stage][loc];
}

export function RadarChainBoard({
  companyId,
  engagementId,
  locale,
  unitId,
  unitCrop,
  harvestBlocked,
}: {
  companyId: string;
  engagementId?: string | null;
  locale: string;
  unitId?: string | null;
  unitCrop?: string | null;
  harvestBlocked?: boolean;
}) {
  const loc: Loc = locale === 'es' || locale === 'en' ? locale : 'pt';
  const copy = COPY[loc];
  const [lots, setLots] = useState<LotSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [qty, setQty] = useState('');
  const [crop, setCrop] = useState('');
  const [advanceNote, setAdvanceNote] = useState('');
  const [extra, setExtra] = useState('');
  const [copied, setCopied] = useState(false);
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [geoBusy, setGeoBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    if (!companyId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setErr(null);
    try {
      const q = new URLSearchParams({ companyId });
      if (engagementId) q.set('engagementId', engagementId);
      const r = await fetch(`/api/radar/lots?${q}`);
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Falha');
      const list = (d.lots || []) as LotSummary[];
      setLots(list);
      setFocusId((prev) => {
        if (prev && list.some((l) => l.id === prev)) return prev;
        const open = list.find((l) => l.status === 'open');
        return open?.id || list[0]?.id || null;
      });
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro');
    } finally {
      setLoading(false);
    }
  }, [companyId, engagementId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (unitCrop && !crop) setCrop(unitCrop);
  }, [unitCrop, crop]);

  const focus = lots.find((l) => l.id === focusId) || lots[0] || null;

  const captureGeo = () => {
    if (!navigator.geolocation) {
      setErr(copy.needGeo);
      return;
    }
    setGeoBusy(true);
    setErr(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(Math.round(pos.coords.latitude * 1e6) / 1e6);
        setLng(Math.round(pos.coords.longitude * 1e6) / 1e6);
        setGeoBusy(false);
      },
      () => {
        setErr(copy.needGeo);
        setGeoBusy(false);
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  };

  const onPhoto = (file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setErr(loc === 'en' ? 'Image required' : 'Precisa de uma imagem');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : null;
      setPhotoDataUrl(result);
    };
    reader.readAsDataURL(file);
  };

  const openLot = async () => {
    if (!unitId) return;
    if (harvestBlocked) {
      setErr(copy.blocked);
      return;
    }
    if (lat == null || lng == null) {
      setErr(copy.needGeo);
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch('/api/radar/lots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          engagementId,
          action: 'open_from_harvest',
          unitId,
          qty: qty ? Number(qty) : null,
          crop: crop.trim() || unitCrop || null,
          note: advanceNote.trim(),
          lat,
          lng,
          photoDataUrl: photoDataUrl || undefined,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Falha');
      setQty('');
      setAdvanceNote('');
      setPhotoDataUrl(null);
      await load();
      if (d.lot?.id) setFocusId(d.lot.id);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro');
    } finally {
      setBusy(false);
    }
  };

  const checkIn = async () => {
    if (!focus?.nextStage) return;
    if (lat == null || lng == null) {
      setErr(copy.needGeo);
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const payload: Record<string, unknown> = {
        companyId,
        engagementId,
        action: 'checkin',
        lotId: focus.id,
        stage: focus.nextStage,
        note: advanceNote.trim(),
        lat,
        lng,
        photoDataUrl: photoDataUrl || undefined,
      };
      if (focus.nextStage === 'transport') {
        payload.carrier = extra.trim() || undefined;
        payload.destination = extra.trim() || undefined;
      }
      if (focus.nextStage === 'sale') payload.buyer = extra.trim() || undefined;
      if (focus.nextStage === 'transform') payload.destination = extra.trim() || undefined;

      const r = await fetch('/api/radar/lots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Falha');
      setAdvanceNote('');
      setExtra('');
      setPhotoDataUrl(null);
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro');
    } finally {
      setBusy(false);
    }
  };

  const copyLink = async () => {
    if (!focus?.sharePath) return;
    const url = `${window.location.origin}${focus.sharePath}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setErr(url);
    }
  };

  if (loading && lots.length === 0) {
    return (
      <section className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-white/45">{copy.title}</p>
        <div className="mt-3 flex justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-violet-300" />
        </div>
      </section>
    );
  }

  const extraPh =
    focus?.nextStage === 'sale'
      ? copy.buyer
      : focus?.nextStage === 'transport'
        ? copy.carrier
        : focus?.nextStage === 'transform'
          ? copy.dest
          : '';

  const publicUrl = focus ? `${typeof window !== 'undefined' ? window.location.origin : ''}${focus.sharePath}` : '';
  const qrSrc = publicUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(publicUrl)}`
    : null;

  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-white/45">{copy.title}</p>
      <p className="mt-1 text-sm text-white/55">{copy.trust}</p>
      {err && <p className="mt-2 text-sm text-rose-200">{err}</p>}

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={geoBusy}
          onClick={captureGeo}
          className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs ${
            lat != null ? 'border-emerald-400/40 bg-emerald-500/10 text-emerald-100' : 'border-white/15 text-white/70'
          }`}
        >
          {geoBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Crosshair className="h-3.5 w-3.5" />}
          {lat != null ? `${copy.geoOk} · ${lat.toFixed(4)}, ${lng?.toFixed(4)}` : copy.geo}
        </button>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs ${
            photoDataUrl ? 'border-emerald-400/40 bg-emerald-500/10 text-emerald-100' : 'border-white/15 text-white/70'
          }`}
        >
          <Camera className="h-3.5 w-3.5" />
          {photoDataUrl ? copy.photoOk : copy.photo}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => onPhoto(e.target.files?.[0] || null)}
        />
      </div>

      {lots.length === 0 ? (
        <p className="mt-3 text-sm text-white/50">{copy.empty}</p>
      ) : (
        <div className="mt-3 space-y-3">
          <div className="flex flex-wrap gap-2">
            {lots.slice(0, 8).map((lot) => (
              <button
                key={lot.id}
                type="button"
                onClick={() => setFocusId(lot.id)}
                className={`rounded-lg border px-3 py-1.5 text-xs ${
                  focus?.id === lot.id ? 'border-violet-400/50 bg-violet-500/15 text-white' : 'border-white/15 text-white/60'
                }`}
              >
                {lot.code}
                {lot.status === 'closed' ? ` · ${copy.closed}` : ''}
              </button>
            ))}
          </div>

          {focus && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-serif text-2xl text-white">{focus.code}</p>
                  <p className="text-xs text-white/50">
                    {[focus.crop, focus.qty != null ? `${focus.qty} ${focus.unitLabel}` : null, focus.unitName]
                      .filter(Boolean)
                      .join(' · ') || copy.openStatus}
                  </p>
                  {focus.lastCheckIn?.lat != null && (
                    <p className="mt-1 inline-flex items-center gap-1 text-[11px] text-emerald-200/80">
                      <MapPin className="h-3 w-3" />
                      {focus.lastCheckIn.lat.toFixed(4)}, {focus.lastCheckIn.lng?.toFixed(4)}
                      {focus.lastCheckIn.hasPhoto ? ' · foto' : ''}
                    </p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-2">
                  <button
                    type="button"
                    onClick={() => void copyLink()}
                    className="rounded-lg border border-white/20 px-3 py-1.5 text-xs text-white/80"
                  >
                    {copied ? copy.copied : copy.copy}
                  </button>
                  {qrSrc && (
                    <div className="rounded-lg border border-white/10 bg-white p-1.5">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={qrSrc} alt={copy.qr} width={90} height={90} className="block" />
                      <p className="mt-1 flex items-center justify-center gap-1 text-[9px] text-black/50">
                        <QrCode className="h-3 w-3" />
                        {copy.qr}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <ol className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {TRACE_STAGES.map((stage) => {
                  const idx = TRACE_STAGES.indexOf(stage);
                  const cur = TRACE_STAGES.indexOf(focus.currentStage);
                  const done = idx <= cur;
                  const current = stage === focus.currentStage;
                  return (
                    <li
                      key={stage}
                      className={`rounded-lg border px-2 py-2 text-center text-[11px] ${
                        current
                          ? 'border-emerald-400/40 bg-emerald-500/10 text-emerald-100'
                          : done
                            ? 'border-white/20 text-white/70'
                            : 'border-white/10 text-white/35'
                      }`}
                    >
                      {stageLabel(stage, loc)}
                    </li>
                  );
                })}
              </ol>

              {focus.nextStage && focus.status === 'open' && (
                <div className="flex flex-wrap gap-2">
                  <input
                    value={advanceNote}
                    onChange={(e) => setAdvanceNote(e.target.value)}
                    placeholder={copy.note}
                    className="min-w-[140px] flex-1 rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm text-white"
                  />
                  {extraPh && (
                    <input
                      value={extra}
                      onChange={(e) => setExtra(e.target.value)}
                      placeholder={extraPh}
                      className="min-w-[140px] flex-1 rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm text-white"
                    />
                  )}
                  <button
                    type="button"
                    disabled={busy || lat == null}
                    onClick={() => void checkIn()}
                    className="rounded-lg bg-violet-500 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                  >
                    {copy.checkin}: {stageLabel(focus.nextStage, loc)}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {unitId && (
        <div className="mt-4 border-t border-white/10 pt-3">
          <div className="flex flex-wrap gap-2">
            <input
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              placeholder={copy.qty}
              inputMode="decimal"
              className="w-28 rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm text-white"
            />
            <input
              value={crop}
              onChange={(e) => setCrop(e.target.value)}
              placeholder={copy.crop}
              className="min-w-[120px] flex-1 rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm text-white"
            />
            <button
              type="button"
              disabled={busy || harvestBlocked || lat == null}
              onClick={() => void openLot()}
              className="rounded-lg border border-emerald-400/40 bg-emerald-500/15 px-4 py-2 text-sm text-emerald-50 disabled:opacity-40"
              title={harvestBlocked ? copy.blocked : undefined}
            >
              {copy.open}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
