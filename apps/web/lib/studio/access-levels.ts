/** Pure access helpers — safe for client components (no Prisma/server). */

export type StudioAccessLevel = 'none' | 'viewer' | 'editor' | 'admin' | 'owner';

export function canDeleteStudioDocument(access: StudioAccessLevel): boolean {
  return access === 'owner' || access === 'admin';
}

export function canEditStudioContent(access: StudioAccessLevel): boolean {
  return access === 'owner' || access === 'admin' || access === 'editor';
}
