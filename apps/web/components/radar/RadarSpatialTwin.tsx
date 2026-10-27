'use client';

import { useEffect, useRef } from 'react';
import { radarLoc, radarT } from '@/lib/radar/i18n';
import type { WorldParcel, WorldSensor } from '@/components/radar/radar-world-scene';
import type { RadarIrrigationPath, RadarSiteStructure, RadarSpaceRect } from '@/lib/radar/site-layout';
import { RadarMapLibreTwin } from '@/components/radar/RadarMapLibreTwin';

type Props = {
  locale: string;
  moduleId?: string | null;
  parcels: WorldParcel[];
  sensors: WorldSensor[];
  focusedId: string | null;
  onFocus: (id: string) => void;
  hero?: boolean;
  fill?: boolean;
  lat?: number | null;
  lng?: number | null;
  areaHa?: number | null;
  siteSideM?: number | null;
  structures?: RadarSiteStructure[];
  irrigation?: RadarIrrigationPath[];
  /** Layout spaces (placed flag + % rects) for MapLibre extrusions. */
  spaces?: RadarSpaceRect[];
  /** How many parcels are geolocated on the OSM map (`placed=true`). Local plant still renders when 0. */
  mapPlacedCount?: number;
};

/**
 * Mundo 3D da exploração.
 * Com pin geo: MapLibre com pitch (mapa real inclinável) + extrusões dos espaços.
 * Sem pin: planta local three.js (sem plano OSM — esse era a névoa azul).
 */
export function RadarSpatialTwin({
  locale,
  moduleId,
  parcels,
  sensors,
  focusedId,
  onFocus,
  hero = false,
  fill = false,
  lat = null,
  lng = null,
  areaHa = null,
  siteSideM = null,
  structures = [],
  irrigation = [],
  spaces = [],
  mapPlacedCount,
}: Props) {
  const loc = radarLoc(locale);
  const hostRef = useRef<HTMLDivElement>(null);
  const focusRef = useRef(onFocus);
  focusRef.current = onFocus;

  const hasOsmPin = lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng);

  const key = parcels
    .map(
      (p) =>
        `${p.id}:${p.moisture ?? ''}:${p.name}:${p.crop ?? ''}:${p.x ?? ''}:${p.y ?? ''}:${p.w ?? ''}:${p.h ?? ''}:${p.rotation ?? ''}:${p.widthM ?? ''}:${p.lengthM ?? ''}:${p.spacingM ?? ''}`,
    )
    .join('|');
  const sensorKey = sensors.map((s) => `${s.id}:${s.unitId || ''}:${s.lastValue ?? ''}:${s.sku || ''}`).join('|');
  const geoKey = `${lat}|${lng}|${areaHa}|${siteSideM}|${structures.map((s) => s.id).join(',')}|${irrigation.map((i) => i.id).join(',')}`;

  useEffect(() => {
    if (hasOsmPin) return;
    const host = hostRef.current;
    if (!host || parcels.length === 0) return;
    let cleanup = () => {};
    let cancelled = false;
    void import('@/components/radar/radar-world-scene').then((mod) => {
      if (cancelled || !hostRef.current) return;
      cleanup = mod.mountRadarWorld(hostRef.current, {
        moduleId,
        parcels,
        sensors,
        focusedId,
        onFocus: (id) => focusRef.current(id),
        lat: null,
        lng: null,
        areaHa,
        siteSideM,
        structures,
        irrigation,
      });
    });
    return () => {
      cancelled = true;
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasOsmPin, key, sensorKey, geoKey, moduleId, focusedId]);

  const tall = fill
    ? 'absolute inset-0 h-full min-h-0'
    : hero
      ? 'h-[calc(100dvh-11.5rem)] min-h-[560px]'
      : 'min-h-[280px] sm:min-h-[380px]';

  if (parcels.length === 0) {
    return (
      <div
        className={`flex items-center justify-center ${fill ? 'absolute inset-0 bg-[#0b1c18]' : `rounded-xl border border-white/10 bg-[#c5d4b8] ${tall}`}`}
      >
        <p className={`max-w-sm px-4 text-center text-sm ${fill ? 'text-white/60' : 'text-slate-600'}`}>
          {radarT(
            loc,
            'Ainda não há espaços — cria o primeiro.',
            'Aún no hay espacios — crea el primero.',
            'No spaces yet — create the first one.',
          )}
        </p>
      </div>
    );
  }

  if (hasOsmPin) {
    return (
      <RadarMapLibreTwin
        locale={locale}
        parcels={parcels}
        spaces={spaces.length > 0 ? spaces : parcelsAsSpaces(parcels)}
        focusedId={focusedId}
        onFocus={onFocus}
        lat={lat as number}
        lng={lng as number}
        areaHa={areaHa}
        siteSideM={siteSideM}
        structures={structures}
        irrigation={irrigation}
        fill={fill}
      />
    );
  }

  const showLocalPlantHint = mapPlacedCount === 0 || mapPlacedCount == null;

  return (
    <div className={fill ? 'absolute inset-0 overflow-hidden' : `relative overflow-hidden rounded-xl ${tall}`}>
      <div ref={hostRef} className="absolute inset-0" />
      {showLocalPlantHint && (
        <p className="pointer-events-none absolute left-1/2 top-3 z-[1] max-w-[min(28rem,92%)] -translate-x-1/2 rounded-full bg-black/70 px-3 py-1.5 text-center text-[11px] font-medium leading-snug text-white/90 shadow-lg ring-1 ring-white/15">
          {radarT(
            loc,
            'Sem pin no mapa — planta local 3D. Geolocaliza o lugar para o mapa 3D real.',
            'Sin pin en el mapa — planta local 3D. Geolocaliza el lugar para el mapa 3D real.',
            'No map pin yet — local 3D plant. Geolocate the place for the real 3D map.',
          )}
        </p>
      )}
      <p className="pointer-events-none absolute bottom-2 left-3 text-[10px] font-medium text-white/80 drop-shadow">
        {parcels.length} {radarT(loc, 'espaços', 'espacios', 'spaces')}
        {` · ${radarT(loc, 'planta local', 'planta local', 'local plant')}`}
      </p>
    </div>
  );
}

function parcelsAsSpaces(parcels: WorldParcel[]): RadarSpaceRect[] {
  return parcels
    .filter((p) => typeof p.x === 'number' && typeof p.y === 'number')
    .map((p) => ({
      id: p.id,
      x: p.x as number,
      y: p.y as number,
      w: p.w ?? 18,
      h: p.h ?? 14,
      rotation: p.rotation ?? 0,
      placed: true,
      widthM: p.widthM ?? null,
      lengthM: p.lengthM ?? null,
      spacingM: p.spacingM ?? null,
    }));
}
