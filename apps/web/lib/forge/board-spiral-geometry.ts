/** Geometría SVG del caracol — 30 casillas (01 centro + 29 segmentos espirales) */

const TOTAL = 30;
const SPIRAL_SEGMENTS = TOTAL - 1; // casillas 02–30
const TURNS = 2.5;
const CX = 400;
const CY = 400;
const R_CENTER = 36;
const R_SPIRAL_START = 46;
const R_OUTER_END = 252;
const BAND_WIDTH = 52;
const SEG_GAP = 0.032;
const BADGE_INSET = 13;

export type SpiralSegmentGeom = {
  n: number;
  path: string;
  iconX: number;
  iconY: number;
  badgeX: number;
  badgeY: number;
  labelX: number;
  labelY: number;
  isCenter?: boolean;
};

function pt(r: number, angle: number) {
  return { x: CX + r * Math.cos(angle), y: CY + r * Math.sin(angle) };
}

function circlePath(cx: number, cy: number, r: number) {
  return [
    `M ${cx} ${cy - r}`,
    `A ${r} ${r} 0 1 1 ${cx - 0.01} ${cy - r}`,
    'Z',
  ].join(' ');
}

function segmentPath(
  rInner0: number,
  rOuter0: number,
  rInner1: number,
  rOuter1: number,
  a0: number,
  a1: number
) {
  const p0in = pt(rInner0, a0);
  const p0out = pt(rOuter0, a0);
  const p1out = pt(rOuter1, a1);
  const p1in = pt(rInner1, a1);
  const large = Math.abs(a1 - a0) > Math.PI ? 1 : 0;
  const sweep = a1 < a0 ? 0 : 1;
  return [
    `M ${p0in.x.toFixed(2)} ${p0in.y.toFixed(2)}`,
    `L ${p0out.x.toFixed(2)} ${p0out.y.toFixed(2)}`,
    `A ${rOuter1.toFixed(2)} ${rOuter1.toFixed(2)} 0 ${large} ${sweep} ${p1out.x.toFixed(2)} ${p1out.y.toFixed(2)}`,
    `L ${p1in.x.toFixed(2)} ${p1in.y.toFixed(2)}`,
    `A ${rInner0.toFixed(2)} ${rInner0.toFixed(2)} 0 ${large} ${sweep === 1 ? 0 : 1} ${p0in.x.toFixed(2)} ${p0in.y.toFixed(2)}`,
    'Z',
  ].join(' ');
}

function buildCenterTile(): SpiralSegmentGeom {
  return {
    n: 1,
    path: circlePath(CX, CY, R_CENTER),
    iconX: CX,
    iconY: CY - 10,
    badgeX: CX + R_CENTER + 2,
    badgeY: CY,
    labelX: CX,
    labelY: CY + 10,
    isCenter: true,
  };
}

function buildSpiralSegment(i: number): SpiralSegmentGeom {
  const n = i + 2;
  const t0 = i / SPIRAL_SEGMENTS;
  const t1 = (i + 1 - SEG_GAP) / SPIRAL_SEGMENTS;

  const a0 = -Math.PI / 2 - t0 * TURNS * 2 * Math.PI;
  const a1 = -Math.PI / 2 - t1 * TURNS * 2 * Math.PI;

  const rInner0 = R_SPIRAL_START + t0 * (R_OUTER_END - R_SPIRAL_START);
  const rInner1 = R_SPIRAL_START + t1 * (R_OUTER_END - R_SPIRAL_START);
  const rOuter0 = rInner0 + BAND_WIDTH;
  const rOuter1 = rInner1 + BAND_WIDTH;

  const path = segmentPath(rInner0, rOuter0, rInner1, rOuter1, a0, a1);

  const midA = (a0 + a1) / 2;
  const rInnerMid = (rInner0 + rInner1) / 2;
  const iconR = rInnerMid + BAND_WIDTH * 0.52;

  const icon = pt(iconR, midA);
  const isLast = n === TOTAL;

  // Badge on inner border (closer to spiral centre)
  const badgeR = rInnerMid + BADGE_INSET;
  const badgeA = isLast ? a1 + 0.04 : midA;
  const badge = pt(badgeR, badgeA);

  return {
    n,
    path,
    iconX: icon.x,
    iconY: icon.y - (isLast ? 8 : 0),
    badgeX: badge.x,
    badgeY: badge.y,
    labelX: icon.x,
    labelY: icon.y + (isLast ? 10 : 0),
  };
}

export function buildSpiralSegments(): SpiralSegmentGeom[] {
  const segments: SpiralSegmentGeom[] = [buildCenterTile()];
  for (let i = 0; i < SPIRAL_SEGMENTS; i++) {
    segments.push(buildSpiralSegment(i));
  }
  return segments;
}

/** ViewBox ajustado ao caracol — sem margem branca extra */
export function spiralContentBounds(margin = 8): { x: number; y: number; width: number; height: number } {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  const expand = (x: number, y: number) => {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  };

  expand(CX - R_CENTER, CY - R_CENTER);
  expand(CX + R_CENTER, CY + R_CENTER);

  for (let i = 0; i < SPIRAL_SEGMENTS; i++) {
    const t0 = i / SPIRAL_SEGMENTS;
    const t1 = (i + 1 - SEG_GAP) / SPIRAL_SEGMENTS;
    const a0 = -Math.PI / 2 - t0 * TURNS * 2 * Math.PI;
    const a1 = -Math.PI / 2 - t1 * TURNS * 2 * Math.PI;
    const rInner0 = R_SPIRAL_START + t0 * (R_OUTER_END - R_SPIRAL_START);
    const rInner1 = R_SPIRAL_START + t1 * (R_OUTER_END - R_SPIRAL_START);
    const radii = [rInner0, rInner0 + BAND_WIDTH, rInner1, rInner1 + BAND_WIDTH];
    for (const r of radii) {
      for (const a of [a0, a1]) {
        const p = pt(r, a);
        expand(p.x, p.y);
      }
    }
  }

  return {
    x: minX - margin,
    y: minY - margin,
    width: maxX - minX + margin * 2,
    height: maxY - minY + margin * 2,
  };
}

export function spiralViewBoxString(): string {
  const b = spiralContentBounds();
  return `${b.x} ${b.y} ${b.width} ${b.height}`;
}

export const SPIRAL_VIEWBOX = { width: 800, height: 800, cx: CX, cy: CY };
