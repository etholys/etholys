import { randomInt } from 'crypto';

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export const FERIA_AGE_RANGES = ['under18', '18-24', '25-34', '35-44', '45-54', '55plus'] as const;
export const FERIA_GENDERS = ['female', 'male', 'non_binary', 'prefer_not_say', 'other'] as const;

export type FeriaAgeRange = (typeof FERIA_AGE_RANGES)[number];
export type FeriaGender = (typeof FERIA_GENDERS)[number];

export function normalizeRoomCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

export function generateFeriaCode(length = 6): string {
  let out = '';
  for (let i = 0; i < length; i++) {
    out += CODE_CHARS[randomInt(CODE_CHARS.length)];
  }
  return out;
}

export function pickRandomGroup<T extends { id: string; memberCount: number }>(
  groups: T[],
  teamSize: number
): T | null {
  const withSpace = groups.filter((g) => g.memberCount < teamSize);
  if (withSpace.length === 0) return null;
  return withSpace[randomInt(withSpace.length)] ?? null;
}

export function buildFeriaSalaRedirect(courseId: string, playGroupId: string): string {
  const qs = new URLSearchParams({ group: playGroupId });
  return `/hub/forge/cursos/${courseId}/sala?${qs.toString()}`;
}
