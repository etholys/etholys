import { prisma } from '@/lib/prisma';
import type { UserRole } from '@prisma/client';

/** Facilitador: admin org, creador del curso, o asignado en ForgeCourseFacilitator. */
export async function getForgeCourseAccess(
  userId: string,
  courseCompanyId: string,
  courseId?: string,
  createdById?: string | null
): Promise<{
  canFacilitate: boolean;
  isOrgAdmin: boolean;
  role: UserRole | null;
}> {
  const link = await prisma.companyUser.findUnique({
    where: { userId_companyId: { userId, companyId: courseCompanyId } },
    select: { role: true },
  });

  if (courseId) {
    const assigned = await prisma.forgeCourseFacilitator.findUnique({
      where: { courseId_userId: { courseId, userId } },
    });
    if (assigned) {
      return {
        canFacilitate: true,
        isOrgAdmin: link?.role === 'ADMIN',
        role: link?.role ?? null,
      };
    }
  }

  if (createdById === userId && link) {
    return { canFacilitate: true, isOrgAdmin: link.role === 'ADMIN', role: link.role };
  }

  if (!link) {
    return { canFacilitate: false, isOrgAdmin: false, role: null };
  }

  return {
    canFacilitate: link.role === 'ADMIN' || link.role === 'PROJECT_MANAGER',
    isOrgAdmin: link.role === 'ADMIN',
    role: link.role,
  };
}

export function isExternalLearnerOnly(canFacilitate: boolean, hasEnrollment: boolean): boolean {
  return hasEnrollment && !canFacilitate;
}

/** IDs de quem facilita o curso — não entram em "alunos en riesgo" nem contagens de turma. */
export async function getForgeFacilitatorUserIdsForCourse(
  courseId: string,
  companyId: string,
  createdById?: string | null
): Promise<Set<string>> {
  const ids = new Set<string>();
  if (createdById) ids.add(createdById);

  const assigned = await prisma.forgeCourseFacilitator.findMany({
    where: { courseId },
    select: { userId: true },
  });
  for (const row of assigned) ids.add(row.userId);

  const staff = await prisma.companyUser.findMany({
    where: {
      companyId,
      role: { in: ['ADMIN', 'PROJECT_MANAGER'] },
    },
    select: { userId: true },
  });
  for (const row of staff) ids.add(row.userId);

  return ids;
}
