/**
 * Horários abertos da agenda CHORUS. Puro: sem base de dados.
 */

import { meetWallTimeToUtc } from '@/lib/meet/timezone';

export type BookingWindowInput = {
  weekday: number;
  startMin: number;
  endMin: number;
};

export type BusyRange = {
  startsAt: Date;
  endsAt: Date;
};

export type OpenSlot = {
  date: string;
  startsAt: string;
  endsAt: string;
};

export const DEFAULT_BOOKING_SLOT_MINUTES = 30;

/** Dias úteis 09:00–18:00. */
export const DEFAULT_BOOKING_WINDOWS: BookingWindowInput[] = [1, 2, 3, 4, 5].map((weekday) => ({
  weekday,
  startMin: 9 * 60,
  endMin: 18 * 60,
}));

export function rangesOverlap(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd;
}

export function ymdInTimeZone(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timeZone || 'UTC',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value || '00';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

export function weekdayOfYmd(ymd: string): number {
  const match = ymd.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return -1;
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))).getUTCDay();
}

/** Segunda-feira da semana que contém `ymd`. */
export function startOfWeekMonday(ymd: string): string {
  const weekday = weekdayOfYmd(ymd);
  if (weekday < 0) return ymd;
  const delta = weekday === 0 ? -6 : 1 - weekday;
  return addDaysYmd(ymd, delta);
}

export function addMonthsYmd(ymd: string, delta: number): string {
  const match = ymd.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return ymd;
  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1 + delta;
  const day = Number(match[3]);
  const first = new Date(Date.UTC(year, monthIndex, 1));
  const dim = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  const clamped = Math.min(day, dim);
  const dt = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), clamped));
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const d = String(dt.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addDaysYmd(ymd: string, days: number): string {
  const match = ymd.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return ymd;
  const dt = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + days));
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const d = String(dt.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function minutesToHm(min: number): string {
  const clamped = Math.max(0, Math.min(24 * 60, Math.round(min)));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function hmToMinutes(value: string): number | null {
  const match = value.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h < 0 || h > 24 || m < 0 || m > 59) return null;
  if (h === 24 && m !== 0) return null;
  return h * 60 + m;
}

export function normalizeBookingWindows(raw: BookingWindowInput[]): BookingWindowInput[] {
  const out: BookingWindowInput[] = [];
  for (const row of raw) {
    const weekday = Math.trunc(Number(row.weekday));
    const startMin = Math.trunc(Number(row.startMin));
    const endMin = Math.trunc(Number(row.endMin));
    if (weekday < 0 || weekday > 6) continue;
    if (!Number.isFinite(startMin) || !Number.isFinite(endMin)) continue;
    if (startMin < 0 || endMin > 24 * 60 || endMin - startMin < 15) continue;
    out.push({ weekday, startMin, endMin });
  }
  return out;
}

export function clampSlotMinutes(value: number): number {
  const n = Math.trunc(Number(value));
  if (!Number.isFinite(n)) return DEFAULT_BOOKING_SLOT_MINUTES;
  return Math.min(120, Math.max(15, n));
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function wallFromMinutes(ymd: string, minutes: number): string {
  if (minutes >= 24 * 60) {
    return `${addDaysYmd(ymd, 1)}T00:00`;
  }
  return `${ymd}T${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
}

export function buildOpenSlots(input: {
  timeZone: string;
  slotMinutes: number;
  windows: BookingWindowInput[];
  busy?: BusyRange[];
  fromYmd?: string;
  days?: number;
  now?: Date;
}): OpenSlot[] {
  const now = input.now ?? new Date();
  const timeZone = input.timeZone.trim() || 'UTC';
  const slotMinutes = clampSlotMinutes(input.slotMinutes);
  const days = Math.min(28, Math.max(1, Math.trunc(input.days ?? 14)));
  const startYmd = input.fromYmd || ymdInTimeZone(now, timeZone);
  const windows = normalizeBookingWindows(input.windows);
  const busy = input.busy ?? [];
  const out: OpenSlot[] = [];

  for (let i = 0; i < days; i += 1) {
    const ymd = addDaysYmd(startYmd, i);
    const weekday = weekdayOfYmd(ymd);
    for (const window of windows) {
      if (window.weekday !== weekday) continue;
      for (let min = window.startMin; min + slotMinutes <= window.endMin; min += slotMinutes) {
        const starts = meetWallTimeToUtc(wallFromMinutes(ymd, min), timeZone);
        const ends = meetWallTimeToUtc(wallFromMinutes(ymd, min + slotMinutes), timeZone);
        if (!Number.isFinite(starts.getTime()) || !Number.isFinite(ends.getTime())) continue;
        if (starts.getTime() <= now.getTime()) continue;
        const blocked = busy.some((range) =>
          rangesOverlap(starts.getTime(), ends.getTime(), range.startsAt.getTime(), range.endsAt.getTime()),
        );
        if (blocked) continue;
        out.push({ date: ymd, startsAt: starts.toISOString(), endsAt: ends.toISOString() });
        if (out.length >= 500) return out;
      }
    }
  }
  return out;
}
