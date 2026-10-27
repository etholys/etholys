/**
 * MapLibre styles for RADAR 3D.
 * Default: OSM raster (same commercial-safe source as 2D Leaflet).
 * Optional satellite: MapTiler hybrid only when NEXT_PUBLIC_MAPTILER_KEY is set.
 * Never use Esri World Imagery. Google photoreal 3D needs Maps JS + mapId (separate path).
 */

export type RadarMapBasemap = 'streets' | 'satellite';

export function radarMapTilerKey(): string | null {
  const k = process.env.NEXT_PUBLIC_MAPTILER_KEY?.trim();
  return k || null;
}

/** True when a license-OK satellite tile source can be used. */
export function radarSatelliteAvailable(): boolean {
  return Boolean(radarMapTilerKey());
}

type StyleSpec = {
  version: 8;
  name: string;
  sources: Record<string, unknown>;
  layers: Array<Record<string, unknown>>;
  glyphs?: string;
};

const OSM_ATTRIBUTION = '© OpenStreetMap contributors';

function osmStreetsStyle(): StyleSpec {
  return {
    version: 8,
    name: 'radar-osm',
    sources: {
      osm: {
        type: 'raster',
        tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
        tileSize: 256,
        attribution: OSM_ATTRIBUTION,
        maxzoom: 19,
      },
    },
    layers: [{ id: 'osm', type: 'raster', source: 'osm', minzoom: 0, maxzoom: 22 }],
    glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
  };
}

function mapTilerSatelliteStyle(key: string): StyleSpec {
  return {
    version: 8,
    name: 'radar-maptiler-satellite',
    sources: {
      sat: {
        type: 'raster',
        tiles: [`https://api.maptiler.com/maps/hybrid/{z}/{x}/{y}.jpg?key=${encodeURIComponent(key)}`],
        tileSize: 512,
        attribution: `© MapTiler · ${OSM_ATTRIBUTION}`,
        maxzoom: 20,
      },
    },
    layers: [{ id: 'sat', type: 'raster', source: 'sat', minzoom: 0, maxzoom: 22 }],
    glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
  };
}

export function radarMapLibreStyle(basemap: RadarMapBasemap): StyleSpec {
  if (basemap === 'satellite') {
    const mt = radarMapTilerKey();
    if (mt) return mapTilerSatelliteStyle(mt);
  }
  return osmStreetsStyle();
}
