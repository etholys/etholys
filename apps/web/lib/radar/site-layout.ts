/**
 * Planta 2D RADAR — layout durável dos espaços de medição.
 * Coordenadas em percentagem do canvas (0–100).
 */

export const RADAR_LAYOUT_VERSION = 1 as const;

export type RadarSpaceRect = {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
};

export type RadarSensorPin = {
  id: string;
  spaceId: string | null;
  /** Relativo ao espaço (0–100) quando spaceId está definido; senão absoluto no canvas. */
  x: number;
  y: number;
};

export type RadarSiteLayoutDoc = {
  version: typeof RADAR_LAYOUT_VERSION;
  spaces: RadarSpaceRect[];
  sensors: RadarSensorPin[];
};

const CLAMP = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

function num(v: unknown, fallback: number): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export function emptyRadarLayout(): RadarSiteLayoutDoc {
  return { version: RADAR_LAYOUT_VERSION, spaces: [], sensors: [] };
}

/** Grelha automática quando ainda não há layout guardado. */
export function autoLayoutSpaces(
  spaceIds: string[],
  existing?: RadarSpaceRect[] | null,
): RadarSpaceRect[] {
  const byId = new Map((existing || []).map((s) => [s.id, s]));
  const missing = spaceIds.filter((id) => !byId.has(id));
  const kept = spaceIds.map((id) => byId.get(id)).filter(Boolean) as RadarSpaceRect[];
  if (missing.length === 0) return kept;

  const n = spaceIds.length;
  const cols = Math.max(1, Math.ceil(Math.sqrt(n)));
  const rows = Math.max(1, Math.ceil(n / cols));
  const gap = 3;
  const cellW = (100 - gap * (cols + 1)) / cols;
  const cellH = (100 - gap * (rows + 1)) / rows;

  return spaceIds.map((id, i) => {
    const prev = byId.get(id);
    if (prev) return prev;
    const col = i % cols;
    const row = Math.floor(i / cols);
    return {
      id,
      x: Math.round((gap + col * (cellW + gap)) * 10) / 10,
      y: Math.round((gap + row * (cellH + gap)) * 10) / 10,
      w: Math.round(cellW * 10) / 10,
      h: Math.round(Math.max(18, cellH * 0.85) * 10) / 10,
    };
  });
}

export function parseRadarLayout(raw: unknown): RadarSiteLayoutDoc | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as { version?: unknown; spaces?: unknown; sensors?: unknown };
  if (!Array.isArray(row.spaces)) return null;
  const spaces: RadarSpaceRect[] = [];
  for (const s of row.spaces) {
    if (!s || typeof s !== 'object') continue;
    const r = s as Record<string, unknown>;
    const id = String(r.id || '').trim();
    if (!id) continue;
    spaces.push({
      id,
      x: CLAMP(num(r.x, 0), 0, 95),
      y: CLAMP(num(r.y, 0), 0, 95),
      w: CLAMP(num(r.w, 20), 8, 100),
      h: CLAMP(num(r.h, 20), 8, 100),
    });
  }
  const sensors: RadarSensorPin[] = [];
  if (Array.isArray(row.sensors)) {
    for (const s of row.sensors) {
      if (!s || typeof s !== 'object') continue;
      const r = s as Record<string, unknown>;
      const id = String(r.id || '').trim();
      if (!id) continue;
      const spaceId = r.spaceId == null || r.spaceId === '' ? null : String(r.spaceId);
      sensors.push({
        id,
        spaceId,
        x: CLAMP(num(r.x, 50), 0, 100),
        y: CLAMP(num(r.y, 50), 0, 100),
      });
    }
  }
  return { version: RADAR_LAYOUT_VERSION, spaces, sensors };
}

export function mergeLayoutWithSpaces(
  saved: RadarSiteLayoutDoc | null,
  spaceIds: string[],
  sensorIds: Array<{ id: string; spaceId: string | null }>,
): RadarSiteLayoutDoc {
  const spaces = autoLayoutSpaces(spaceIds, saved?.spaces);
  const knownSpaces = new Set(spaceIds);
  const sensorById = new Map((saved?.sensors || []).map((s) => [s.id, s]));
  const sensors: RadarSensorPin[] = sensorIds
    .filter((s) => !s.spaceId || knownSpaces.has(s.spaceId))
    .map((s, i) => {
      const prev = sensorById.get(s.id);
      if (prev) {
        return {
          id: s.id,
          spaceId: s.spaceId,
          x: prev.x,
          y: prev.y,
        };
      }
      // Default pin near center, slight offset per sensor
      const offset = (i % 5) * 8;
      return {
        id: s.id,
        spaceId: s.spaceId,
        x: 45 + (offset % 20),
        y: 40 + Math.floor(offset / 3),
      };
    });
  return { version: RADAR_LAYOUT_VERSION, spaces, sensors };
}

export function sanitizeLayoutPatch(
  body: unknown,
  allowedSpaceIds: Set<string>,
  allowedSensorIds: Set<string>,
): RadarSiteLayoutDoc | null {
  const parsed = parseRadarLayout(body);
  if (!parsed) return null;
  const spaces = parsed.spaces
    .filter((s) => allowedSpaceIds.has(s.id))
    .map((s) => ({
      ...s,
      x: CLAMP(s.x, 0, 92),
      y: CLAMP(s.y, 0, 92),
      w: CLAMP(s.w, 10, 100 - s.x),
      h: CLAMP(s.h, 10, 100 - s.y),
    }));
  const sensors = parsed.sensors
    .filter((s) => allowedSensorIds.has(s.id))
    .map((s) => ({
      id: s.id,
      spaceId: s.spaceId && allowedSpaceIds.has(s.spaceId) ? s.spaceId : null,
      x: CLAMP(s.x, 0, 100),
      y: CLAMP(s.y, 0, 100),
    }));
  return { version: RADAR_LAYOUT_VERSION, spaces, sensors };
}
