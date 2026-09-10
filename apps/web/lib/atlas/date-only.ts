/**
 * Datas de calendário ATLAS (fecha / ejecución / competencia).
 * Sem hora: nunca usar new Date("YYYY-MM-DD") + toLocaleDateString no fuso local
 * (isso recua um dia nas Américas).
 */

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})/;

export function parseDateOnlyToUtc(raw: unknown): Date | null {
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
    return new Date(Date.UTC(raw.getUTCFullYear(), raw.getUTCMonth(), raw.getUTCDate(), 12, 0, 0));
  }
  const s = String(raw ?? '').trim();
  const m = s.match(DATE_ONLY);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (!y || mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const dt = new Date(Date.UTC(y, mo - 1, d, 12, 0, 0));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  return dt;
}

export function dateOnlyIso(raw: unknown): string {
  const d = parseDateOnlyToUtc(raw);
  return d ? d.toISOString().slice(0, 10) : '';
}

export function formatDateOnly(raw: unknown, locale = 'es-UY'): string {
  const iso = dateOnlyIso(raw);
  if (!iso) return '—';
  return new Date(`${iso}T12:00:00.000Z`).toLocaleDateString(locale, { timeZone: 'UTC' });
}
