'use client';

import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { Factory, Leaf, MapPinned, Package, Plus, Radio } from 'lucide-react';
import { MOISTURE_THRESHOLD, type ParcelAction } from '@/lib/radar/agriculture';
import {
  emptyRadarLayout,
  mergeLayoutWithSpaces,
  type RadarSiteLayoutDoc,
  type RadarSpaceRect,
} from '@/lib/radar/site-layout';
import { spaceKindMeta } from '@/lib/radar/space';
import { radarLoc, radarT, type RadarLoc } from '@/lib/radar/i18n';

type Loc = RadarLoc;

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

function mapCopy(loc: Loc, moduleId?: string | null) {
  const kind = spaceKindMeta(moduleId);
  const unit = kind.unitLabel[loc].toLowerCase();
  return {
    plant: radarT(loc, 'Planta do sítio', 'Planta del sitio', 'Site plant'),
    arrange: radarT(
      loc,
      'Arrastar para organizar · canto para redimensionar',
      'Arrastrar para organizar · esquina para redimensionar',
      'Drag to arrange · corner to resize',
    ),
    save: radarT(loc, 'Guardar planta', 'Guardar planta', 'Save layout'),
    saving: radarT(loc, 'A guardar…', 'Guardando…', 'Saving…'),
    saved: radarT(loc, 'Planta guardada', 'Planta guardada', 'Layout saved'),
    emptyTitle: radarT(
      loc,
      `Ainda sem ${kind.unitLabelPlural.pt.toLowerCase()} na planta`,
      `Aún sin ${kind.unitLabelPlural.es.toLowerCase()} en la planta`,
      `No ${kind.unitLabelPlural.en.toLowerCase()} on the plant yet`,
    ),
    emptyBody: kind.hint[loc],
    emptyCta: radarT(loc, `Nova ${unit}`, `Nueva ${unit}`, `New ${kind.unitLabel.en.toLowerCase()}`),
    addParcel: radarT(loc, `Nova ${unit}`, `Nueva ${unit}`, `New ${kind.unitLabel.en.toLowerCase()}`),
    sensor: radarT(loc, 'Sensor', 'Sensor', 'Sensor'),
  };
}

function actionTone(action: ParcelAction, harvestBlocked: boolean, moisture: number | null) {
  if (action === 'irrigate' || action === 'hold_harvest' || harvestBlocked) return 'critical' as const;
  if (action === 'scout' || action === 'await_signal') return 'warn' as const;
  if (moisture != null && moisture < MOISTURE_THRESHOLD) return 'warn' as const;
  return 'ok' as const;
}

type Props = {
  companyId: string;
  engagementId?: string | null;
  propertyId?: string | null;
  locale: string;
  moduleId?: string | null;
  parcels: MapParcel[];
  sensors: MapSensor[];
  focusedId: string | null;
  onFocus: (id: string) => void;
  mode?: 'ops' | 'empresa' | 'preview';
  onSaved?: () => void;
  onRequestAddParcel?: () => void;
  /** @deprecated trail removed — kept so callers compile; ignored */
  trailUnitIds?: string[];
  hero?: boolean;
  /** Real satellite/OSM surface. Spaces stay as an overlay around the property pin. */
  basemap?: {
    lat: number | null;
    lng: number | null;
    areaHa: number | null;
    onPin?: (lat: number, lng: number) => void;
    placing?: boolean;
    query?: string;
  };
};

function HeaderIcon({ moduleId }: { moduleId?: string | null }) {
  if (moduleId === 'agroindustry') return <Factory className="h-4 w-4 text-slate-600" />;
  if (moduleId === 'livestock') return <Package className="h-4 w-4 text-amber-700" />;
  return <Leaf className="h-4 w-4 text-emerald-700" />;
}

function pinColor(tone: 'ok' | 'warn' | 'critical') {
  if (tone === 'critical') return { fill: '#e11d48', ring: 'rgba(225,29,72,0.35)' };
  if (tone === 'warn') return { fill: '#d97706', ring: 'rgba(217,119,6,0.35)' };
  return { fill: '#0284c7', ring: 'rgba(2,132,199,0.35)' };
}

export function RadarSiteMap({
  companyId,
  engagementId,
  propertyId,
  locale,
  moduleId,
  parcels,
  sensors,
  focusedId,
  onFocus,
  mode = 'ops',
  onSaved,
  onRequestAddParcel,
  hero = false,
  basemap,
}: Props) {
  const loc = radarLoc(locale);
  const canEdit = mode === 'empresa';
  const copy = mapCopy(loc, moduleId);
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

  if (basemap) {
    return (
      <RadarBasemap
        locale={loc}
        parcels={parcels}
        layout={layout}
        focusedId={focusedId}
        onFocus={onFocus}
        lat={basemap.lat}
        lng={basemap.lng}
        areaHa={basemap.areaHa}
        onPin={basemap.onPin}
        placing={basemap.placing}
        query={basemap.query}
      />
    );
  }

  if (parcels.length === 0) {
    return (
      <section className="relative overflow-hidden rounded-xl border border-white/15 bg-[#eef1ef] px-5 py-10">
        <div className="relative mx-auto max-w-md text-center">
          <MapPinned className="mx-auto h-8 w-8 text-slate-500" />
          <h3 className="mt-3 text-xl font-semibold text-slate-800">{copy.emptyTitle}</h3>
          <p className="mt-2 text-sm text-slate-500">{copy.emptyBody}</p>
          {onRequestAddParcel && (
            <button
              type="button"
              onClick={onRequestAddParcel}
              className="mt-5 inline-flex items-center gap-2 rounded-lg bg-sky-600 px-5 py-2.5 text-sm font-semibold text-white"
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
    <section className="overflow-hidden rounded-xl border border-white/15 bg-[#eef1ef] shadow-sm">
      {canEdit && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/80 bg-white/70 px-4 py-2.5 sm:px-5">
          <div className="flex items-center gap-2">
            <HeaderIcon moduleId={moduleId} />
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">{copy.plant}</p>
            <span className="hidden text-[11px] text-slate-400 sm:inline">· {copy.arrange}</span>
          </div>
          <div className="flex items-center gap-2">
            {onRequestAddParcel && (
              <button
                type="button"
                onClick={onRequestAddParcel}
                className="inline-flex items-center gap-1 rounded-lg border border-sky-600/30 bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-800"
              >
                <Plus className="h-3.5 w-3.5" />
                {copy.addParcel}
              </button>
            )}
            {savedFlash && <span className="text-[11px] text-emerald-700">{copy.saved}</span>}
            {dirty && (
              <button
                type="button"
                disabled={saving}
                onClick={() => void save()}
                className="rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
              >
                {saving ? copy.saving : copy.save}
              </button>
            )}
          </div>
        </div>
      )}

      <div
        ref={boardRef}
        role="application"
        aria-label={copy.plant}
        className={`relative touch-none select-none aspect-[16/10] ${
          hero ? 'min-h-[280px] sm:min-h-[380px] md:min-h-[440px]' : 'min-h-[240px] sm:min-h-[320px]'
        }`}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {/* Floor grid — plant, not dashboard */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundColor: '#e8ece9',
            backgroundImage:
              'linear-gradient(rgba(100,116,139,0.12) 1px, transparent 1px), linear-gradient(90deg, rgba(100,116,139,0.12) 1px, transparent 1px)',
            backgroundSize: '8% 8%',
          }}
        />
        <div className="pointer-events-none absolute inset-3 rounded-lg border border-slate-300/60 sm:inset-4" />

        {layout.spaces.map((rect) => {
          const parcel = parcelById.get(rect.id);
          if (!parcel) return null;
          const tone = actionTone(parcel.nextAction, parcel.harvestBlocked, parcel.moisture);
          const focused = focusedId === parcel.id;
          const spaceSensors = layout.sensors.filter((s) => s.spaceId === rect.id);
          const extraSensors = sensors.filter(
            (s) => s.unitId === rect.id && !spaceSensors.some((p) => p.id === s.id),
          );
          const pins = [
            ...spaceSensors.map((pin) => {
              const sens = sensors.find((s) => s.id === pin.id);
              return {
                id: pin.id,
                name: sens?.name || copy.sensor,
                lastValue: sens?.lastValue ?? null,
                x: pin.x,
                y: pin.y,
                absolute: false as const,
              };
            }),
            ...extraSensors.map((sens, idx) => ({
              id: sens.id,
              name: sens.name,
              lastValue: sens.lastValue,
              x: 70 + idx * 12,
              y: 28,
              absolute: false as const,
            })),
          ];
          // If no sensors, still show one status pin at center so the plant reads as spatial ops
          if (pins.length === 0) {
            pins.push({
              id: `zone-${parcel.id}`,
              name: parcel.name,
              lastValue: parcel.moisture,
              x: 50,
              y: 55,
              absolute: false,
            });
          }

          return (
            <button
              key={rect.id}
              type="button"
              aria-pressed={focused}
              aria-label={parcel.name}
              onClick={() => onFocus(parcel.id)}
              onPointerDown={(e) => onPointerDown(e, rect)}
              className={`absolute overflow-visible rounded-md border text-left transition-[box-shadow,border-color,background-color] duration-150 ${
                focused
                  ? 'z-10 border-sky-600 bg-white shadow-[0_0_0_2px_rgba(2,132,199,0.35)]'
                  : 'border-slate-400/70 bg-white/85 hover:border-sky-500/70 hover:bg-white'
              } ${
                dragging === rect.id || resizing === rect.id
                  ? 'z-20 cursor-grabbing'
                  : canEdit
                    ? 'cursor-grab'
                    : 'cursor-pointer'
              }`}
              style={{
                left: `${rect.x}%`,
                top: `${rect.y}%`,
                width: `${rect.w}%`,
                height: `${rect.h}%`,
              }}
            >
              {/* Zone label only — metrics live in the action panel */}
              <span className="absolute left-1.5 top-1.5 max-w-[90%] truncate rounded bg-white/90 px-1.5 py-0.5 text-[11px] font-semibold text-slate-800 shadow-sm sm:text-xs">
                {parcel.name}
              </span>

              {pins.map((pin) => {
                const colors = pinColor(tone);
                const live = pin.lastValue;
                return (
                  <span
                    key={pin.id}
                    title={live != null ? `${pin.name}: ${live}` : pin.name}
                    className="pointer-events-none absolute z-10 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center"
                    style={{ left: `${pin.x}%`, top: `${pin.y}%` }}
                  >
                    <span className="relative flex h-5 w-5 items-center justify-center sm:h-6 sm:w-6">
                      <span
                        className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-40"
                        style={{ backgroundColor: colors.ring }}
                      />
                      <span
                        className="relative flex h-3.5 w-3.5 items-center justify-center rounded-full border-2 border-white shadow-md sm:h-4 sm:w-4"
                        style={{ backgroundColor: colors.fill }}
                      >
                        <Radio className="h-2 w-2 text-white" />
                      </span>
                    </span>
                  </span>
                );
              })}

              {canEdit && focused && (
                <span
                  role="presentation"
                  onPointerDown={(e) => onResizeDown(e, rect)}
                  className="absolute bottom-1 right-1 z-30 h-3.5 w-3.5 cursor-se-resize rounded-sm border border-sky-700 bg-sky-500"
                  title={radarT(loc, 'Redimensionar', 'Redimensionar', 'Resize')}
                />
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}

const ESRI_IMAGERY =
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
const OSM_TILES = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

type LeafletNs = {
  map: (el: HTMLElement, opts?: Record<string, unknown>) => LeafletMap;
  tileLayer: (url: string, opts?: Record<string, unknown>) => { addTo: (map: LeafletMap) => unknown; remove: () => void };
  layerGroup: () => { addTo: (map: LeafletMap) => unknown; clearLayers: () => void; addLayer: (layer: unknown) => void };
  polygon: (latlngs: [number, number][], opts?: Record<string, unknown>) => { on: (ev: string, fn: (e: { originalEvent?: Event }) => void) => unknown; bindTooltip: (text: string, opts?: Record<string, unknown>) => unknown };
  circleMarker: (latlng: [number, number], opts?: Record<string, unknown>) => unknown;
  control: { zoom: (opts?: Record<string, unknown>) => { addTo: (map: LeafletMap) => void } };
  DomEvent: { stopPropagation: (e: Event) => void };
  latLngBounds: (pts: [number, number][]) => unknown;
};

type LeafletMap = {
  setView: (center: [number, number], zoom: number) => void;
  fitBounds: (bounds: unknown, opts?: Record<string, unknown>) => void;
  remove: () => void;
  on: (ev: string, fn: (e: { latlng: { lat: number; lng: number } }) => void) => void;
  off: (ev: string, fn: (e: { latlng: { lat: number; lng: number } }) => void) => void;
  invalidateSize: () => void;
  getContainer: () => HTMLElement;
};

function loadLeaflet(): Promise<LeafletNs> {
  if (typeof window === 'undefined') return Promise.reject(new Error('leaflet'));
  const w = window as Window & { L?: LeafletNs };
  if (w.L) return Promise.resolve(w.L);
  return new Promise((resolve, reject) => {
    if (!document.getElementById('radar-leaflet-css')) {
      const link = document.createElement('link');
      link.id = 'radar-leaflet-css';
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }
    const done = () => {
      if (w.L) resolve(w.L);
      else reject(new Error('leaflet'));
    };
    const existing = document.getElementById('radar-leaflet-js') as HTMLScriptElement | null;
    if (existing) {
      if (w.L) done();
      else existing.addEventListener('load', done, { once: true });
      return;
    }
    const script = document.createElement('script');
    script.id = 'radar-leaflet-js';
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.async = true;
    script.onload = () => done();
    script.onerror = () => reject(new Error('leaflet'));
    document.body.appendChild(script);
  });
}

function offsetLatLng(lat: number, lng: number, eastM: number, northM: number): [number, number] {
  const lat2 = lat + northM / 111320;
  const lng2 = lng + eastM / (111320 * Math.cos((lat * Math.PI) / 180));
  return [lat2, lng2];
}

function siteRing(lat: number, lng: number, sideM: number): [number, number][] {
  const h = sideM / 2;
  return [
    offsetLatLng(lat, lng, -h, h),
    offsetLatLng(lat, lng, h, h),
    offsetLatLng(lat, lng, h, -h),
    offsetLatLng(lat, lng, -h, -h),
  ];
}

function spaceRing(lat: number, lng: number, sideM: number, rect: RadarSpaceRect): [number, number][] {
  const west = -sideM / 2 + (rect.x / 100) * sideM;
  const east = west + (rect.w / 100) * sideM;
  const north = sideM / 2 - (rect.y / 100) * sideM;
  const south = north - (rect.h / 100) * sideM;
  return [
    offsetLatLng(lat, lng, west, north),
    offsetLatLng(lat, lng, east, north),
    offsetLatLng(lat, lng, east, south),
    offsetLatLng(lat, lng, west, south),
  ];
}

function RadarBasemap({
  locale,
  parcels,
  layout,
  focusedId,
  onFocus,
  lat,
  lng,
  areaHa,
  onPin,
  placing,
  query,
}: {
  locale: Loc;
  parcels: MapParcel[];
  layout: RadarSiteLayoutDoc;
  focusedId: string | null;
  onFocus: (id: string) => void;
  lat: number | null;
  lng: number | null;
  areaHa: number | null;
  onPin?: (lat: number, lng: number) => void;
  placing?: boolean;
  query?: string;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const overlaysRef = useRef<{ clearLayers: () => void; addLayer: (layer: unknown) => void } | null>(null);
  const satRef = useRef<{ addTo: (map: LeafletMap) => unknown; remove: () => void } | null>(null);
  const osmRef = useRef<{ addTo: (map: LeafletMap) => unknown; remove: () => void } | null>(null);
  const [imagery, setImagery] = useState<'sat' | 'map'>('sat');
  const [ready, setReady] = useState(false);
  const onPinRef = useRef(onPin);
  const onFocusRef = useRef(onFocus);
  const placingRef = useRef(placing);
  const fittedKey = useRef('');
  onPinRef.current = onPin;
  onFocusRef.current = onFocus;
  placingRef.current = placing;

  const hasPin = lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let cancelled = false;
    let map: LeafletMap | null = null;
    void loadLeaflet()
      .then((L) => {
        if (cancelled || !hostRef.current) return;
        map = L.map(hostRef.current, { zoomControl: false, attributionControl: true });
        L.control.zoom({ position: 'bottomright' }).addTo(map);
        const sat = L.tileLayer(ESRI_IMAGERY, {
          attribution: 'Imagery © Esri',
          maxZoom: 19,
        });
        const osm = L.tileLayer(OSM_TILES, {
          attribution: '© OpenStreetMap',
          maxZoom: 19,
        });
        sat.addTo(map);
        const overlays = L.layerGroup();
        overlays.addTo(map);
        map.setView(hasPin ? [lat as number, lng as number] : [-15.8, -47.9], hasPin ? 17 : 12);
        map.on('click', (e) => {
          if (!placingRef.current) return;
          const pin = onPinRef.current;
          if (!pin) return;
          pin(Math.round(e.latlng.lat * 1e6) / 1e6, Math.round(e.latlng.lng * 1e6) / 1e6);
        });
        mapRef.current = map;
        overlaysRef.current = overlays;
        satRef.current = sat;
        osmRef.current = osm;
        setReady(true);
        const ro = new ResizeObserver(() => map?.invalidateSize());
        ro.observe(hostRef.current);
        (map as LeafletMap & { __ro?: ResizeObserver }).__ro = ro;
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
      const ro = (map as (LeafletMap & { __ro?: ResizeObserver }) | null)?.__ro;
      ro?.disconnect();
      map?.remove();
      mapRef.current = null;
      overlaysRef.current = null;
      setReady(false);
    };
    // Map instance is created once; pin recentering happens below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    if (imagery === 'sat') {
      osmRef.current?.remove();
      satRef.current?.addTo(map);
    } else {
      satRef.current?.remove();
      osmRef.current?.addTo(map);
    }
  }, [imagery, ready]);

  useEffect(() => {
    const map = mapRef.current;
    const overlays = overlaysRef.current;
    if (!map || !overlays || !ready) return;
    let cancelled = false;
    void loadLeaflet().then((L) => {
      if (cancelled) return;
      overlays.clearLayers();
      if (!hasPin || lat == null || lng == null) {
        map.getContainer().style.cursor = placing ? 'crosshair' : '';
        return;
      }
      map.getContainer().style.cursor = placing ? 'crosshair' : '';
      const ha = areaHa && areaHa > 0 ? areaHa : Math.max(0.4, parcels.length * 0.35 || 0.4);
      const side = Math.sqrt(ha * 10000);
      const q = (query || '').trim().toLowerCase();
      const bounds: [number, number][] = [];
      const outline = siteRing(lat, lng, side);
      bounds.push(...outline);
      overlays.addLayer(
        L.polygon(outline, {
          color: '#5eead4',
          weight: 2,
          dashArray: '6 6',
          fillColor: '#14b8a6',
          fillOpacity: 0.08,
        }),
      );
      const parcelById = new Map(parcels.map((p) => [p.id, p]));
      for (const rect of layout.spaces) {
        const parcel = parcelById.get(rect.id);
        if (!parcel) continue;
        const tone = actionTone(parcel.nextAction, parcel.harvestBlocked, parcel.moisture);
        const match = !q || parcel.name.toLowerCase().includes(q) || (parcel.crop || '').toLowerCase().includes(q);
        const focused = focusedId === parcel.id;
        const color = tone === 'critical' ? '#e11d48' : tone === 'warn' ? '#f59e0b' : '#2dd4bf';
        const ring = spaceRing(lat, lng, side, rect);
        bounds.push(...ring);
        const poly = L.polygon(ring, {
          color: focused ? '#ffffff' : color,
          weight: focused ? 3 : 1.5,
          fillColor: color,
          fillOpacity: match ? (focused ? 0.55 : 0.38) : 0.08,
        });
        poly.on('click', (e) => {
          if (e.originalEvent) L.DomEvent.stopPropagation(e.originalEvent);
          onFocusRef.current(parcel.id);
        });
        poly.bindTooltip(parcel.crop ? `${parcel.name} · ${parcel.crop}` : parcel.name, {
          permanent: true,
          direction: 'center',
          className: 'radar-space-tip',
          opacity: match ? 1 : 0.35,
        });
        overlays.addLayer(poly);
      }
      overlays.addLayer(
        L.circleMarker([lat, lng], {
          radius: 7,
          color: '#042f2e',
          weight: 2,
          fillColor: '#5eead4',
          fillOpacity: 1,
        }),
      );
      const geomKey = `${lat}|${lng}|${side}|${layout.spaces.map((s) => `${s.id}:${s.x}:${s.y}:${s.w}:${s.h}`).join(',')}`;
      if (fittedKey.current !== geomKey) {
        fittedKey.current = geomKey;
        if (bounds.length > 0) {
          map.fitBounds(L.latLngBounds(bounds), { padding: [72, 72], maxZoom: 18, animate: false });
        } else {
          map.setView([lat, lng], 17);
        }
      }
    });
    return () => {
      cancelled = true;
    };
  }, [ready, hasPin, lat, lng, areaHa, layout, parcels, focusedId, query, placing]);

  return (
    <div className="radar-basemap absolute inset-0">
      <div ref={hostRef} className="absolute inset-0" />
      <style>{`
        .radar-basemap .leaflet-control-zoom a {
          background: #07111a;
          color: #ecfeff;
          border-color: rgba(255,255,255,0.14);
          width: 34px;
          height: 34px;
          line-height: 34px;
        }
        .radar-basemap .leaflet-control-zoom a:hover { background: #12343c; color: white; }
        .radar-basemap .leaflet-control-attribution {
          background: rgba(7,17,26,0.78);
          color: rgba(255,255,255,0.55);
          font-size: 10px;
        }
        .radar-basemap .leaflet-control-attribution a { color: #99f6e4; }
        .radar-space-tip {
          background: rgba(7,17,26,0.9);
          color: white;
          border: 0;
          border-radius: 999px;
          box-shadow: none;
          font-size: 11px;
          font-weight: 600;
          padding: 2px 8px;
        }
        .radar-space-tip::before { display: none; }
      `}</style>
      <div className="absolute bottom-4 left-1/2 z-[500] flex -translate-x-1/2 rounded-full bg-[#07111A]/92 p-1 shadow-lg ring-1 ring-white/15">
        <button
          type="button"
          onClick={() => setImagery('sat')}
          className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
            imagery === 'sat' ? 'bg-teal-300 text-slate-950' : 'text-white/75'
          }`}
        >
          {radarT(locale, 'Satélite', 'Satélite', 'Satellite')}
        </button>
        <button
          type="button"
          onClick={() => setImagery('map')}
          className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
            imagery === 'map' ? 'bg-teal-300 text-slate-950' : 'text-white/75'
          }`}
        >
          {radarT(locale, 'Mapa', 'Mapa', 'Map')}
        </button>
      </div>
      {!hasPin && (
        <p className="pointer-events-none absolute left-1/2 top-16 z-[500] -translate-x-1/2 rounded-full bg-[#07111A]/90 px-4 py-2 text-sm text-white shadow-lg ring-1 ring-white/10">
          {radarT(locale, 'Clica no mapa para marcar o sítio', 'Clic en el mapa para marcar el sitio', 'Click the map to pin this site')}
        </p>
      )}
      {hasPin && placing && (
        <p className="pointer-events-none absolute left-1/2 top-16 z-[500] -translate-x-1/2 rounded-full bg-[#07111A]/90 px-4 py-2 text-sm text-white shadow-lg ring-1 ring-white/10">
          {radarT(locale, 'Clica para mover o sítio', 'Clic para mover el sitio', 'Click to move this site')}
        </p>
      )}
    </div>
  );
}
