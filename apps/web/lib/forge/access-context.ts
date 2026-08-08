import 'server-only';

import { prisma } from '@/lib/prisma';
import { getForgeDb } from '@/lib/forge/db';
import { getUserCompanyIds } from '@/lib/tenant';
import { getCourseProgressPercent } from '@/lib/forge/progress';
import { parseDeliveryMode } from '@/lib/forge/delivery';
import { defaultRedirectForCourseOnly } from '@/lib/forge/access-context-shared';
import type { ForgeAccessContext, ForgeAccessCourse } from '@/lib/forge/access-context-shared';

export type {
  ForgeAccessMode,
  ForgeAccessCourse,
  ForgeAccessContext,
} from '@/lib/forge/access-context-shared';
export { isPathAllowedForCourseOnly, defaultRedirectForCourseOnly } from '@/lib/forge/access-context-shared';

/** Payload leve para JWT / middleware (sem progresso). */
export type ForgeJwtScope = {
  mode: 'organization' | 'course_only';
  allowedCourseIds: string[];
  homePath: string;
};

/**
 * Resolve âmbito FORGE para um userId (login mágico / refresh JWT).
 * Platform admin / User.role=ADMIN → organization (Hub completo, Lab, …).
 * Sem CompanyUser → course_only; com org → organization.
 */
export async function resolveForgeJwtScope(userId: string): Promise<ForgeJwtScope> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, role: true },
  });
  const { isSystemAdmin } = await import('@/lib/platform-access');
  if (isSystemAdmin(user?.email)) {
    return { mode: 'organization', allowedCourseIds: [], homePath: '/hub' };
  }

  const companyUsers = await prisma.companyUser.findMany({
    where: { userId },
    select: { companyId: true },
    take: 1,
  });
  if (companyUsers.length > 0) {
    return { mode: 'organization', allowedCourseIds: [], homePath: '/hub' };
  }

  const enrollments = await getForgeDb().forgeEnrollment.findMany({
    where: {
      userId,
      status: { in: ['active', 'completed'] },
      accessScope: { not: 'organization' },
    },
    include: {
      course: { select: { id: true, deliveryMode: true } },
    },
    orderBy: { enrolledAt: 'desc' },
  });

  const allowedCourseIds = enrollments.map((e) => e.courseId);
  const courses = enrollments.map((e) => ({
    id: e.course.id,
    title: '',
    coverEmoji: '',
    status: 'published',
    deliveryMode: parseDeliveryMode(e.course.deliveryMode),
    progressPercent: 0,
  }));

  const homePath = defaultRedirectForCourseOnly({
    mode: 'course_only',
    userId,
    companyIds: [],
    allowedCourseIds,
    courses,
  });

  return { mode: 'course_only', allowedCourseIds, homePath };
}

/**
 * Regra simples:
 * - Tem CompanyUser em alguma org → modo organização (gestão FORGE).
 * - Só matrícula, sem org → modo course_only (um ou mais cursos contratados, sem catálogo).
 */
export async function getForgeAccessContext(): Promise<ForgeAccessContext | null> {
  const tenant = await getUserCompanyIds();
  if (!tenant) return null;

  const enrollments = await getForgeDb().forgeEnrollment.findMany({
    where: { userId: tenant.userId, status: { in: ['active', 'completed'] } },
    include: {
      course: {
        select: { id: true, title: true, coverEmoji: true, status: true, deliveryMode: true },
      },
    },
    orderBy: { enrolledAt: 'desc' },
  });

  const isOrgMember = tenant.companyIds.length > 0;
  const mode = isOrgMember ? 'organization' : 'course_only';

  const relevant = isOrgMember
    ? enrollments
    : enrollments.filter((e) => e.accessScope !== 'organization');

  const allowedCourseIds = isOrgMember ? [] : relevant.map((e) => e.courseId);

  const courses: ForgeAccessCourse[] = await Promise.all(
    relevant.map(async (e) => ({
      id: e.course.id,
      title: e.course.title,
      coverEmoji: e.course.coverEmoji,
      status: e.course.status,
      deliveryMode: parseDeliveryMode(e.course.deliveryMode),
      progressPercent: await getCourseProgressPercent(e.course.id, tenant.userId),
    }))
  );

  return {
    mode,
    userId: tenant.userId,
    companyIds: tenant.companyIds,
    allowedCourseIds,
    courses,
  };
}
