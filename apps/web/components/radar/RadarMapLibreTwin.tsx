'use client';

import { useEffect, useRef, useState } from 'react';
import type { GeoJSONSource, Map as MapLibreMap, StyleSpecification } from 'maplibre-gl';
import { sideMetersFromHa } from '@/lib/radar/meters';
import { offsetLatLng, siteRingLngLat, spaceRingLngLat } from '@/lib/radar/geo-map';
import {
  radarMapLibreStyle,
  radarSatelliteAvailable,
  type RadarMapBasemap,
} from '@/lib/radar/maplibre-style';
import { radarLoc, radarT } from '@/lib/radar/i18n';
import type { RadarIrrigationPath, RadarSiteStructure, RadarSpaceRect } from '@/lib/radar/site-layout';
import type { WorldParcel } from '@/components/radar/radar-world-scene';

import 'maplibre-gl/dist/maplibre-gl.css';

type Props = {
  locale: string;
  parcels: WorldParcel[];
  spaces: RadarSpaceRect[];
  focusedId: string | null;
  onFocus: (id: string) => void;
  lat: number;
  lng: number;
  areaHa?: number | null;
  siteSideM?: number | null;
  structures?: RadarSiteStructure[];
  irrigation?: RadarIrrigationPath[];
  fill?: boolean;
};

type OverlayData = {
  parcels: WorldParcel[];
  spaces: RadarSpaceRect[];
  focusedId: string | null;
  structures: RadarSiteStructure[];
  irrigation: RadarIrrigationPath[];
  sideM: number;
  lat: number;
  lng: number;
};

function toneColor(p: WorldParcel, focused: boolean): string {
  if (focused) return '#ffffff';
  if (p.nextAction === 'irrigate' || p.nextAction === 'hold_harvest' || p.harvestBlocked) return '#e11d48';
  if (p.nextAction === 'scout' || p.nextAction === 'await_signal') return '#f59e0b';
  if (p.moisture != null && p.moisture < 25) return '#f59e0b';
  return '#2dd4bf';
}

function extrusionHeight(p: WorldParcel): number {
  if (p.harvestBlocked || p.nextAction === 'irrigate') return 6;
  if (p.crop) return 4;
  return 2.5;
}

function emptyFc(): GeoJSON.FeatureCollection {
  return { type: 'FeatureCollection', features: [] };
}

function ensureOverlayLayers(map: MapLibreMap) {
  if (!map.getSource('radar-site')) {
    map.addSource('radar-site', { type: 'geojson', data: emptyFc() });
    map.addLayer({
      id: 'radar-site-fill',
      type: 'fill',
      source: 'radar-site',
      paint: { 'fill-color': '#14b8a6', 'fill-opacity': 0.08 },
    });
    map.addLayer({
      id: 'radar-site-line',
      type: 'line',
      source: 'radar-site',
      paint: { 'line-color': '#5eead4', 'line-width': 2, 'line-dasharray': [2, 1.5] },
    });
  }
  if (!map.getSource('radar-spaces')) {
    map.addSource('radar-spaces', { type: 'geojson', data: emptyFc() });
    map.addLayer({
      id: 'radar-spaces-fill',
      type: 'fill-extrusion',
      source: 'radar-spaces',
      paint: {
        'fill-extrusion-color': ['get', 'color'],
        'fill-extrusion-height': ['get', 'height'],
        'fill-extrusion-base': 0,
        'fill-extrusion-opacity': 0.78,
      },
    });
  }
  if (!map.getSource('radar-structures')) {
    map.addSource('radar-structures', { type: 'geojson', data: emptyFc() });
    map.addLayer({
      id: 'radar-structures-fill',
      type: 'fill-extrusion',
      source: 'radar-structures',
      paint: {
        'fill-extrusion-color': ['get', 'color'],
        'fill-extrusion-height': ['get', 'height'],
        'fill-extrusion-base': 0,
        'fill-extrusion-opacity': 0.65,
      },
    });
  }
  if (!map.getSource('radar-irrigation')) {
    map.addSource('radar-irrigation', { type: 'geojson', data: emptyFc() });
    map.addLayer({
      id: 'radar-irrigation-line',
      type: 'line',
      source: 'radar-irrigation',
      paint: { 'line-color': '#38bdf8', 'line-width': 3 },
    });
  }
  if (!map.getSource('radar-labels')) {
    map.addSource('radar-labels', { type: 'geojson', data: emptyFc() });
    map.addLayer({
      id: 'radar-labels',
      type: 'symbol',
      source: 'radar-labels',
      layout: {
        'text-field': ['get', 'label'],
        'text-size': 12,
        'text-offset': [0, -0.6],
        'text-anchor': 'bottom',
        'text-font': ['Open Sans Regular', 'Arial Unicode MS Regular'],
      },
      paint: {
        'text-color': '#f8fafc',
        'text-halo-color': '#0f172a',
        'text-halo-width': 1.4,
      },
    });
  }
}

function syncOverlays(map: MapLibreMap, data: OverlayData) {
  const { parcels, spaces, focusedId, structures, irrigation, sideM, lat, lng } = data;
  const parcelById = new Map(parcels.map((p) => [p.id, p]));

  (map.getSource('radar-site') as GeoJSONSource | undefined)?.setData({
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: {},
        geometry: { type: 'Polygon', coordinates: [siteRingLngLat(lat, lng, sideM)] },
      },
    ],
  });

  const spaceFeatures: GeoJSON.Feature[] = [];
  const labelFeatures: GeoJSON.Feature[] = [];
  for (const rect of spaces) {
    if (rect.placed !== true) continue;
    const parcel = parcelById.get(rect.id);
    if (!parcel) continue;
    const focused = focusedId === parcel.id;
    const ring = spaceRingLngLat(lat, lng, sideM, rect);
    spaceFeatures.push({
      type: 'Feature',
      properties: {
        id: parcel.id,
        color: toneColor(parcel, focused),
        height: extrusionHeight(parcel) * (focused ? 1.25 : 1),
      },
      geometry: { type: 'Polygon', coordinates: [ring] },
    });
    const n = Math.max(1, ring.length - 1);
    const cx = ring.slice(0, n).reduce((s, c) => s + c[0], 0) / n;
    const cy = ring.slice(0, n).reduce((s, c) => s + c[1], 0) / n;
    labelFeatures.push({
      type: 'Feature',
      properties: { label: `${parcel.name}${parcel.crop ? ` · ${parcel.crop}` : ''}` },
      geometry: { type: 'Point', coordinates: [cx, cy] },
    });
  }
  (map.getSource('radar-spaces') as GeoJSONSource | undefined)?.setData({
    type: 'FeatureCollection',
    features: spaceFeatures,
  });
  (map.getSource('radar-labels') as GeoJSONSource | undefined)?.setData({
    type: 'FeatureCollection',
    features: labelFeatures,
  });

  const structFeatures: GeoJSON.Feature[] = structures.map((s) => {
    const asRect: RadarSpaceRect = {
      id: s.id,
      x: s.x,
      y: s.y,
      w: s.w,
      h: s.h,
      rotation: s.rotation,
      placed: true,
    };
    const color =
      s.kind === 'greenhouse' ? '#a5f3fc' : s.kind === 'shed' ? '#b45309' : s.kind === 'path' ? '#d6d3d1' : '#0284c7';
    const height = s.kind === 'path' ? 0.4 : s.heightM ?? (s.kind === 'greenhouse' ? 3.2 : 2.4);
    return {
      type: 'Feature' as const,
      properties: { color, height },
      geometry: { type: 'Polygon' as const, coordinates: [spaceRingLngLat(lat, lng, sideM, asRect)] },
    };
  });
  (map.getSource('radar-structures') as GeoJSONSource | undefined)?.setData({
    type: 'FeatureCollection',
    features: structFeatures,
  });

  const irrigFeatures: GeoJSON.Feature[] = irrigation
    .filter((path) => path.points.length >= 2)
    .map((path) => ({
      type: 'Feature' as const,
      properties: {},
      geometry: {
        type: 'LineString' as const,
        coordinates: path.points.map((p) => {
          const west = -sideM / 2 + (p.x / 100) * sideM;
          const north = sideM / 2 - (p.y / 100) * sideM;
          const [la, ln] = offsetLatLng(lat, lng, west, north);
          return [ln, la] as [number, number];
        }),
      },
    }));
  (map.getSource('radar-irrigation') as GeoJSONSource | undefined)?.setData({
    type: 'FeatureCollection',
    features: irrigFeatures,
  });
}

function fitSite(map: MapLibreMap, lat: number, lng: number, sideM: number) {
  const ring = siteRingLngLat(lat, lng, sideM);
  const lngs = ring.map((c) => c[0]);
  const lats = ring.map((c) => c[1]);
  map.fitBounds(
    [
      [Math.min(...lngs), Math.min(...lats)],
      [Math.max(...lngs), Math.max(...lats)],
    ],
    { padding: 72, pitch: 58, bearing: -28, duration: 0, maxZoom: 18 },
  );
}

/**
 * Real pitched 3D map (MapLibre + OSM). Spaces render as fill-extrusions on the basemap —
 * not a three.js ground plane that can fail into a foggy slab.
 */
export function RadarMapLibreTwin({
  locale,
  parcels,
  spaces,
  focusedId,
  onFocus,
  lat,
  lng,
  areaHa = null,
  siteSideM = null,
  structures = [],
  irrigation = [],
  fill = false,
}: Props) {
  const loc = radarLoc(locale);
  const hostRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const onFocusRef = useRef(onFocus);
  onFocusRef.current = onFocus;
  const [basemap, setBasemap] = useState<RadarMapBasemap>('streets');
  const [ready, setReady] = useState(false);
  const satOk = radarSatelliteAvailable();

  const sideM =
    siteSideM && siteSideM > 0
      ? siteSideM
      : sideMetersFromHa(areaHa, Math.max(40, parcels.length * 8));

  const dataRef = useRef<OverlayData>({
    parcels,
    spaces,
    focusedId,
    structures,
    irrigation,
    sideM,
    lat,
    lng,
  });
  dataRef.current = { parcels, spaces, focusedId, structures, irrigation, sideM, lat, lng };

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let cancelled = false;
    let map: MapLibreMap | null = null;
    let ro: ResizeObserver | null = null;

    void (async () => {
      const maplibregl = await import('maplibre-gl');
      if (cancelled || !hostRef.current) return;

      map = new maplibregl.Map({
        container: hostRef.current,
        style: radarMapLibreStyle(basemap) as StyleSpecification,
        center: [lng, lat],
        zoom: 17,
        pitch: 58,
        bearing: -28,
        maxPitch: 70,
        attributionControl: { compact: true },
      });
      map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'bottom-right');
      map.addControl(new maplibregl.ScaleControl({ maxWidth: 100 }), 'bottom-left');

      map.on('load', () => {
        if (cancelled || !map) return;
        ensureOverlayLayers(map);
        syncOverlays(map, dataRef.current);
        fitSite(map, dataRef.current.lat, dataRef.current.lng, dataRef.current.sideM);
        setReady(true);
      });

      map.on('click', 'radar-spaces-fill', (e) => {
        const id = e.features?.[0]?.properties?.id as string | undefined;
        if (id) onFocusRef.current(id);
      });
      map.on('mouseenter', 'radar-spaces-fill', () => {
        if (map) map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', 'radar-spaces-fill', () => {
        if (map) map.getCanvas().style.cursor = '';
      });

      mapRef.current = map;
      ro = new ResizeObserver(() => map?.resize());
      ro.observe(hostRef.current);
    })();

    return () => {
      cancelled = true;
      ro?.disconnect();
      map?.remove();
      mapRef.current = null;
      setReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [basemap, lat, lng]);

  const overlayKey = [
    sideM,
    focusedId,
    spaces.map((s) => `${s.id}:${s.x}:${s.y}:${s.w}:${s.h}:${s.rotation ?? 0}:${s.placed ? 1 : 0}`).join('|'),
    parcels.map((p) => `${p.id}:${p.moisture ?? ''}:${p.nextAction ?? ''}:${p.crop ?? ''}`).join('|'),
    structures.map((s) => `${s.id}:${s.x}:${s.y}:${s.w}:${s.h}`).join(','),
    irrigation.map((i) => i.id).join(','),
  ].join('::');

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const apply = () => {
      ensureOverlayLayers(map);
      syncOverlays(map, dataRef.current);
    };
    if (map.isStyleLoaded()) apply();
    else map.once('idle', apply);
  }, [overlayKey, ready]);

  const tall = fill ? 'absolute inset-0 h-full min-h-0' : 'relative min-h-[280px] sm:min-h-[380px]';

  return (
    <div className={fill ? 'absolute inset-0 overflow-hidden' : `relative overflow-hidden rounded-xl ${tall}`}>
      <div ref={hostRef} className="absolute inset-0" />
      {satOk && (
        <div className="pointer-events-auto absolute left-1/2 top-3 z-[2] flex -translate-x-1/2 rounded-full bg-[#07111A]/95 p-1 shadow-lg ring-1 ring-white/25">
          <button
            type="button"
            onClick={() => setBasemap('streets')}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
              basemap === 'streets' ? 'bg-teal-300 text-slate-950' : 'text-white/85 hover:text-white'
            }`}
          >
            {radarT(loc, 'Ruas', 'Calles', 'Streets')}
          </button>
          <button
            type="button"
            onClick={() => setBasemap('satellite')}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
              basemap === 'satellite' ? 'bg-teal-300 text-slate-950' : 'text-white/85 hover:text-white'
            }`}
          >
            {radarT(loc, 'Satélite', 'Satélite', 'Satellite')}
          </button>
        </div>
      )}
      <p className="pointer-events-none absolute bottom-2 left-3 z-[2] max-w-[70%] text-[10px] font-medium text-white/85 drop-shadow">
        {radarT(
          loc,
          'Mapa 3D · arrasta para orbitar · © OpenStreetMap',
          'Mapa 3D · arrastra para orbitar · © OpenStreetMap',
          '3D map · drag to orbit · © OpenStreetMap',
        )}
        {basemap === 'satellite' ? ' · © MapTiler' : ''}
      </p>
    </div>
  );
}
