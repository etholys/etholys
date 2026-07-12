/** Geometría SVG del caracol — 30 segmentos anulares en espiral */

const TOTAL = 30;
const TURNS = 2.75;
const CX = 400;
const CY = 400;
const R_INNER_START = 42;
const R_OUTER_END = 248;
const SEG_GAP = 0.035;

export type SpiralSegmentGeom = {
  n: number;
  path: string;
  iconX: number;
  iconY: number;
  badgeX: number;
  badgeY: number;
  labelX: number;
  labelY: number;
};

function pt(r: number, angle: number) {
  return { x: CX + r * Math.cos(angle), y: CY + r * Math.sin(angle) };
}

function segmentPath(rInner0: number, rOuter0: number, rInner1: number, rOuter1: number, a0: number, a1: number) {
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

export function buildSpiralSegments(): SpiralSegmentGeom[] {
  const segments: SpiralSegmentGeom[] = [];

  for (let i = 0; i < TOTAL; i++) {
    const t0 = i / TOTAL;
    const t1 = (i + 1 - SEG_GAP) / TOTAL;

    const a0 = -Math.PI / 2 - t0 * TURNS * 2 * Math.PI;
    const a1 = -Math.PI / 2 - t1 * TURNS * 2 * Math.PI;

    const rInner0 = R_INNER_START + t0 * (R_OUTER_END - R_INNER_START);
    const rInner1 = R_INNER_START + t1 * (R_OUTER_END - R_INNER_START);
    const band = 44 + t0 * 12;
    const rOuter0 = rInner0 + band;
    const rOuter1 = rInner1 + band;

    const path = segmentPath(rInner0, rOuter0, rInner1, rOuter1, a0, a1);

    const midA = (a0 + a1) / 2;
    const midR = (rInner0 + rOuter0) / 2;
    const mid = pt(midR, midA);
    const badge = pt(rOuter0 - 8, midA);

    segments.push({
      n: i + 1,
      path,
      iconX: mid.x,
      iconY: mid.y - (i === 0 || i === 29 ? 6 : 0),
      badgeX: badge.x,
      badgeY: badge.y,
      labelX: mid.x,
      labelY: mid.y + 16,
    });
  }

  return segments;
}

/** ViewBox ajustado ao caracol — sem margem branca extra */
export function spiralContentBounds(margin = 6): { x: number; y: number; width: number; height: number } {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (let i = 0; i < TOTAL; i++) {
    const t0 = i / TOTAL;
    const t1 = (i + 1 - SEG_GAP) / TOTAL;
    const a0 = -Math.PI / 2 - t0 * TURNS * 2 * Math.PI;
    const a1 = -Math.PI / 2 - t1 * TURNS * 2 * Math.PI;
    const rInner0 = R_INNER_START + t0 * (R_OUTER_END - R_INNER_START);
    const rInner1 = R_INNER_START + t1 * (R_OUTER_END - R_INNER_START);
    const band0 = 44 + t0 * 12;
    const band1 = 44 + t1 * 12;
    const radii = [rInner0, rInner0 + band0, rInner1, rInner1 + band1];
    for (const r of radii) {
      for (const a of [a0, a1]) {
        const p = pt(r, a);
        minX = Math.min(minX, p.x);
        minY = Math.min(minY, p.y);
        maxX = Math.max(maxX, p.x);
        maxY = Math.max(maxY, p.y);
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
