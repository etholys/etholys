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
}: Props) {
  const loc = radarLoc(locale);
  const hostRef = useRef<HTMLDivElement>(null);
  const focusRef = useRef(onFocus);
  focusRef.current = onFocus;

  const key = parcels.map((p) => `${p.id}:${p.moisture ?? ''}:${p.name}`).join('|');
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

  const tall = hero ? 'min-h-[320px] sm:min-h-[440px] md:min-h-[520px]' : 'min-h-[280px] sm:min-h-[380px]';

  if (parcels.length === 0) {
    return (
      <div className={`flex items-center justify-center rounded-xl border border-white/10 bg-[#dbeafe] ${tall}`}>
        <p className="text-sm text-slate-600">
          {radarT(loc, 'Ainda sem espaços na planta.', 'Aún sin espacios en la planta.', 'No spaces on the plant yet.')}
        </p>
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden rounded-xl border border-slate-200/80 ${tall}`}>
      <div ref={hostRef} className="absolute inset-0" />
      <p className="pointer-events-none absolute bottom-2 left-3 text-[10px] font-medium text-slate-600/80">
        {parcels.length} {radarT(loc, 'espaços', 'espacios', 'spaces')}
      </p>
    </div>
  );
}
