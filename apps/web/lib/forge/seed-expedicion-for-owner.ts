import {
  getExpedicionOwnerCompanyIds,
  EXPEDICION_OWNER_EMAIL,
} from '@/lib/forge/expedicion-owner';
import {
  EXPEDICION_COURSE_TITLE,
  seedExpedicionSostenibleCourse,
} from '@/lib/forge/seed-expedicion-sostenible';

export type SeedExpedicionOwnerResult = {
  ownerEmail: string;
  courses: { companyId: string; companyName: string; courseId: string }[];
};

/** Publica La Expedición Sostenible em todas as empresas do titular (RC LLC, RC LTDA, …). */
export async function seedExpedicionForOwner(opts?: {
  replace?: boolean;
}): Promise<SeedExpedicionOwnerResult> {
  const { userId, companies } = await getExpedicionOwnerCompanyIds();
  const courses: SeedExpedicionOwnerResult['courses'] = [];

  for (const company of companies) {
    const courseId = await seedExpedicionSostenibleCourse(company.id, userId, {
      replace: opts?.replace ?? true,
    });
    courses.push({
      companyId: company.id,
      companyName: company.name,
      courseId,
    });
  }

  return {
    ownerEmail: EXPEDICION_OWNER_EMAIL,
    courses,
  };
}

export { EXPEDICION_COURSE_TITLE };
