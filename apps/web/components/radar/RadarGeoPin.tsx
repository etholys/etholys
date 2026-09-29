'use client';

import { useState } from 'react';
import { Crosshair, Loader2, MapPin } from 'lucide-react';

type Loc = 'pt' | 'es' | 'en';

const COPY = {
  pt: {
    title: 'Geolocalizar',
    sub: 'Marca a propriedade no mapa. Coordenadas bastam — sem GIS completo.',
    lat: 'Latitude',
    lng: 'Longitude',
    here: 'Usar a minha localização',
    save: 'Guardar pin',
    open: 'Abrir no mapa',
  },
  es: {
    title: 'Geolocalizar',
    sub: 'Marcá la propiedad en el mapa. Con coordenadas alcanza — sin GIS completo.',
    lat: 'Latitud',
    lng: 'Longitud',
    here: 'Usar mi ubicación',
    save: 'Guardar pin',
    open: 'Abrir en el mapa',
  },
  en: {
    title: 'Geolocate',
    sub: 'Pin the property on the map. Coordinates are enough — no full GIS.',
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

  const parsedLat = Number(latStr);
  const parsedLng = Number(lngStr);
  const valid =
    Number.isFinite(parsedLat) &&
    Number.isFinite(parsedLng) &&
    Math.abs(parsedLat) <= 90 &&
    Math.abs(parsedLng) <= 180;

  const useHere = () => {
    if (!navigator.geolocation) {
      setErr(loc === 'en' ? 'Geolocation unavailable' : 'Geolocalização indisponível');
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
        setErr(loc === 'en' ? 'Could not read location' : 'Não foi possível ler a localização');
        setGeoBusy(false);
      },
      { enableHighAccuracy: true, timeout: 12000 }
    );
  };

  const delta = 0.04;
  const iframeSrc = valid
    ? `https://www.openstreetmap.org/export/embed.html?bbox=${parsedLng - delta}%2C${parsedLat - delta}%2C${parsedLng + delta}%2C${parsedLat + delta}&layer=mapnik&marker=${parsedLat}%2C${parsedLng}`
    : null;

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
        {valid && (
          <a
            href={`https://www.openstreetmap.org/?mlat=${parsedLat}&mlon=${parsedLng}#map=14/${parsedLat}/${parsedLng}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center rounded-2xl border border-white/15 px-4 py-2.5 text-sm text-white/70"
          >
            {copy.open}
          </a>
        )}
      </div>
      {/* OSM export/embed always paints a noisy attribution+donation bar inside the
          cross-origin iframe — clip it; we cannot set attributionControl on this embed. */}
      <div className="radar-geo-map relative h-64 overflow-hidden rounded-[1.35rem] border border-white/10 bg-black/40 sm:h-80">
        {iframeSrc ? (
          <iframe
            title="map"
            src={iframeSrc}
            className="absolute inset-x-0 top-0 h-[calc(100%+3.25rem)] w-full border-0"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-white/40">
            <MapPin className="mr-2 h-4 w-4" />
            {loc === 'en' ? 'Enter coordinates to preview' : 'Introduz coordenadas para pré-visualizar'}
          </div>
        )}
      </div>
    </div>
  );
}
