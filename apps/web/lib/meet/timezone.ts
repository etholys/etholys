/** Fusos comuns no CHORUS (criar + editar reunião). */
export const MEET_TIMEZONE_OPTIONS = [
  'UTC',
  'America/Sao_Paulo',
  'America/Argentina/Buenos_Aires',
  'America/Santiago',
  'America/Bogota',
  'America/Mexico_City',
  'America/Lima',
  'America/New_York',
  'America/Chicago',
  'America/Los_Angeles',
  'Europe/Lisbon',
  'Europe/Madrid',
  'Europe/London',
  'Europe/Paris',
] as const;

export function browserTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}

/** Interpreta `YYYY-MM-DDTHH:mm` como hora de parede em `timeZone` → instante UTC. */
export function meetWallTimeToUtc(localValue: string, timeZone: string): Date {
  const match = localValue.trim().match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!match) {
    const fallback = new Date(localValue);
    return Number.isFinite(fallback.getTime()) ? fallback : new Date(NaN);
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const zone = timeZone.trim() || 'UTC';

  let utcMs = Date.UTC(year, month - 1, day, hour, minute, 0);
  for (let i = 0; i < 3; i += 1) {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: zone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(new Date(utcMs));
    const get = (type: Intl.DateTimeFormatPartTypes) =>
      Number(parts.find((part) => part.type === type)?.value || '0');
    const asIfUtc = Date.UTC(
      get('year'),
      get('month') - 1,
      get('day'),
      get('hour'),
      get('minute'),
      get('second'),
    );
    const desired = Date.UTC(year, month - 1, day, hour, minute, 0);
    utcMs += desired - asIfUtc;
  }
  return new Date(utcMs);
}

/** Formata instante UTC como valor de `<input type="datetime-local">` na zona. */
export function meetUtcToWallInput(date: Date, timeZone: string): string {
  const zone = timeZone.trim() || 'UTC';
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: zone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value || '00';
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`;
}
