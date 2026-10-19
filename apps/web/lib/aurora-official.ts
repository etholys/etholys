/**
 * Cruzamento da finca com FUNAI, unidades de conservação e desmate anual do PRODES (INPE).
 * O recorte legal do desmate é depois de 22/07/2008: o ano PRODES 2008 fica só na nota.
 */

import { ringsOverlap } from './aurora-intersect';
import type { GeoPoint } from './aurora-visit';

const FUNAI = 'https://geoserver.funai.gov.br/geoserver/ows';
const INPE = 'https://terrabrasilis.dpi.inpe.br/geoserver/ows';
const CUTOFF_YEAR = 2009;

type FetchLike = (url: string, init?: { signal?: AbortSignal }) => Promise<{ ok: boolean; json: () => Promise<unknown> }>;

export type LayerHit = { ok: boolean; hit: boolean; names: string[] };

export type OfficialCross = {
  checkedAt: string;
  indigenous: LayerHit;
  conservation: LayerHit;
  deforestation: LayerHit;
  summary: string;
};

function bboxOf(ring: GeoPoint[], pad = 0.01) {
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
  return `${minLng - pad},${minLat - pad},${maxLng + pad},${maxLat + pad}`;
}

export function ringsFromGeoJson(raw: unknown): Array<{ ring: GeoPoint[]; name: string; year: number | null }> {
  const root = raw && typeof raw === 'object' ? (raw as { features?: unknown }) : null;
  const features = Array.isArray(root?.features) ? root.features : [];
  const out: Array<{ ring: GeoPoint[]; name: string; year: number | null }> = [];
  for (const feature of features.slice(0, 25)) {
    if (!feature || typeof feature !== 'object') continue;
    const props = (feature as { properties?: Record<string, unknown> }).properties || {};
    const name = String(props.terrai_nom || props.nome || props.class_name || props.name || '').slice(0, 80);
    const year = Number(props.year);
    const geom = (feature as { geometry?: { type?: string; coordinates?: unknown } }).geometry;
    const rings = geometryRings(geom?.type, geom?.coordinates);
    for (const ring of rings) out.push({ ring, name, year: Number.isFinite(year) ? year : null });
  }
  return out;
}

function geometryRings(type: string | undefined, coordinates: unknown): GeoPoint[][] {
  if (type === 'Polygon' && Array.isArray(coordinates)) return [linearRing(coordinates[0])].filter((r) => r.length >= 3);
  if (type === 'MultiPolygon' && Array.isArray(coordinates)) {
    return coordinates
      .map((poly) => (Array.isArray(poly) ? linearRing(poly[0]) : []))
      .filter((r) => r.length >= 3);
  }
  return [];
}

function linearRing(raw: unknown): GeoPoint[] {
  if (!Array.isArray(raw)) return [];
  const ring: GeoPoint[] = [];
  for (const pair of raw) {
    if (!Array.isArray(pair) || pair.length < 2) continue;
    const lng = Number(pair[0]);
    const lat = Number(pair[1]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    ring.push({ lat, lng });
    if (ring.length >= 800) break;
  }
  return ring;
}

function wfsUrl(base: string, typeName: string, bbox: string) {
  const q = new URLSearchParams({
    service: 'WFS',
    version: '1.0.0',
    request: 'GetFeature',
    typeName,
    outputFormat: 'application/json',
    maxFeatures: '25',
    bbox,
  });
  return `${base}?${q.toString()}`;
}

async function loadLayer(fetchImpl: FetchLike, url: string): Promise<{ ok: boolean; features: ReturnType<typeof ringsFromGeoJson> }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 12000);
  try {
    const res = await fetchImpl(url, { signal: ctrl.signal });
    if (!res.ok) return { ok: false, features: [] };
    return { ok: true, features: ringsFromGeoJson(await res.json()) };
  } catch {
    return { ok: false, features: [] };
  } finally {
    clearTimeout(timer);
  }
}

function matchLayer(
  farm: GeoPoint[],
  features: Array<{ ring: GeoPoint[]; name: string; year: number | null }>,
  yearAtLeast: number | null,
): LayerHit {
  const names: string[] = [];
  for (const feature of features) {
    if (yearAtLeast != null && (feature.year == null || feature.year < yearAtLeast)) continue;
    if (!ringsOverlap(farm, feature.ring)) continue;
    if (feature.name && !names.includes(feature.name)) names.push(feature.name);
    if (!feature.name && !names.includes('sobreposição')) names.push('sobreposição');
  }
  return { ok: true, hit: names.length > 0, names: names.slice(0, 3) };
}

export async function crossOfficialLayers(input: { uf: string; ring: GeoPoint[] }, fetchImpl: FetchLike = fetch): Promise<OfficialCross> {
  const bbox = bboxOf(input.ring);
  const uf = input.uf.toUpperCase();
  const lossLayer = uf === 'BA' ? 'prodes-mata-atlantica-nb:yearly_deforestation' : 'prodes-legal-amz:yearly_deforestation';
  const unitLayer = uf === 'BA' ? 'prodes-mata-atlantica-nb:conservation_units_mata_atlantica_biome' : 'prodes-legal-amz:conservation_units_legal_amazon';
  const [indigenous, units, loss] = await Promise.all([
    loadLayer(fetchImpl, wfsUrl(FUNAI, 'Funai:tis_poligonais', bbox)),
    loadLayer(fetchImpl, wfsUrl(INPE, unitLayer, bbox)),
    loadLayer(fetchImpl, wfsUrl(INPE, lossLayer, bbox)),
  ]);
  const indigenousHit = indigenous.ok ? matchLayer(input.ring, indigenous.features, null) : { ok: false, hit: false, names: [] };
  const unitHit = units.ok ? matchLayer(input.ring, units.features, null) : { ok: false, hit: false, names: [] };
  const lossHit = loss.ok ? matchLayer(input.ring, loss.features, CUTOFF_YEAR) : { ok: false, hit: false, names: [] };
  const year2008 = loss.ok && loss.features.some((f) => f.year === 2008 && ringsOverlap(input.ring, f.ring));
  const parts = [
    indigenousHit.ok ? (indigenousHit.hit ? `FUNAI: ${indigenousHit.names.join(', ')}` : 'FUNAI: sem sobreposição') : 'FUNAI: indisponível',
    unitHit.ok ? (unitHit.hit ? `UC: ${unitHit.names.join(', ')}` : 'UC: sem sobreposição') : 'UC: indisponível',
    lossHit.ok ? (lossHit.hit ? `PRODES após 2008: ${lossHit.names.join(', ')}` : 'PRODES após 2008: sem sobreposição') : 'PRODES: indisponível',
  ];
  if (year2008) parts.push('PRODES 2008: conferir a data da cena (corte legal 22/07).');
  return {
    checkedAt: new Date().toISOString(),
    indigenous: indigenousHit,
    conservation: unitHit,
    deforestation: lossHit,
    summary: parts.join(' · ').slice(0, 500),
  };
}
