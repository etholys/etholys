/** Tipos de atividade FORGE — ver docs/architecture/forge-ead.md */
export const FORGE_ACTIVITY_TYPES = [
  'lesson',
  'media',
  'quiz',
  'game',
  'live',
  'assignment',
  'forum',
] as const;

export type ForgeActivityType = (typeof FORGE_ACTIVITY_TYPES)[number];

export const FORGE_GAME_ENGINES = ['board', 'quiz_race', 'cards', 'branching'] as const;

export type ForgeGameEngine = (typeof FORGE_GAME_ENGINES)[number];

export const FORGE_COURSE_STATUSES = ['draft', 'published', 'archived'] as const;

export type ForgeCourseStatus = (typeof FORGE_COURSE_STATUSES)[number];

export function isForgeActivityType(v: string): v is ForgeActivityType {
  return (FORGE_ACTIVITY_TYPES as readonly string[]).includes(v);
}

export function isForgeGameEngine(v: string): v is ForgeGameEngine {
  return (FORGE_GAME_ENGINES as readonly string[]).includes(v);
}

/** XP base por tipo (multiplicado por activity.xpWeight) */
export const FORGE_XP_BY_TYPE: Record<ForgeActivityType, number> = {
  media: 10,
  lesson: 12,
  forum: 8,
  live: 15,
  quiz: 15,
  game: 25,
  assignment: 30,
};

export function xpForActivity(type: string, weight = 1): number {
  const base = FORGE_XP_BY_TYPE[isForgeActivityType(type) ? type : 'lesson'] ?? 10;
  return Math.round(base * Math.max(0.25, weight));
}

export function levelFromXp(xp: number): number {
  return Math.max(1, Math.floor(Math.sqrt(xp / 40)) + 1);
}
