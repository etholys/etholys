import type { RadarModuleId } from '@/lib/etholys-products';
import { isRadarModuleId } from '@/lib/radar/space';
import { parseRadarLayout } from '@/lib/radar/site-layout';

export const PROPERTY_STEPS = ['characterize', 'draw', 'geolocate', 'sensors'] as const;
export type PropertyStepId = (typeof PROPERTY_STEPS)[number];

export type PropertyProgressInput = {
  moduleId?: string | null;
  crop?: string | null;
  areaHa?: number | null;
  layoutJson?: unknown;
  lat?: number | null;
  lng?: number | null;
  unitCount?: number;
  sensorCount?: number;
};

export type PropertyStepState = {
  id: PropertyStepId;
  done: boolean;
};

export function isCharacterized(input: PropertyProgressInput): boolean {
  return Boolean(input.moduleId && isRadarModuleId(String(input.moduleId)));
}

export function isPlantDrawn(input: PropertyProgressInput): boolean {
  const layout = parseRadarLayout(input.layoutJson);
  if (layout && layout.spaces.length > 0) return true;
  return (input.unitCount ?? 0) > 0;
}

export function isGeolocated(input: PropertyProgressInput): boolean {
  return (
    input.lat != null &&
    input.lng != null &&
    Number.isFinite(input.lat) &&
    Number.isFinite(input.lng) &&
    Math.abs(input.lat) <= 90 &&
    Math.abs(input.lng) <= 180
  );
}

export function hasSensors(input: PropertyProgressInput): boolean {
  return (input.sensorCount ?? 0) > 0;
}

export function buildPropertyProgress(input: PropertyProgressInput): PropertyStepState[] {
  return [
    { id: 'characterize', done: isCharacterized(input) },
    { id: 'draw', done: isPlantDrawn(input) },
    { id: 'geolocate', done: isGeolocated(input) },
    { id: 'sensors', done: hasSensors(input) },
  ];
}

export function nextIncompleteStep(input: PropertyProgressInput): PropertyStepId {
  const steps = buildPropertyProgress(input);
  return steps.find((s) => !s.done)?.id ?? 'sensors';
}

export function progressPercent(input: PropertyProgressInput): number {
  const steps = buildPropertyProgress(input);
  const done = steps.filter((s) => s.done).length;
  return Math.round((done / steps.length) * 100);
}

export function clampCoord(lat: number, lng: number): { lat: number; lng: number } | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat: Math.round(lat * 1e6) / 1e6, lng: Math.round(lng * 1e6) / 1e6 };
}

export function normalizeModuleId(raw: unknown): RadarModuleId | null {
  const v = String(raw || '').trim();
  return isRadarModuleId(v) ? v : null;
}

export const PROPERTY_STEP_COPY = {
  characterize: {
    pt: { label: 'Caracterizar', hint: 'Tipo, cultura e área' },
    es: { label: 'Caracterizar', hint: 'Tipo, cultivo y área' },
    en: { label: 'Characterize', hint: 'Type, crop and area' },
  },
  draw: {
    pt: { label: 'Desenhar planta', hint: 'Espaços no mapa 2D' },
    es: { label: 'Dibujar planta', hint: 'Espacios en el mapa 2D' },
    en: { label: 'Draw plant', hint: 'Spaces on the 2D map' },
  },
  geolocate: {
    pt: { label: 'Geolocalizar', hint: 'Pin no mapa' },
    es: { label: 'Geolocalizar', hint: 'Pin en el mapa' },
    en: { label: 'Geolocate', hint: 'Map pin' },
  },
  sensors: {
    pt: { label: 'Conectar sensores', hint: 'Token de ingest' },
    es: { label: 'Conectar sensores', hint: 'Token de ingest' },
    en: { label: 'Connect sensors', hint: 'Ingest token' },
  },
} as const;
