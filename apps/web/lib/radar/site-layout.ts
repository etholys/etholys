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
  /** Degrees counterclockwise when north is up. Omitted means 0. */
  rotation?: number;
  /** On the geo map only when the user placed this space. Auto-grid slots stay false. */
  placed?: boolean;
  /** Real-world footprint in meters (optional; % layout still drives plant). */
  widthM?: number | null;
  lengthM?: number | null;
  /** Plant spacing inside the space, meters. */
  spacingM?: number | null;
};

export const RADAR_STRUCTURE_KINDS = ['shed', 'greenhouse', 'path', 'irrigation_line'] as const;
export type RadarStructureKind = (typeof RADAR_STRUCTURE_KINDS)[number];

/** Lightweight site structure — not CAD; lives in layoutJson. */
export type RadarSiteStructure = {
  id: string;
  kind: RadarStructureKind;
  x: number;
  y: number;
  w: number;
  h: number;
  rotation?: number;
  lengthM?: number | null;
  widthM?: number | null;
  heightM?: number | null;
  label?: string | null;
};

/** Irrigation polyline in site % coords. */
export type RadarIrrigationPath = {
  id: string;
  points: Array<{ x: number; y: number }>;
  label?: string | null;
};

export type RadarSensorPin = {
  id: string;
  spaceId: string | null;
  /** Relativo ao espaço (0–100) quando spaceId está definido; senão absoluto no canvas. */
  x: number;
  y: number;
};

export type RadarCrop = {
  id: string;
  name: string;
  variety: string | null;
  season: string | null;
};

export type RadarDeviceBinding = {
  sensorId: string;
  sku: string;
  devEui: string | null;
  unitId: string | null;
};

export type RadarValveCommand = {
  id: string;
  sensorId: string;
  devEui: string | null;
  unitId: string | null;
  action: 'open' | 'close';
  status: 'pending' | 'acked';
  at: string;
};

export type RadarSiteLayoutDoc = {
  version: typeof RADAR_LAYOUT_VERSION;
  spaces: RadarSpaceRect[];
  sensors: RadarSensorPin[];
  /** Cultivos da propriedade — persistidos com a planta (sem migration). */
  crops?: RadarCrop[];
  /** Hardware kit ligado a esta propriedade (DevEUI → sensor). */
  devices?: RadarDeviceBinding[];
  /** Fila de downlink da válvula, consumida pelo gateway. */
  commands?: RadarValveCommand[];
  /** Shed / greenhouse / path / irrigation_line — MVP structures. */
  structures?: RadarSiteStructure[];
  /** Irrigation polylines on the property. */
  irrigation?: RadarIrrigationPath[];
  /** Property outline side in meters when areaHa is unknown (optional override). */
  siteSideM?: number | null;
};

export function parseCrops(raw: unknown): RadarCrop[] {
  if (!Array.isArray(raw)) return [];
  const out: RadarCrop[] = [];
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue;
    const r = row as Record<string, unknown>;
    const id = String(r.id || '').trim();
    const name = String(r.name || '').trim();
    if (!id || name.length < 2) continue;
    out.push({
      id,
      name: name.slice(0, 80),
      variety: String(r.variety || '').trim().slice(0, 80) || null,
      season: String(r.season || '').trim().slice(0, 80) || null,
    });
  }
  return out;
}

export function cropsFromLayout(layout: RadarSiteLayoutDoc | null | undefined): RadarCrop[] {
  return parseCrops(layout?.crops);
}

export function parseDevices(raw: unknown): RadarDeviceBinding[] {
  if (!Array.isArray(raw)) return [];
  const out: RadarDeviceBinding[] = [];
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue;
    const r = row as Record<string, unknown>;
    const sensorId = String(r.sensorId || '').trim();
    const sku = String(r.sku || '').trim();
    if (!sensorId || !sku) continue;
    const dev = String(r.devEui || '').replace(/[^0-9a-fA-F]/g, '').toUpperCase();
    out.push({
      sensorId,
      sku: sku.slice(0, 32),
      devEui: dev.length >= 8 ? dev.slice(0, 16) : null,
      unitId: r.unitId == null || r.unitId === '' ? null : String(r.unitId),
    });
  }
  return out;
}

export function parseCommands(raw: unknown): RadarValveCommand[] {
  if (!Array.isArray(raw)) return [];
  const out: RadarValveCommand[] = [];
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue;
    const r = row as Record<string, unknown>;
    const id = String(r.id || '').trim();
    const sensorId = String(r.sensorId || '').trim();
    const action = r.action === 'close' ? 'close' : r.action === 'open' ? 'open' : null;
    if (!id || !sensorId || !action) continue;
    out.push({
      id: id.slice(0, 40),
      sensorId,
      devEui: r.devEui == null ? null : String(r.devEui).slice(0, 16),
      unitId: r.unitId == null || r.unitId === '' ? null : String(r.unitId),
      action,
      status: r.status === 'acked' ? 'acked' : 'pending',
      at: String(r.at || new Date().toISOString()).slice(0, 40),
    });
  }
  return out.slice(-40);
}

export function withCrops(layout: RadarSiteLayoutDoc, crops: RadarCrop[]): RadarSiteLayoutDoc {
  return { ...layout, crops };
}

const CLAMP = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

function num(v: unknown, fallback: number): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function optPositiveM(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100) / 100;
}

function isStructureKind(v: unknown): v is RadarStructureKind {
  return typeof v === 'string' && (RADAR_STRUCTURE_KINDS as readonly string[]).includes(v);
}

export function parseStructures(raw: unknown): RadarSiteStructure[] {
  if (!Array.isArray(raw)) return [];
  const out: RadarSiteStructure[] = [];
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue;
    const r = row as Record<string, unknown>;
    const id = String(r.id || '').trim();
    if (!id || !isStructureKind(r.kind)) continue;
    out.push({
      id: id.slice(0, 40),
      kind: r.kind,
      x: CLAMP(num(r.x, 10), 0, 95),
      y: CLAMP(num(r.y, 10), 0, 95),
      w: CLAMP(num(r.w, 12), 2, 100),
      h: CLAMP(num(r.h, 8), 2, 100),
      rotation: normRotation(r.rotation),
      lengthM: optPositiveM(r.lengthM),
      widthM: optPositiveM(r.widthM),
      heightM: optPositiveM(r.heightM),
      label: String(r.label || '').trim().slice(0, 80) || null,
    });
  }
  return out.slice(0, 40);
}

export function parseIrrigation(raw: unknown): RadarIrrigationPath[] {
  if (!Array.isArray(raw)) return [];
  const out: RadarIrrigationPath[] = [];
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue;
    const r = row as Record<string, unknown>;
    const id = String(r.id || '').trim();
    if (!id || !Array.isArray(r.points) || r.points.length < 2) continue;
    const points: Array<{ x: number; y: number }> = [];
    for (const p of r.points) {
      if (!p || typeof p !== 'object') continue;
      const pt = p as Record<string, unknown>;
      points.push({ x: CLAMP(num(pt.x, 50), 0, 100), y: CLAMP(num(pt.y, 50), 0, 100) });
    }
    if (points.length < 2) continue;
    out.push({
      id: id.slice(0, 40),
      points: points.slice(0, 40),
      label: String(r.label || '').trim().slice(0, 80) || null,
    });
  }
  return out.slice(0, 20);
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** Wrap any angle into [0, 360). */
export function normRotation(v: unknown): number {
  const n = num(v, 0);
  const wrapped = ((n % 360) + 360) % 360;
  return round1(wrapped);
}

export function emptyRadarLayout(): RadarSiteLayoutDoc {
  return {
    version: RADAR_LAYOUT_VERSION,
    spaces: [],
    sensors: [],
    crops: [],
    structures: [],
    irrigation: [],
    siteSideM: null,
  };
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
    if (prev) {
      return {
        ...prev,
        rotation: normRotation(prev.rotation),
        placed: prev.placed === true,
        widthM: prev.widthM ?? null,
        lengthM: prev.lengthM ?? null,
        spacingM: prev.spacingM ?? null,
      };
    }
    const col = i % cols;
    const row = Math.floor(i / cols);
    return {
      id,
      x: Math.round((gap + col * (cellW + gap)) * 10) / 10,
      y: Math.round((gap + row * (cellH + gap)) * 10) / 10,
      w: Math.round(cellW * 10) / 10,
      h: Math.round(Math.max(18, cellH * 0.85) * 10) / 10,
      rotation: 0,
      placed: false,
    };
  });
}

export function parseRadarLayout(raw: unknown): RadarSiteLayoutDoc | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as {
    version?: unknown;
    spaces?: unknown;
    sensors?: unknown;
    crops?: unknown;
    devices?: unknown;
    commands?: unknown;
    structures?: unknown;
    irrigation?: unknown;
    siteSideM?: unknown;
  };
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
      rotation: normRotation(r.rotation),
      placed: r.placed === true,
      widthM: optPositiveM(r.widthM),
      lengthM: optPositiveM(r.lengthM),
      spacingM: optPositiveM(r.spacingM),
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
  return {
    version: RADAR_LAYOUT_VERSION,
    spaces,
    sensors,
    crops: parseCrops(row.crops),
    devices: parseDevices(row.devices),
    commands: parseCommands(row.commands),
    structures: parseStructures(row.structures),
    irrigation: parseIrrigation(row.irrigation),
    siteSideM: optPositiveM(row.siteSideM),
  };
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
  return {
    version: RADAR_LAYOUT_VERSION,
    spaces,
    sensors,
    crops: cropsFromLayout(saved),
    devices: saved?.devices || [],
    commands: saved?.commands || [],
    structures: saved?.structures || [],
    irrigation: saved?.irrigation || [],
    siteSideM: saved?.siteSideM ?? null,
  };
}

export function sanitizeLayoutPatch(
  body: unknown,
  allowedSpaceIds: Set<string>,
  allowedSensorIds: Set<string>,
): RadarSiteLayoutDoc | null {
  const parsed = parseRadarLayout(body);
  if (!parsed) return null;
  const bodyObj = body as {
    crops?: unknown;
    devices?: unknown;
    commands?: unknown;
    structures?: unknown;
    irrigation?: unknown;
    siteSideM?: unknown;
  };
  const spaces = parsed.spaces
    .filter((s) => allowedSpaceIds.has(s.id))
    .map((s) => ({
      id: s.id,
      x: CLAMP(s.x, 0, 92),
      y: CLAMP(s.y, 0, 92),
      w: CLAMP(s.w, 10, 100 - s.x),
      h: CLAMP(s.h, 10, 100 - s.y),
      rotation: normRotation(s.rotation),
      placed: s.placed === true,
      widthM: s.widthM ?? null,
      lengthM: s.lengthM ?? null,
      spacingM: s.spacingM ?? null,
    }));
  const sensors = parsed.sensors
    .filter((s) => allowedSensorIds.has(s.id))
    .map((s) => ({
      id: s.id,
      spaceId: s.spaceId && allowedSpaceIds.has(s.spaceId) ? s.spaceId : null,
      x: CLAMP(s.x, 0, 100),
      y: CLAMP(s.y, 0, 100),
    }));
  return {
    version: RADAR_LAYOUT_VERSION,
    spaces,
    sensors,
    crops: parseCrops(bodyObj.crops ?? parsed.crops),
    devices: parseDevices(bodyObj.devices ?? parsed.devices),
    commands: parseCommands(bodyObj.commands ?? parsed.commands),
    structures: parseStructures(bodyObj.structures ?? parsed.structures),
    irrigation: parseIrrigation(bodyObj.irrigation ?? parsed.irrigation),
    siteSideM: optPositiveM(bodyObj.siteSideM ?? parsed.siteSideM),
  };
}

function upsertSpace(layout: RadarSiteLayoutDoc, next: RadarSpaceRect): RadarSiteLayoutDoc {
  const exists = layout.spaces.some((s) => s.id === next.id);
  return {
    ...layout,
    spaces: exists ? layout.spaces.map((s) => (s.id === next.id ? next : s)) : [...layout.spaces, next],
  };
}

/** Drop a footprint on the site square. Does not create or remove the unit. */
export function placeSpace(
  layout: RadarSiteLayoutDoc,
  id: string,
  centerX: number,
  centerY: number,
): RadarSiteLayoutDoc {
  const prev = layout.spaces.find((s) => s.id === id);
  const w = prev && prev.w >= 10 ? prev.w : 18;
  const h = prev && prev.h >= 10 ? prev.h : 14;
  const x = CLAMP(centerX - w / 2, 0, Math.max(0, 100 - w));
  const y = CLAMP(centerY - h / 2, 0, Math.max(0, 100 - h));
  return upsertSpace(layout, {
    id,
    x: round1(x),
    y: round1(y),
    w: round1(w),
    h: round1(h),
    rotation: normRotation(prev?.rotation),
    placed: true,
  });
}

/** Move a placed footprint so its center sits at the given site percent. */
export function moveSpace(
  layout: RadarSiteLayoutDoc,
  id: string,
  centerX: number,
  centerY: number,
): RadarSiteLayoutDoc {
  const prev = layout.spaces.find((s) => s.id === id);
  if (!prev || prev.placed !== true) return layout;
  const x = CLAMP(centerX - prev.w / 2, 0, Math.max(0, 100 - prev.w));
  const y = CLAMP(centerY - prev.h / 2, 0, Math.max(0, 100 - prev.h));
  return upsertSpace(layout, { ...prev, x: round1(x), y: round1(y), placed: true });
}

export function rotateSpace(layout: RadarSiteLayoutDoc, id: string, deltaDeg = 15): RadarSiteLayoutDoc {
  const prev = layout.spaces.find((s) => s.id === id);
  if (!prev || prev.placed !== true) return layout;
  return upsertSpace(layout, { ...prev, rotation: normRotation((prev.rotation ?? 0) + deltaDeg) });
}

/** Remove the drawing. The database unit stays. */
export function unplaceSpace(layout: RadarSiteLayoutDoc, id: string): RadarSiteLayoutDoc {
  return {
    ...layout,
    spaces: layout.spaces.map((s) => (s.id === id ? { ...s, placed: false } : s)),
  };
}

/** Drop the space from the layout entirely (unit delete / list removal). */
export function removeSpaceFromLayout(layout: RadarSiteLayoutDoc, id: string): RadarSiteLayoutDoc {
  return {
    ...layout,
    spaces: layout.spaces.filter((s) => s.id !== id),
    sensors: layout.sensors.map((s) => (s.spaceId === id ? { ...s, spaceId: null } : s)),
    devices: (layout.devices || []).map((d) => (d.unitId === id ? { ...d, unitId: null } : d)),
  };
}
