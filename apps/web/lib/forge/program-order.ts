import 'server-only';

import { getForgeDb } from '@/lib/forge/db';
import { getCourseProgressPercent } from '@/lib/forge/progress';

export type ProgramAccessCheck =
  | { ok: true }
  | { ok: false; reason: string; requiredCourseId?: string; requiredCourseTitle?: string };

/** Bloqueia acesso se la trilha exige orden y el curso anterior no está al 100%. */
export async function checkProgramOrderAccess(
  userId: string,
  courseId: string
): Promise<ProgramAccessCheck> {
  const course = await getForgeDb().forgeCourse.findUnique({
    where: { id: courseId },
    select: {
      id: true,
      title: true,
      programId: true,
      programSortOrder: true,
      program: { select: { enforceOrder: true } },
    },
  });
  if (!course?.programId || !course.program?.enforceOrder) return { ok: true };

  const prior = await getForgeDb().forgeCourse.findMany({
    where: {
      programId: course.programId,
      programSortOrder: { lt: course.programSortOrder },
    },
    orderBy: { programSortOrder: 'asc' },
    select: { id: true, title: true },
  });

  for (const p of prior) {
    const pct = await getCourseProgressPercent(p.id, userId);
    if (pct < 100) {
      return {
        ok: false,
        reason: 'complete_previous',
        requiredCourseId: p.id,
        requiredCourseTitle: p.title,
      };
    }
  }

  return { ok: true };
}
