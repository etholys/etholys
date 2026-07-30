/**
 * Guard edge-safe para utilizadores course_only (convidados do jogo / curso).
 * Sem Prisma — usado no middleware e em helpers partilhados com o cliente.
 */

import { isPathAllowedForCourseOnly } from '@/lib/forge/access-context-shared';
import { isPublicForgePath } from '@/lib/forge/public-paths';

/** Páginas sempre permitidas a quem está autenticado como course_only. */
export function isCourseOnlyPublicOrAuthPage(pathname: string): boolean {
  if (pathname === '/login' || pathname.startsWith('/login/')) return true;
  if (pathname.startsWith('/api/auth')) return true;
  if (isPublicForgePath(pathname)) return true;
  if (pathname.startsWith('/expedicion')) return true;
  if (pathname.startsWith('/verificar-forge')) return true;
  return false;
}

/**
 * Página permitida para course_only: só FORGE no curso contratado (+ auth/público).
 * Qualquer /hub (exceto forge permitido), /dashboard, SIEP, lab, etc. → bloqueado.
 */
export function isPageAllowedForCourseOnlyUser(
  pathname: string,
  allowedCourseIds: string[]
): boolean {
  if (isCourseOnlyPublicOrAuthPage(pathname)) return true;
  return isPathAllowedForCourseOnly(pathname, allowedCourseIds);
}

/**
 * APIs permitidas a course_only. Tudo o resto (companies, nexus, atlas, siep…) → 403.
 */
export function isApiAllowedForCourseOnlyUser(pathname: string): boolean {
  if (!pathname.startsWith('/api/')) return true;
  if (pathname.startsWith('/api/auth')) return true;
  if (pathname.startsWith('/api/internal/')) return true;
  if (pathname.startsWith('/api/forge')) return true;
  if (pathname === '/api/workspace/entry-route') return true;
  if (pathname.startsWith('/api/notifications')) return true;
  if (pathname.startsWith('/api/upload') && pathname.includes('forge')) return true;
  return false;
}

export function defaultCourseOnlyHome(opts: {
  allowedCourseIds: string[];
  homePath?: string | null;
}): string {
  if (opts.homePath && opts.homePath.startsWith('/')) return opts.homePath;
  if (opts.allowedCourseIds.length === 1) {
    return `/hub/forge/cursos/${opts.allowedCourseIds[0]}/sala`;
  }
  return '/hub/forge/mis-cursos';
}
