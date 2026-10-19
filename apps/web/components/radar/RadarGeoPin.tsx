'use client';

import { useEffect, useState } from 'react';
import { Crosshair, Loader2, MapPin } from 'lucide-react';

type Loc = 'pt' | 'es' | 'en';

const COPY = {
  pt: {
    title: 'Geolocalizar',
    sub: 'Clica no mapa ou usa a tua localização.',
    lat: 'Latitude',
    lng: 'Longitude',
    here: 'Usar a minha localização',
    save: 'Guardar pin',
    open: 'Abrir no mapa',
  },
  es: {
    title: 'Geolocalizar',
    sub: 'Clic en el mapa o usá tu ubicación.',
    lat: 'Latitud',
    lng: 'Longitud',
    here: 'Usar mi ubicación',
    save: 'Guardar pin',
    open: 'Abrir en el mapa',
  },
  en: {
    title: 'Geolocate',
    sub: 'Click the map or use your location.',
    lat: 'Latitude',
    lng: 'Longitude',
    here: 'Use my location',
    save: 'Save pin',
    open: 'Open map',
  },
} as const;

export function RadarGeoPin({
  locale,
  lat,
  lng,
  busy,
  onSave,
}: {
  locale: string;
  lat: number | null;
  lng: number | null;
  busy?: boolean;
  onSave: (lat: number, lng: number) => Promise<void>;
}) {
  const loc: Loc = locale === 'es' || locale === 'en' ? locale : 'pt';
  const copy = COPY[loc];
  const [latStr, setLatStr] = useState(lat != null ? String(lat) : '');
  const [lngStr, setLngStr] = useState(lng != null ? String(lng) : '');
  const [geoBusy, setGeoBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setLatStr(lat != null ? String(lat) : '');
    setLngStr(lng != null ? String(lng) : '');
  }, [lat, lng]);

  const parsedLat = Number(latStr);
  const parsedLng = Number(lngStr);
  const valid =
    Number.isFinite(parsedLat) &&
    Number.isFinite(parsedLng) &&
    Math.abs(parsedLat) <= 90 &&
    Math.abs(parsedLng) <= 180;

  const useHere = () => {
    if (!navigator.geolocation) {
      setErr(loc === 'en' ? 'Geolocation unavailable' : loc === 'es' ? 'Geolocalización no disponible' : 'Geolocalização indisponível');
      return;
    }
    setGeoBusy(true);
    setErr(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLatStr(String(Math.round(pos.coords.latitude * 1e6) / 1e6));
        setLngStr(String(Math.round(pos.coords.longitude * 1e6) / 1e6));
        setGeoBusy(false);
      },
      () => {
        setErr(loc === 'en' ? 'Could not read location' : loc === 'es' ? 'No se pudo leer la ubicación' : 'Não foi possível ler a localização');
        setGeoBusy(false);
      },
      { enableHighAccuracy: true, timeout: 12000 }
    );
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-serif text-2xl text-white">{copy.title}</h2>
        <p className="mt-1 text-sm text-white/55">{copy.sub}</p>
      </div>
      {err && <p className="text-sm text-rose-200">{err}</p>}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs uppercase tracking-wide text-white/45">{copy.lat}</span>
          <input
            value={latStr}
            onChange={(e) => setLatStr(e.target.value)}
            inputMode="decimal"
            className="mt-2 w-full rounded-2xl border border-white/15 bg-black/30 px-4 py-3 text-sm text-white outline-none focus:ring-2 focus:ring-emerald-400/40"
          />
        </label>
        <label className="block">
          <span className="text-xs uppercase tracking-wide text-white/45">{copy.lng}</span>
          <input
            value={lngStr}
            onChange={(e) => setLngStr(e.target.value)}
            inputMode="decimal"
            className="mt-2 w-full rounded-2xl border border-white/15 bg-black/30 px-4 py-3 text-sm text-white outline-none focus:ring-2 focus:ring-emerald-400/40"
          />
        </label>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={geoBusy}
          onClick={useHere}
          className="inline-flex items-center gap-2 rounded-2xl border border-white/15 px-4 py-2.5 text-sm text-white/80"
        >
          {geoBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Crosshair className="h-4 w-4" />}
          {copy.here}
        </button>
        <button
          type="button"
          disabled={!valid || busy}
          onClick={() => void onSave(parsedLat, parsedLng)}
          className="inline-flex items-center gap-2 rounded-2xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-[#04110c] disabled:opacity-40"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />}
          {copy.save}
        </button>
      </div>
    </div>
  );
}
