/** Período de medición M&E — intervalo ISO guardado en `IndicatorMeasurement.period`. */

const ISO_RANGE = /^(\d{4}-\d{2}-\d{2})\/(\d{4}-\d{2}-\d{2})$/;

export function encodeMeasurementPeriod(start: string, end: string): string {
  return `${start}/${end}`;
}

export function parseMeasurementPeriod(period: string): { start: string; end: string } | null {
  const m = period.trim().match(ISO_RANGE);
  if (!m) return null;
  return { start: m[1], end: m[2] };
}

export function displayMeasurementPeriod(period: string, locale = 'es'): string {
  const parsed = parseMeasurementPeriod(period);
  if (!parsed) return period;

  const loc = locale === 'pt' ? 'pt-UY' : locale === 'en' ? 'en-US' : 'es-UY';
  const fmt = (iso: string) =>
    new Date(`${iso}T12:00:00`).toLocaleDateString(loc, {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });

  return `${fmt(parsed.start)} – ${fmt(parsed.end)}`;
}

export function isValidMeasurementPeriodRange(start: string, end: string): boolean {
  if (!start || !end) return false;
  return new Date(end) >= new Date(start);
}
