/** Lê o anel de um Shapefile (polígono) ou de um GeoJSON. Sem dependência extra. */

import JSZip from 'jszip';
import { parseGeoPoint, type GeoPoint } from './aurora-visit';

function u32(view: DataView, offset: number, little: boolean) {
  return view.getInt32(offset, little);
}

function f64(view: DataView, offset: number) {
  return view.getFloat64(offset, true);
}

export function parseShpPolygons(buf: Buffer | Uint8Array): GeoPoint[][] {
  const source = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  if (source.byteLength < 100) return [];
  const bytes = new Uint8Array(source.byteLength);
  bytes.set(source);
  const view = new DataView(bytes.buffer);
  const code = u32(view, 0, false);
  if (code !== 9994) return [];
  const fileWords = u32(view, 24, false);
  const fileBytes = Math.min(bytes.byteLength, fileWords * 2);
  const shapeType = u32(view, 32, true);
  if (shapeType !== 5 && shapeType !== 15 && shapeType !== 25) return [];

  const rings: GeoPoint[][] = [];
  let offset = 100;
  while (offset + 12 <= fileBytes) {
    const contentWords = u32(view, offset + 4, false);
    const contentBytes = contentWords * 2;
    const start = offset + 8;
    const end = start + contentBytes;
    if (end > fileBytes || contentBytes < 44) break;
    const recType = u32(view, start, true);
    if (recType === 5 || recType === 15 || recType === 25) {
      const numParts = u32(view, start + 36, true);
      const numPoints = u32(view, start + 40, true);
      if (numParts > 0 && numParts < 100 && numPoints > 0 && numPoints < 20000) {
        const parts: number[] = [];
        let cursor = start + 44;
        for (let i = 0; i < numParts; i++) {
          parts.push(u32(view, cursor, true));
          cursor += 4;
        }
        const points: GeoPoint[] = [];
        for (let i = 0; i < numPoints; i++) {
          const lng = f64(view, cursor);
          const lat = f64(view, cursor + 8);
          cursor += 16;
          const p = parseGeoPoint({ lat, lng });
          if (p) points.push(p);
        }
        for (let i = 0; i < parts.length; i++) {
          const from = parts[i]!;
          const to = i + 1 < parts.length ? parts[i + 1]! : points.length;
          const ring = points.slice(from, to);
          if (ring.length >= 3) rings.push(ring);
        }
      }
    }
    offset = end;
  }
  return rings;
}

export function parseGeoJsonRings(text: string): GeoPoint[][] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return [];
  }
  const rings: GeoPoint[][] = [];
  const walk = (node: unknown) => {
    if (!node || typeof node !== 'object') return;
    const o = node as Record<string, unknown>;
    if (o.type === 'FeatureCollection' && Array.isArray(o.features)) {
      o.features.forEach(walk);
      return;
    }
    if (o.type === 'Feature') {
      walk(o.geometry);
      return;
    }
    if (o.type === 'Polygon' && Array.isArray(o.coordinates)) {
      const ring = (o.coordinates[0] as unknown[]) || [];
      pushRing(ring);
      return;
    }
    if (o.type === 'MultiPolygon' && Array.isArray(o.coordinates)) {
      for (const poly of o.coordinates) {
        if (Array.isArray(poly)) pushRing((poly[0] as unknown[]) || []);
      }
    }
  };
  const pushRing = (coords: unknown[]) => {
    const ring = coords
      .map((pair) => {
        if (!Array.isArray(pair) || pair.length < 2) return null;
        return parseGeoPoint({ lng: pair[0], lat: pair[1] });
      })
      .filter((p): p is GeoPoint => Boolean(p));
    if (ring.length >= 3) rings.push(ring);
  };
  walk(parsed);
  return rings.slice(0, 20);
}

export async function ringsFromUpload(fileName: string, bytes: Uint8Array): Promise<GeoPoint[][]> {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.json') || lower.endsWith('.geojson')) {
    return parseGeoJsonRings(new TextDecoder().decode(bytes));
  }
  if (lower.endsWith('.zip')) {
    const zip = await JSZip.loadAsync(bytes);
    const shp = Object.values(zip.files).find((f) => f.name.toLowerCase().endsWith('.shp') && !f.dir);
    const geo = Object.values(zip.files).find((f) => /\.geojson$|\.json$/i.test(f.name) && !f.dir);
    if (shp) return parseShpPolygons(await shp.async('uint8array'));
    if (geo) return parseGeoJsonRings(await geo.async('string'));
    return [];
  }
  if (lower.endsWith('.shp')) return parseShpPolygons(bytes);
  return [];
}
