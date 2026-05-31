/** Tipos e helpers seguros para Client Components (sem Prisma). */

import { forgeCourseEntryPath } from '@/lib/forge/course-entry-path';
import type { ForgeDeliveryMode } from '@/lib/forge/delivery';

export type ForgeAccessMode = 'organization' | 'course_only';

export type ForgeAccessCourse = {
  id: string;
  title: string;
  coverEmoji: string;
  status: string;
  progressPercent: number;
  deliveryMode?: ForgeDeliveryMode;
};

export type ForgeAccessContext = {
  mode: ForgeAccessMode;
  userId: string;
  companyIds: string[];
  allowedCourseIds: string[];
  courses: ForgeAccessCourse[];
};

export function isPathAllowedForCourseOnly(pathname: string, allowedCourseIds: string[]): boolean {
  if (
    pathname === '/hub/forge/mis-cursos' ||
    pathname === '/hub/forge/certificados' ||
    pathname.startsWith('/hub/forge/entrar') ||
    pathname.startsWith('/hub/forge/activar') ||
    pathname.startsWith('/verificar-forge')
  ) {
    return true;
  }

  const m = pathname.match(/^\/hub\/forge\/cursos\/([^/]+)(?:\/|$)/);
  if (!m) return false;
  return allowedCourseIds.includes(m[1]);
}

export function defaultRedirectForCourseOnly(ctx: ForgeAccessContext): string {
  if (ctx.courses.length === 1) {
    return forgeCourseEntryPath(ctx.courses[0].id, ctx.courses[0].deliveryMode);
  }
  return '/hub/forge/mis-cursos';
}
