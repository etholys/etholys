import type { CalendarFeedEvent } from '@/lib/calendar/types';

export type CalendarView = 'day' | 'week' | 'month';

export function startOfDay(d: Date) {
  const n = new Date(d);
  n.setHours(0, 0, 0, 0);
  return n;
}

export function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export function startOfWeek(d: Date) {
  const n = startOfDay(d);
  const pad = (n.getDay() + 6) % 7;
  return addDays(n, -pad);
}

export function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function dayKey(d: Date) {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

export function rangeFor(view: CalendarView, cursor: Date) {
  if (view === 'day') {
    const from = startOfDay(cursor);
    return { from, to: addDays(from, 1) };
  }
  if (view === 'week') {
    const from = startOfWeek(cursor);
    return { from, to: addDays(from, 7) };
  }
  const first = startOfMonth(cursor);
  const pad = (first.getDay() + 6) % 7;
  const from = addDays(first, -pad);
  return { from, to: addDays(from, 42) };
}

export function eventMatchesQuery(event: Pick<CalendarFeedEvent, 'title' | 'description'>, query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return event.title.toLowerCase().includes(q) || (event.description || '').toLowerCase().includes(q);
}

function channel(hex: string, i: number) {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = Number.parseInt(full.slice(i, i + 2), 16);
  return Number.isFinite(n) ? n : 0;
}

export function relativeLuminance(hex: string) {
  const lin = [0, 2, 4].map((i) => {
    const c = channel(hex, i) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
}

export function contrastRatio(fg: string, bg: string) {
  const L1 = relativeLuminance(fg);
  const L2 = relativeLuminance(bg);
  const light = Math.max(L1, L2);
  const dark = Math.min(L1, L2);
  return (light + 0.05) / (dark + 0.05);
}

/** Texto do chip: o par com mais contraste, sempre ≥ 4.5 quando a cor de fundo o permite. */
export function chipForeground(bg: string): '#0f172a' | '#ffffff' {
  const onDark = contrastRatio('#ffffff', bg);
  const onLight = contrastRatio('#0f172a', bg);
  return onDark >= onLight ? '#ffffff' : '#0f172a';
}

export const ECALENDAR_TOKENS = {
  light: { bg: '#ffffff', ink: '#0f172a', muted: '#334155', faint: '#475569', primary: '#1a73e8', onPrimary: '#ffffff' },
  dark: { bg: '#0b1520', ink: '#f8fafc', muted: '#e2e8f0', faint: '#cbd5e1', primary: '#8ab4f8', onPrimary: '#0b1520' },
} as const;
