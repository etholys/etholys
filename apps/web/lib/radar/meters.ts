/** RADAR real-world measurements — meters are the product unit. */

/** Side length of a square site from hectares. */
export function sideMetersFromHa(areaHa: number | null | undefined, fallback = 63.2): number {
  const ha = areaHa != null && Number.isFinite(areaHa) && areaHa > 0 ? areaHa : null;
  if (ha == null) return fallback;
  return Math.sqrt(ha * 10000);
}

export function haFromSideMeters(sideM: number): number {
  if (!Number.isFinite(sideM) || sideM <= 0) return 0.05;
  return Math.round(((sideM * sideM) / 10000) * 100) / 100;
}

/** Percent of site → meters along one axis. */
export function pctToMeters(pct: number, siteSideM: number): number {
  return (CLAMP(pct, 0, 100) / 100) * siteSideM;
}

export function metersToPct(meters: number, siteSideM: number): number {
  if (!Number.isFinite(siteSideM) || siteSideM <= 0) return 10;
  return CLAMP((meters / siteSideM) * 100, 1, 100);
}

const CLAMP = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

export function formatMeters(m: number | null | undefined, digits = 1): string {
  if (m == null || !Number.isFinite(m)) return '—';
  return `${m.toFixed(digits)} m`;
}
