'use client';

import { useEffect, useRef } from 'react';
import { radarLoc, radarT } from '@/lib/radar/i18n';
import type { WorldParcel, WorldSensor } from '@/components/radar/radar-world-scene';

type Props = {
  locale: string;
  moduleId?: string | null;
  parcels: WorldParcel[];
  sensors: WorldSensor[];
  focusedId: string | null;
  onFocus: (id: string) => void;
  hero?: boolean;
  /** Fill the parent map surface instead of a fixed card height. */
  fill?: boolean;
};

/** Mundo 3D da exploração: uma sala por espaço, sem tecto de zonas. */
export function RadarSpatialTwin({
  locale,
  moduleId,
  parcels,
  sensors,
  focusedId,
  onFocus,
  hero = false,
  fill = false,
}: Props) {
  const loc = radarLoc(locale);
  const hostRef = useRef<HTMLDivElement>(null);
  const focusRef = useRef(onFocus);
  focusRef.current = onFocus;

  const key = parcels
    .map((p) => `${p.id}:${p.moisture ?? ''}:${p.name}:${p.x ?? ''}:${p.y ?? ''}:${p.w ?? ''}:${p.h ?? ''}:${p.rotation ?? ''}`)
    .join('|');
  const sensorKey = sensors.map((s) => `${s.id}:${s.unitId || ''}:${s.lastValue ?? ''}`).join('|');

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
      });
    });
    return () => {
      cancelled = true;
      cleanup();
    };
    // Remount when the set of spaces or the selection changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, sensorKey, moduleId, focusedId]);

  const tall = fill
    ? 'absolute inset-0 h-full min-h-0'
    : hero
      ? 'h-[calc(100dvh-11.5rem)] min-h-[560px]'
      : 'min-h-[280px] sm:min-h-[380px]';

  if (parcels.length === 0) {
    return (
      <div className={`flex items-center justify-center ${fill ? 'absolute inset-0 bg-[#0b1c18]' : `rounded-xl border border-white/10 bg-[#c5d4b8] ${tall}`}`}>
        <p className={`text-sm ${fill ? 'text-white/60' : 'text-slate-600'}`}>
          {fill
            ? radarT(loc, 'Nenhum espaço colocado no mapa.', 'Ningún espacio colocado en el mapa.', 'No spaces placed on the map yet.')
            : radarT(loc, 'Ainda sem espaços na planta.', 'Aún sin espacios en la planta.', 'No spaces on the plant yet.')}
        </p>
      </div>
    );
  }

  return (
    <div className={fill ? 'absolute inset-0 overflow-hidden' : `relative overflow-hidden rounded-xl ${tall}`}>
      <div ref={hostRef} className="absolute inset-0" />
      <p className="pointer-events-none absolute bottom-2 left-3 text-[10px] font-medium text-slate-600/80">
        {parcels.length} {radarT(loc, 'espaços', 'espacios', 'spaces')}
      </p>
    </div>
  );
}
