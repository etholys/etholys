import {
  emptyRadarLayout,
  parseRadarLayout,
  type RadarCrop,
  type RadarSiteLayoutDoc,
  type RadarSpaceRect,
} from '@/lib/radar/site-layout';
import { metersToPct } from '@/lib/radar/meters';
import type { DroneOrganizeProposal, DroneProposedSpace } from '@/lib/radar/drone/types';

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function spaceFromProposal(
  s: DroneProposedSpace,
  unitId: string,
  siteSideM: number | null,
): RadarSpaceRect {
  let w = s.w;
  let h = s.h;
  if (siteSideM && siteSideM > 0) {
    if (s.widthM != null && s.widthM > 0) w = metersToPct(s.widthM, siteSideM);
    if (s.lengthM != null && s.lengthM > 0) h = metersToPct(s.lengthM, siteSideM);
  }
  const x = Math.min(s.x, Math.max(0, 100 - w));
  const y = Math.min(s.y, Math.max(0, 100 - h));
  return {
    id: unitId,
    x: round1(x),
    y: round1(y),
    w: round1(Math.max(8, Math.min(w, 100 - x))),
    h: round1(Math.max(8, Math.min(h, 100 - y))),
    rotation: 0,
    placed: true,
    widthM: s.widthM,
    lengthM: s.lengthM,
    spacingM: null,
  };
}

function mergeCrops(existing: RadarCrop[], proposed: DroneOrganizeProposal['crops']): RadarCrop[] {
  const out = [...existing];
  const seen = new Set(out.map((c) => c.name.toLowerCase()));
  for (const c of proposed.crops) {
    const key = c.name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      id: `crop_${Date.now().toString(36)}_${out.length}`,
      name: c.name,
      variety: c.variety,
      season: c.season,
    });
  }
  for (const s of proposed.spaces) {
    if (!s.crop) continue;
    const key = s.crop.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      id: `crop_${Date.now().toString(36)}_${out.length}`,
      name: s.crop,
      variety: null,
      season: null,
    });
  }
  return out.slice(0, 80);
}

export type DroneMergePlanItem = {
  tempId: string;
  name: string;
  crop: string | null;
  widthM: number | null;
  lengthM: number | null;
  reuseUnitId: string | null;
  /** Set after unit create/reuse. */
  unitId?: string;
  rect: Omit<RadarSpaceRect, 'id'>;
};

/** Build merge plan from proposal + site scale (does not touch DB). */
export function buildDroneMergePlan(
  proposal: DroneOrganizeProposal,
  siteSideM: number | null,
): DroneMergePlanItem[] {
  return proposal.spaces.map((s) => {
    const full = spaceFromProposal(s, s.reuseUnitId || s.tempId, siteSideM);
    return {
      tempId: s.tempId,
      name: s.name,
      crop: s.crop,
      widthM: s.widthM,
      lengthM: s.lengthM,
      reuseUnitId: s.reuseUnitId || null,
      unitId: s.reuseUnitId || undefined,
      rect: {
        x: full.x,
        y: full.y,
        w: full.w,
        h: full.h,
        rotation: full.rotation,
        placed: full.placed,
        widthM: full.widthM,
        lengthM: full.lengthM,
        spacingM: full.spacingM,
      },
    };
  });
}

/**
 * Apply accepted drone spaces into layoutJson.
 * Preserves devices, commands, sensors, structures, irrigation.
 * Replaces/updates only the space footprints for the given unit ids; keeps other spaces.
 */
export function mergeDroneIntoLayout(
  existingRaw: unknown,
  proposal: DroneOrganizeProposal,
  unitIdByTempId: Map<string, string>,
  siteSideM: number | null,
): RadarSiteLayoutDoc {
  const base = parseRadarLayout(existingRaw) || emptyRadarLayout();
  const byId = new Map(base.spaces.map((s) => [s.id, s]));

  for (const s of proposal.spaces) {
    const unitId = unitIdByTempId.get(s.tempId);
    if (!unitId) continue;
    byId.set(unitId, spaceFromProposal(s, unitId, siteSideM ?? proposal.siteSideM));
  }

  const nextSide =
    siteSideM ??
    proposal.siteSideM ??
    base.siteSideM ??
    null;

  return {
    version: base.version,
    spaces: Array.from(byId.values()),
    sensors: base.sensors,
    crops: mergeCrops(base.crops || [], proposal),
    devices: base.devices || [],
    commands: base.commands || [],
    structures: base.structures || [],
    irrigation: base.irrigation || [],
    siteSideM: nextSide,
  };
}
