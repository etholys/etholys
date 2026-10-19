/** Sobreposição de polígonos no aplicativo. O Postgres de produção não tem extensão espacial. */

import { pointInPolygon, type GeoPoint } from './aurora-visit';

const MAX_VERTS = 500;

export function simplifyRing(ring: GeoPoint[]): GeoPoint[] {
  if (ring.length <= MAX_VERTS) return ring;
  const step = Math.ceil(ring.length / MAX_VERTS);
  const out: GeoPoint[] = [];
  for (let i = 0; i < ring.length; i += step) out.push(ring[i]!);
  return out;
}

function bounds(ring: GeoPoint[]) {
  let minLat = 90;
  let maxLat = -90;
  let minLng = 180;
  let maxLng = -180;
  for (const p of ring) {
    minLat = Math.min(minLat, p.lat);
    maxLat = Math.max(maxLat, p.lat);
    minLng = Math.min(minLng, p.lng);
    maxLng = Math.max(maxLng, p.lng);
  }
  return { minLat, maxLat, minLng, maxLng };
}

function boundsMiss(a: ReturnType<typeof bounds>, b: ReturnType<typeof bounds>) {
  return a.maxLat < b.minLat || b.maxLat < a.minLat || a.maxLng < b.minLng || b.maxLng < a.minLng;
}

function orient(a: GeoPoint, b: GeoPoint, c: GeoPoint) {
  return (b.lng - a.lng) * (c.lat - a.lat) - (b.lat - a.lat) * (c.lng - a.lng);
}

function onSegment(a: GeoPoint, b: GeoPoint, p: GeoPoint) {
  const eps = 1e-9;
  return (
    p.lng >= Math.min(a.lng, b.lng) - eps &&
    p.lng <= Math.max(a.lng, b.lng) + eps &&
    p.lat >= Math.min(a.lat, b.lat) - eps &&
    p.lat <= Math.max(a.lat, b.lat) + eps
  );
}

function segmentsCross(a: GeoPoint, b: GeoPoint, c: GeoPoint, d: GeoPoint) {
  const o1 = orient(a, b, c);
  const o2 = orient(a, b, d);
  const o3 = orient(c, d, a);
  const o4 = orient(c, d, b);
  if (Math.abs(o1) < 1e-12 && onSegment(a, b, c)) return true;
  if (Math.abs(o2) < 1e-12 && onSegment(a, b, d)) return true;
  if (Math.abs(o3) < 1e-12 && onSegment(c, d, a)) return true;
  if (Math.abs(o4) < 1e-12 && onSegment(c, d, b)) return true;
  return o1 > 0 !== o2 > 0 && o3 > 0 !== o4 > 0;
}

export function ringsOverlap(left: GeoPoint[], right: GeoPoint[]): boolean {
  const a = simplifyRing(left);
  const b = simplifyRing(right);
  if (a.length < 3 || b.length < 3) return false;
  if (boundsMiss(bounds(a), bounds(b))) return false;
  if (a.some((p) => pointInPolygon(p, b))) return true;
  if (b.some((p) => pointInPolygon(p, a))) return true;
  for (let i = 0; i < a.length; i++) {
    const a2 = a[(i + 1) % a.length]!;
    for (let j = 0; j < b.length; j++) {
      if (segmentsCross(a[i]!, a2, b[j]!, b[(j + 1) % b.length]!)) return true;
    }
  }
  return false;
}

export function ringAround(point: GeoPoint, delta = 0.002): GeoPoint[] {
  return [
    { lat: point.lat - delta, lng: point.lng - delta },
    { lat: point.lat - delta, lng: point.lng + delta },
    { lat: point.lat + delta, lng: point.lng + delta },
    { lat: point.lat + delta, lng: point.lng - delta },
  ];
}
