'use client';

import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { Leaf, MapPinned, Plus, Radio } from 'lucide-react';
import { MOISTURE_THRESHOLD, type ParcelAction } from '@/lib/radar/agriculture';
import {
  emptyRadarLayout,
  mergeLayoutWithSpaces,
  type RadarSiteLayoutDoc,
  type RadarSpaceRect,
} from '@/lib/radar/site-layout';

type Loc = 'pt' | 'es' | 'en';

export type MapParcel = {
  id: string;
  name: string;
  crop: string | null;
  areaHa: number | null;
  moisture: number | null;
  nextAction: ParcelAction;
  harvestBlocked: boolean;
  alerts: Array<{ severity: string }>;
};

export type MapSensor = {
  id: string;
  name: string;
  unitId?: string | null;
  lastValue: number | null;
};

const COPY = {
  pt: {
    plant: 'Planta',
    arrange: 'Arrastar para organizar · canto para redimensionar',
    save: 'Guardar planta',
    saving: 'A guardar…',
    saved: 'Planta guardada',
    emptyTitle: 'Ainda sem parcelas no mapa',
    emptyBody: 'Cria a primeira parcela — um pedaço de terra para cultivar — e ela aparece aqui.',
    emptyCta: 'Nova parcela',
    addParcel: 'Nova parcela',
    focus: 'Em foco',
    moisture: 'Humidade',
    sensor: 'Sensor',
  },
  es: {
    plant: 'Planta',
    arrange: 'Arrastrar para organizar · esquina para redimensionar',
    save: 'Guardar planta',
    saving: 'Guardando…',
    saved: 'Planta guardada',
    emptyTitle: 'Aún sin parcelas en el mapa',
    emptyBody: 'Creá la primera parcela — un pedazo de tierra para cultivar — y aparece aquí.',
    emptyCta: 'Nueva parcela',
    addParcel: 'Nueva parcela',
    focus: 'En foco',
    moisture: 'Humedad',
    sensor: 'Sensor',
  },
  en: {
    plant: 'Plant map',
    arrange: 'Drag to arrange · corner to resize',
    save: 'Save layout',
    saving: 'Saving…',
    saved: 'Layout saved',
    emptyTitle: 'No parcels on the map yet',
    emptyBody: 'Create the first parcel — a piece of land to cultivate — and it appears here.',
    emptyCta: 'New parcel',
    addParcel: 'New parcel',
    focus: 'Focused',
    moisture: 'Moisture',
    sensor: 'Sensor',
  },
} as const;

function actionTone(action: ParcelAction, harvestBlocked: boolean, moisture: number | null) {
  if (action === 'irrigate' || action === 'hold_harvest' || harvestBlocked) return 'critical' as const;
  if (action === 'scout' || action === 'await_signal') return 'warn' as const;
  if (moisture != null && moisture < MOISTURE_THRESHOLD) return 'warn' as const;
  return 'ok' as const;
}

function tileClasses(tone: 'ok' | 'warn' | 'critical', focused: boolean, dimmed: boolean) {
  const base =
    tone === 'critical'
      ? 'border-rose-400/45 bg-gradient-to-br from-rose-500/35 to-rose-950/40'
      : tone === 'warn'
        ? 'border-amber-400/40 bg-gradient-to-br from-amber-500/25 to-emerald-950/50'
        : 'border-emerald-400/30 bg-gradient-to-br from-emerald-500/25 to-emerald-950/55';
  const ring = focused ? 'ring-2 ring-emerald-300/80 shadow-[0_0_24px_rgba(52,211,153,0.25)]' : '';
  const dim = dimmed && !focused ? 'opacity-35 scale-[0.98]' : 'opacity-100';
  return `${base} ${ring} ${dim}`;
}

function labelAction(action: ParcelAction, loc: Loc) {
  if (action === 'irrigate') return loc === 'es' ? 'Irrigar' : loc === 'en' ? 'Irrigate' : 'Irrigar';
  if (action === 'hold_harvest') return loc === 'es' ? 'No cosechar' : loc === 'en' ? 'Hold' : 'Não colher';
  if (action === 'scout') return loc === 'es' ? 'Recorrer' : loc === 'en' ? 'Walk' : 'Percorrer';
  if (action === 'await_signal') return loc === 'es' ? 'Escuchar' : loc === 'en' ? 'Listen' : 'Ouvir';
  return 'OK';
}

type Props = {
  companyId: string;
  engagementId?: string | null;
  propertyId?: string | null;
  locale: string;
  parcels: MapParcel[];
  sensors: MapSensor[];
  focusedId: string | null;
  onFocus: (id: string) => void;
  /** Full plant + metrics surface (single ops UI for all roles). */
  mode?: 'ops' | 'empresa';
  onSaved?: () => void;
  /** Show CTA to create a new parcel (parent owns the form). */
  onRequestAddParcel?: () => void;
};

export function RadarSiteMap({
  companyId,
  engagementId,
  propertyId,
  locale,
  parcels,
  sensors,
  focusedId,
  onFocus,
  mode = 'ops',
  onSaved,
  onRequestAddParcel,
}: Props) {
  const loc: Loc = locale === 'es' || locale === 'en' ? locale : 'pt';
  const canEdit = mode === 'ops' || mode === 'empresa';
  const copy = COPY[loc];
  const [layout, setLayout] = useState<RadarSiteLayoutDoc>(emptyRadarLayout());
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [dragging, setDragging] = useState<string | null>(null);
  const [resizing, setResizing] = useState<string | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const dragOrigin = useRef<{ id: string; ox: number; oy: number; sx: number; sy: number } | null>(null);
  const resizeOrigin = useRef<{ id: string; startX: number; startY: number; w: number; h: number } | null>(null);

  const spaceKey = parcels.map((p) => p.id).join('|');
  const sensorKey = sensors.map((s) => `${s.id}:${s.unitId || ''}`).join('|');

  const load = useCallback(async () => {
    const ids = spaceKey ? spaceKey.split('|') : [];
    if (!companyId || ids.length === 0) {
      setLayout(emptyRadarLayout());
      return;
    }
    const sensorRefs = sensorKey
      ? sensorKey.split('|').map((row) => {
          const [id, spaceId] = row.split(':');
          return { id, spaceId: spaceId || null };
        })
      : [];
    try {
      const q = new URLSearchParams({ companyId });
      if (engagementId) q.set('engagementId', engagementId);
      if (propertyId) q.set('propertyId', propertyId);
      const r = await fetch(`/api/radar/layout?${q}`);
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'layout');
      setLayout(mergeLayoutWithSpaces(d.layout, ids, sensorRefs));
      setDirty(false);
    } catch {
      setLayout(mergeLayoutWithSpaces(null, ids, sensorRefs));
    }
  }, [companyId, engagementId, propertyId, spaceKey, sensorKey]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    if (!companyId || !dirty) return;
    setSaving(true);
    try {
      const r = await fetch('/api/radar/layout', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, engagementId, propertyId, layout }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'save');
      setLayout(d.layout);
      setDirty(false);
      setSavedFlash(true);
      onSaved?.();
      window.setTimeout(() => setSavedFlash(false), 1800);
    } finally {
      setSaving(false);
    }
  };

  const onPointerDown = (e: ReactPointerEvent, rect: RadarSpaceRect) => {
    if (!canEdit) return;
    e.preventDefault();
    e.stopPropagation();
    onFocus(rect.id);
    const board = boardRef.current;
    if (!board) return;
    const box = board.getBoundingClientRect();
    dragOrigin.current = {
      id: rect.id,
      ox: ((e.clientX - box.left) / box.width) * 100 - rect.x,
      oy: ((e.clientY - box.top) / box.height) * 100 - rect.y,
      sx: rect.x,
      sy: rect.y,
    };
    setDragging(rect.id);
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e: ReactPointerEvent) => {
    if (!canEdit) return;
    const board = boardRef.current;
    if (!board) return;
    const box = board.getBoundingClientRect();
    const pctX = ((e.clientX - box.left) / box.width) * 100;
    const pctY = ((e.clientY - box.top) / box.height) * 100;

    if (resizing && resizeOrigin.current) {
      const space = layout.spaces.find((s) => s.id === resizeOrigin.current!.id);
      if (!space) return;
      const dw = pctX - resizeOrigin.current.startX;
      const dh = pctY - resizeOrigin.current.startY;
      const nw = Math.min(100 - space.x, Math.max(12, resizeOrigin.current.w + dw));
      const nh = Math.min(100 - space.y, Math.max(12, resizeOrigin.current.h + dh));
      setLayout((prev) => ({
        ...prev,
        spaces: prev.spaces.map((s) =>
          s.id === space.id ? { ...s, w: Math.round(nw * 10) / 10, h: Math.round(nh * 10) / 10 } : s,
        ),
      }));
      setDirty(true);
      return;
    }

    if (!dragging || !dragOrigin.current) return;
    const space = layout.spaces.find((s) => s.id === dragOrigin.current!.id);
    if (!space) return;
    const nx = Math.min(100 - space.w, Math.max(0, pctX - dragOrigin.current.ox));
    const ny = Math.min(100 - space.h, Math.max(0, pctY - dragOrigin.current.oy));
    setLayout((prev) => ({
      ...prev,
      spaces: prev.spaces.map((s) => (s.id === space.id ? { ...s, x: Math.round(nx * 10) / 10, y: Math.round(ny * 10) / 10 } : s)),
    }));
    setDirty(true);
  };

  const onPointerUp = () => {
    setDragging(null);
    setResizing(null);
    dragOrigin.current = null;
    resizeOrigin.current = null;
  };

  const onResizeDown = (e: ReactPointerEvent, rect: RadarSpaceRect) => {
    if (!canEdit) return;
    e.preventDefault();
    e.stopPropagation();
    onFocus(rect.id);
    const board = boardRef.current;
    if (!board) return;
    const box = board.getBoundingClientRect();
    resizeOrigin.current = {
      id: rect.id,
      startX: ((e.clientX - box.left) / box.width) * 100,
      startY: ((e.clientY - box.top) / box.height) * 100,
      w: rect.w,
      h: rect.h,
    };
    setResizing(rect.id);
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  if (parcels.length === 0) {
    return (
      <section className="relative overflow-hidden rounded-[1.75rem] border border-dashed border-emerald-400/25 bg-[radial-gradient(ellipse_at_30%_20%,rgba(16,185,129,0.12),transparent_55%),linear-gradient(160deg,#06140f_0%,#0a1f18_45%,#04110c_100%)] px-5 py-10">
        <Silhouette />
        <div className="relative mx-auto max-w-md text-center">
          <MapPinned className="mx-auto h-8 w-8 text-emerald-300/80" />
          <h3 className="mt-3 font-serif text-2xl text-white">{copy.emptyTitle}</h3>
          <p className="mt-2 text-sm text-white/55">{copy.emptyBody}</p>
          {onRequestAddParcel && (
            <button
              type="button"
              onClick={onRequestAddParcel}
              className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-[#04110c]"
            >
              <Plus className="h-4 w-4" />
              {copy.emptyCta}
            </button>
          )}
        </div>
      </section>
    );
  }

  const parcelById = new Map(parcels.map((p) => [p.id, p]));

  return (
    <section className="overflow-hidden rounded-[1.75rem] border border-white/10 bg-[radial-gradient(ellipse_at_top_left,rgba(16,185,129,0.14),transparent_50%),linear-gradient(165deg,#071812_0%,#0a1a14_50%,#050f0c_100%)]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/8 px-4 py-3 sm:px-5">
        <div className="flex items-center gap-2">
          <Leaf className="h-4 w-4 text-emerald-300" />
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">{copy.plant}</p>
          {canEdit && (
            <span className="hidden text-[11px] text-white/35 sm:inline">· {copy.arrange}</span>
          )}
        </div>
        {canEdit && (
          <div className="flex items-center gap-2">
            {onRequestAddParcel && (
              <button
                type="button"
                onClick={onRequestAddParcel}
                className="inline-flex items-center gap-1 rounded-xl border border-emerald-400/35 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-100"
              >
                <Plus className="h-3.5 w-3.5" />
                {copy.addParcel}
              </button>
            )}
            {savedFlash && <span className="text-[11px] text-emerald-200/80">{copy.saved}</span>}
            <button
              type="button"
              disabled={!dirty || saving}
              onClick={() => void save()}
              className="rounded-xl bg-emerald-500/90 px-3 py-1.5 text-xs font-semibold text-[#04110c] disabled:opacity-40"
            >
              {saving ? copy.saving : copy.save}
            </button>
          </div>
        )}
      </div>

      <div
        ref={boardRef}
        role="application"
        aria-label={copy.plant}
        className="relative touch-none select-none aspect-[16/10] min-h-[240px] sm:min-h-[320px]"
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {/* Soft field grid */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.12]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(167,243,208,0.35) 1px, transparent 1px), linear-gradient(90deg, rgba(167,243,208,0.35) 1px, transparent 1px)',
            backgroundSize: '12% 12%',
          }}
        />
        <div className="pointer-events-none absolute inset-6 rounded-[2rem] border border-emerald-400/10" />

        {layout.spaces.map((rect) => {
          const parcel = parcelById.get(rect.id);
          if (!parcel) return null;
          const tone = actionTone(parcel.nextAction, parcel.harvestBlocked, parcel.moisture);
          const focused = focusedId === parcel.id;
          const dimmed = false;
          const alertPulse = tone === 'critical' || parcel.alerts.some((a) => a.severity === 'critical');
          const spaceSensors = layout.sensors.filter((s) => s.spaceId === rect.id);

          return (
            <button
              key={rect.id}
              type="button"
              aria-pressed={focused}
              aria-label={`${parcel.name}${parcel.crop ? `, ${parcel.crop}` : ''}`}
              onClick={() => onFocus(parcel.id)}
              onPointerDown={(e) => onPointerDown(e, rect)}
              className={`absolute overflow-hidden rounded-2xl border text-left transition-all duration-300 ease-out ${tileClasses(tone, focused, dimmed)} ${
                dragging === rect.id || resizing === rect.id ? 'z-20 cursor-grabbing' : canEdit ? 'cursor-grab' : 'cursor-pointer'
              }`}
              style={{
                left: `${rect.x}%`,
                top: `${rect.y}%`,
                width: `${rect.w}%`,
                height: `${rect.h}%`,
              }}
            >
              {alertPulse && (
                <span className="pointer-events-none absolute inset-0 animate-pulse bg-rose-400/10" />
              )}
              <div className="relative flex h-full flex-col justify-between p-2.5 sm:p-3">
                <div>
                  <p className="truncate text-sm font-semibold text-white sm:text-base">{parcel.name}</p>
                  <p className="truncate text-[10px] text-white/55 sm:text-xs">
                    {[parcel.crop, parcel.areaHa != null ? `${parcel.areaHa} ha` : null].filter(Boolean).join(' · ') || '—'}
                  </p>
                </div>
                <div className="flex items-end justify-between gap-1">
                  <div>
                    <p className="text-[9px] uppercase tracking-wide text-white/40">{copy.moisture}</p>
                    <p className="font-serif text-lg leading-none text-white sm:text-xl">
                      {parcel.moisture == null ? '—' : `${parcel.moisture}%`}
                    </p>
                  </div>
                  <span className="rounded-full border border-white/20 bg-black/25 px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-white/75">
                    {labelAction(parcel.nextAction, loc)}
                  </span>
                </div>
                {spaceSensors.map((pin) => {
                  const sens = sensors.find((s) => s.id === pin.id);
                  return (
                    <span
                      key={pin.id}
                      title={sens?.name || copy.sensor}
                      className="pointer-events-none absolute z-10 flex h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 items-center justify-center"
                      style={{ left: `${pin.x}%`, top: `${pin.y}%` }}
                    >
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-300/50" />
                      <span className="relative flex h-2.5 w-2.5 items-center justify-center rounded-full bg-sky-300 text-[#04110c] shadow">
                        <Radio className="h-1.5 w-1.5" />
                      </span>
                    </span>
                  );
                })}
              </div>
              {canEdit && focused && (
                <span
                  role="presentation"
                  onPointerDown={(e) => onResizeDown(e, rect)}
                  className="absolute bottom-1 right-1 z-30 h-4 w-4 cursor-se-resize rounded-sm border border-emerald-200/60 bg-emerald-400/80"
                  title={loc === 'en' ? 'Resize' : 'Redimensionar'}
                />
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}

function Silhouette() {
  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.18]"
      viewBox="0 0 400 220"
      fill="none"
      aria-hidden
    >
      <rect x="28" y="40" width="110" height="70" rx="10" stroke="#6ee7b7" strokeWidth="2" />
      <rect x="150" y="30" width="90" height="90" rx="10" stroke="#6ee7b7" strokeWidth="2" />
      <rect x="255" y="55" width="120" height="80" rx="10" stroke="#6ee7b7" strokeWidth="2" />
      <rect x="60" y="130" width="160" height="55" rx="10" stroke="#6ee7b7" strokeWidth="2" />
      <rect x="240" y="145" width="100" height="40" rx="10" stroke="#6ee7b7" strokeWidth="2" />
      <circle cx="80" cy="70" r="4" fill="#7dd3fc" />
      <circle cx="195" cy="70" r="4" fill="#7dd3fc" />
      <circle cx="300" cy="90" r="4" fill="#7dd3fc" />
    </svg>
  );
}
