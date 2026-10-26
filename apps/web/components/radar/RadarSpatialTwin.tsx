'use client';

import { useEffect, useRef } from 'react';
import { radarLoc, radarT } from '@/lib/radar/i18n';
import type { WorldParcel, WorldSensor } from '@/components/radar/radar-world-scene';
import type { RadarIrrigationPath, RadarSiteStructure } from '@/lib/radar/site-layout';

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
  /** How many parcels are geolocated on the OSM map (`placed=true`). Local plant still renders when 0. */
  mapPlacedCount?: number;
};

/** Mundo 3D da exploração: OSM no chão (se houver pin) + silhuetas por cultivo/dispositivo (planta local %). */
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
  mapPlacedCount,
}: Props) {
  const loc = radarLoc(locale);
  const hostRef = useRef<HTMLDivElement>(null);
  const focusRef = useRef(onFocus);
  focusRef.current = onFocus;

  const key = parcels
    .map(
      (p) =>
        `${p.id}:${p.moisture ?? ''}:${p.name}:${p.crop ?? ''}:${p.x ?? ''}:${p.y ?? ''}:${p.w ?? ''}:${p.h ?? ''}:${p.rotation ?? ''}:${p.widthM ?? ''}:${p.lengthM ?? ''}:${p.spacingM ?? ''}`,
    )
    .join('|');
  const sensorKey = sensors.map((s) => `${s.id}:${s.unitId || ''}:${s.lastValue ?? ''}:${s.sku || ''}`).join('|');
  const geoKey = `${lat}|${lng}|${areaHa}|${siteSideM}|${structures.map((s) => s.id).join(',')}|${irrigation.map((i) => i.id).join(',')}`;

  useEffect(() => {
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
        lat,
        lng,
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
  }, [key, sensorKey, geoKey, moduleId, focusedId]);

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

  const showLocalPlantHint = mapPlacedCount === 0;
  const hasOsmPin = lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng);

  return (
    <div className={fill ? 'absolute inset-0 overflow-hidden' : `relative overflow-hidden rounded-xl ${tall}`}>
      <div ref={hostRef} className="absolute inset-0" />
      {showLocalPlantHint && (
        <p className="pointer-events-none absolute left-1/2 top-3 z-[1] max-w-[min(28rem,92%)] -translate-x-1/2 rounded-full bg-black/70 px-3 py-1.5 text-center text-[11px] font-medium leading-snug text-white/90 shadow-lg ring-1 ring-white/15">
          {radarT(
            loc,
            'Estes espaços ainda não estão no mapa. Coloca-os ou vê a planta local em 3D.',
            'Estos espacios aún no están en el mapa. Colócalos o mira la planta local en 3D.',
            'These spaces are not on the map yet. Place them or view the local plant in 3D.',
          )}
        </p>
      )}
      <p className="pointer-events-none absolute bottom-2 left-3 text-[10px] font-medium text-white/80 drop-shadow">
        {parcels.length} {radarT(loc, 'espaços', 'espacios', 'spaces')}
        {showLocalPlantHint
          ? ` · ${radarT(loc, 'planta local', 'planta local', 'local plant')}`
          : hasOsmPin
            ? ' · © OpenStreetMap'
            : ` · ${radarT(loc, 'planta local', 'planta local', 'local plant')}`}
      </p>
    </div>
  );
}
