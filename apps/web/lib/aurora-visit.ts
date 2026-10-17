/** Distância e ponto-no-polígono da visita de ATER. Sem base de dados. */

export type GeoPoint = { lat: number; lng: number };

const EARTH_M = 6371000;

export function haversineMeters(a: GeoPoint, b: GeoPoint): number {
  const toRad = (n: number) => (n * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Raio em que o GPS do técnico conta como "na finca" quando só há um ponto. */
export const ONSITE_RADIUS_M = 250;

export function pointInPolygon(point: GeoPoint, polygon: GeoPoint[]): boolean {
  if (polygon.length < 3) return false;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const yi = polygon[i]!.lat;
    const xi = polygon[i]!.lng;
    const yj = polygon[j]!.lat;
    const xj = polygon[j]!.lng;
    const intersect = yi > point.lat !== yj > point.lat && point.lng < ((xj - xi) * (point.lat - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

export function parseGeoPoint(raw: unknown): GeoPoint | null {
  if (!raw || typeof raw !== 'object') return null;
  const lat = Number((raw as { lat?: unknown }).lat);
  const lng = Number((raw as { lng?: unknown }).lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
}

export function parsePolygon(raw: unknown): GeoPoint[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(parseGeoPoint).filter((p): p is GeoPoint => Boolean(p)).slice(0, 40);
}

export function visitPresence(input: {
  lat: number;
  lng: number;
  property: GeoPoint | null;
  polygon: GeoPoint[];
}): { onSite: boolean; distanceM: number | null } {
  const here = { lat: input.lat, lng: input.lng };
  if (input.polygon.length >= 3) {
    const onSite = pointInPolygon(here, input.polygon);
    const distanceM = input.property ? Math.round(haversineMeters(here, input.property)) : null;
    return { onSite, distanceM };
  }
  if (input.property) {
    const distanceM = Math.round(haversineMeters(here, input.property));
    return { onSite: distanceM <= ONSITE_RADIUS_M, distanceM };
  }
  return { onSite: false, distanceM: null };
}
