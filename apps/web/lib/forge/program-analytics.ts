import 'server-only';

import { getForgeDb } from '@/lib/forge/db';
import { getCourseAnalytics } from '@/lib/forge/course-analytics';
import type { ProgramAnalytics, ProgramCourseStat } from '@/lib/forge/program-analytics-types';

export type { ProgramAnalytics, ProgramCourseStat } from '@/lib/forge/program-analytics-types';

export async function getProgramAnalytics(programId: string): Promise<ProgramAnalytics | null> {
  const db = getForgeDb();
  const program = await db.forgeProgram.findUnique({
    where: { id: programId },
    include: {
      courses: { select: { id: true, title: true, coverEmoji: true } },
    },
  });
  if (!program) return null;

  const courseStats: ProgramCourseStat[] = [];
  let progressSum = 0;
  const learnerIds = new Set<string>();

  for (const c of program.courses) {
    const stats = await getCourseAnalytics(c.id);
    courseStats.push({
      ...stats,
      title: c.title,
      coverEmoji: c.coverEmoji,
    });
    progressSum += stats.avgProgress;
    const enrollments = await db.forgeEnrollment.findMany({
      where: { courseId: c.id, status: { in: ['active', 'completed'] } },
      select: { userId: true },
    });
    for (const e of enrollments) learnerIds.add(e.userId);
  }

  return {
    programId: program.id,
    title: program.title,
    courseCount: program.courses.length,
    totalLearners: learnerIds.size,
    avgProgressAcrossCourses: program.courses.length
      ? Math.round(progressSum / program.courses.length)
      : 0,
    courses: courseStats,
  };
}
