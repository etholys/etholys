import 'server-only';

import { getForgeDb } from '@/lib/forge/db';
import { getCourseProgressPercent } from '@/lib/forge/progress';

import type { MyProgram, MyProgramCourse } from '@/lib/forge/my-programs-types';

export type { MyProgram, MyProgramCourse } from '@/lib/forge/my-programs-types';

export async function getMyForgePrograms(userId: string): Promise<MyProgram[]> {
  const enrollments = await getForgeDb().forgeEnrollment.findMany({
    where: { userId, status: { in: ['active', 'completed'] } },
    select: { courseId: true },
  });
  const courseIds = enrollments.map((e) => e.courseId);
  if (courseIds.length === 0) return [];

  const courses = await getForgeDb().forgeCourse.findMany({
    where: { id: { in: courseIds }, programId: { not: null } },
    select: {
      id: true,
      title: true,
      coverEmoji: true,
      status: true,
      programId: true,
      program: { select: { id: true, title: true, description: true } },
    },
  });

  const byProgram = new Map<string, MyProgram>();

  for (const c of courses) {
    if (!c.programId || !c.program) continue;
    const pct = await getCourseProgressPercent(c.id, userId);
    const courseRow: MyProgramCourse = {
      id: c.id,
      title: c.title,
      coverEmoji: c.coverEmoji,
      progressPercent: pct,
      status: c.status,
    };

    let prog = byProgram.get(c.programId);
    if (!prog) {
      prog = {
        id: c.program.id,
        title: c.program.title,
        description: c.program.description,
        courses: [],
        overallProgress: 0,
      };
      byProgram.set(c.programId, prog);
    }
    prog.courses.push(courseRow);
  }

  for (const p of byProgram.values()) {
    if (p.courses.length > 0) {
      p.overallProgress = Math.round(
        p.courses.reduce((s, c) => s + c.progressPercent, 0) / p.courses.length
      );
    }
  }

  return [...byProgram.values()];
}
