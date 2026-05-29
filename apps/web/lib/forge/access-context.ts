import 'server-only';

import { getForgeDb } from '@/lib/forge/db';
import { getUserCompanyIds } from '@/lib/tenant';
import { getCourseProgressPercent } from '@/lib/forge/progress';
import type { ForgeAccessContext, ForgeAccessCourse } from '@/lib/forge/access-context-shared';

export type {
  ForgeAccessMode,
  ForgeAccessCourse,
  ForgeAccessContext,
} from '@/lib/forge/access-context-shared';
export { isPathAllowedForCourseOnly, defaultRedirectForCourseOnly } from '@/lib/forge/access-context-shared';

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
      course: { select: { id: true, title: true, coverEmoji: true, status: true } },
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
