/**
 * Evento grupal / capacitação da agenda CHORUS (inscrição no mesmo bloco).
 * Puro: sem base de dados.
 */

import { isValidOpenDayYmd, normalizeOpenDayHours } from '@/lib/meet/booking-open-day';

export function isValidGroupEventYmd(value: string): boolean {
  return isValidOpenDayYmd(value);
}

export function normalizeGroupEventHours(
  startMin: number,
  endMin: number,
): { startMin: number; endMin: number } | null {
  return normalizeOpenDayHours(startMin, endMin);
}

export function groupEventPublicPath(code: string): string {
  return `/a/e/${code}`;
}

export function normalizeGroupCapacity(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = Math.trunc(Number(value));
  if (!Number.isFinite(n) || n < 1 || n > 10_000) return null;
  return n;
}
