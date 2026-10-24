/**
 * Dia aberto da agenda CHORUS (oficina pontual / rodada / assistência).
 * Puro: sem base de dados.
 */

import type { BookingWindowInput } from '@/lib/meet/booking-slots';
import { weekdayOfYmd } from '@/lib/meet/booking-slots';

const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidOpenDayYmd(value: string): boolean {
  if (!YMD_RE.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === d
  );
}

export function normalizeOpenDayHours(startMin: number, endMin: number): { startMin: number; endMin: number } | null {
  const start = Math.trunc(Number(startMin));
  const end = Math.trunc(Number(endMin));
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  if (start < 0 || end > 24 * 60 || end - start < 15) return null;
  return { startMin: start, endMin: end };
}

/** Janela única no weekday do dia — alimenta buildOpenSlots com days: 1. */
export function buildOpenDayWindows(dayYmd: string, startMin: number, endMin: number): BookingWindowInput[] {
  if (!isValidOpenDayYmd(dayYmd)) return [];
  const hours = normalizeOpenDayHours(startMin, endMin);
  if (!hours) return [];
  const weekday = weekdayOfYmd(dayYmd);
  if (weekday < 0) return [];
  return [{ weekday, startMin: hours.startMin, endMin: hours.endMin }];
}

export function openDayPublicPath(code: string): string {
  return `/a/d/${code}`;
}
