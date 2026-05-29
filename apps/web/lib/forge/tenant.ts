import { getForgeDb } from '@/lib/forge/db';
import { getUserCompanyIds } from '@/lib/tenant';

export type ForgeTenant = { userId: string; companyIds: string[] };

export async function requireForgeTenant(): Promise<ForgeTenant | null> {
  const t = await getUserCompanyIds();
  if (!t) return null;
  return t;
}

export function resolveForgeCompanyId(
  tenant: ForgeTenant,
  requested: string | null | undefined
): string | null {
  const c = requested?.trim();
  if (c && tenant.companyIds.includes(c)) return c;
  return tenant.companyIds[0] ?? null;
}

export async function assertForgeCompanyAccess(
  companyId: string,
  tenant: ForgeTenant
): Promise<boolean> {
  return tenant.companyIds.includes(companyId);
}

export async function loadCourseForTenant(courseId: string, tenant: ForgeTenant) {
  return getForgeDb().forgeCourse.findFirst({
    where: {
      id: courseId,
      OR: [
        { companyId: { in: tenant.companyIds } },
        { facilitators: { some: { userId: tenant.userId } } },
        { enrollments: { some: { userId: tenant.userId, status: { in: ['active', 'completed'] } } } },
      ],
    },
  });
}

export async function loadActivityForTenant(activityId: string, tenant: ForgeTenant) {
  return loadActivityForForgeAccess(activityId, tenant);
}

/** Empresa do curso ou matrícula ativa (aluno externo). */
export async function loadActivityForForgeAccess(activityId: string, tenant: ForgeTenant) {
  return getForgeDb().forgeLearningActivity.findFirst({
    where: {
      id: activityId,
      module: {
        course: {
          OR: [
            { companyId: { in: tenant.companyIds } },
            { enrollments: { some: { userId: tenant.userId, status: 'active' } } },
          ],
        },
      },
    },
    include: {
      gameSpec: true,
      module: { include: { course: true } },
    },
  });
}

export async function loadSharedGameRoomForForgeAccess(
  roomId: string,
  tenant: ForgeTenant
) {
  return getForgeDb().forgeSharedGameRoom.findFirst({
    where: {
      id: roomId,
      activity: {
        module: {
          course: {
            OR: [
              { companyId: { in: tenant.companyIds } },
              { enrollments: { some: { userId: tenant.userId, status: 'active' } } },
            ],
          },
        },
      },
    },
    include: {
      activity: { include: { gameSpec: true, module: { include: { course: true } } } },
    },
  });
}
