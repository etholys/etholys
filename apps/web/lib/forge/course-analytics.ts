import 'server-only';

import { getForgeDb } from '@/lib/forge/db';
import { getForgeFacilitatorUserIdsForCourse } from '@/lib/forge/facilitator-access';
import { getCourseProgressPercent } from '@/lib/forge/progress';
import type { CourseAnalytics, ModuleHeatmapRow } from '@/lib/forge/course-analytics-types';

export type { CourseAnalytics, ModuleHeatmapRow } from '@/lib/forge/course-analytics-types';

export async function getCourseAnalytics(courseId: string): Promise<CourseAnalytics> {
  const db = getForgeDb();

  const course = await db.forgeCourse.findUnique({
    where: { id: courseId },
    select: { companyId: true, createdById: true },
  });
  if (!course) {
    return {
      courseId,
      learnerCount: 0,
      completedCount: 0,
      avgProgress: 0,
      activeLast7Days: 0,
      atRisk: [],
      moduleHeatmap: [],
      certificatesIssued: 0,
    };
  }

  const facilitatorIds = await getForgeFacilitatorUserIdsForCourse(
    courseId,
    course.companyId,
    course.createdById
  );

  const allEnrollments = await db.forgeEnrollment.findMany({
    where: { courseId, status: { in: ['active', 'completed'] } },
    include: { user: { select: { id: true, name: true, email: true } } },
  });
  const enrollments = allEnrollments.filter((e) => !facilitatorIds.has(e.userId));

  const modules = await db.forgeModule.findMany({
    where: { courseId },
    include: { activities: { select: { id: true } } },
    orderBy: { sortOrder: 'asc' },
  });

  const allActivityIds = modules.flatMap((m) => m.activities.map((a) => a.id));
  const learnerIds = enrollments.map((e) => e.userId);
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  let progressSum = 0;
  let completedCount = 0;
  let activeLast7Days = 0;
  const atRisk: CourseAnalytics['atRisk'] = [];

  for (const e of enrollments) {
    const pct = await getCourseProgressPercent(courseId, e.userId);
    progressSum += pct;
    if (pct >= 100) completedCount += 1;

    const recent = await db.forgeActivityProgress.findFirst({
      where: {
        userId: e.userId,
        activityId: { in: allActivityIds },
        updatedAt: { gte: sevenDaysAgo },
      },
    });
    if (recent) activeLast7Days += 1;

    const daysSinceEnroll =
      (Date.now() - e.enrolledAt.getTime()) / (1000 * 60 * 60 * 24);
    if (pct < 25 && daysSinceEnroll > 5 && e.status === 'active') {
      atRisk.push({
        userId: e.userId,
        name: e.user.name,
        email: e.user.email,
        progressPercent: pct,
        enrolledAt: e.enrolledAt.toISOString(),
      });
    }
  }

  const moduleHeatmap: ModuleHeatmapRow[] = [];
  for (const mod of modules) {
    const actIds = mod.activities.map((a) => a.id);
    if (actIds.length === 0 || learnerIds.length === 0) {
      moduleHeatmap.push({
        moduleId: mod.id,
        title: mod.title,
        sortOrder: mod.sortOrder,
        activityCount: actIds.length,
        completionRate: 0,
      });
      continue;
    }
    const done = await db.forgeActivityProgress.count({
      where: {
        activityId: { in: actIds },
        userId: { in: learnerIds },
        status: 'completed',
      },
    });
    const possible = actIds.length * learnerIds.length;
    moduleHeatmap.push({
      moduleId: mod.id,
      title: mod.title,
      sortOrder: mod.sortOrder,
      activityCount: actIds.length,
      completionRate: possible > 0 ? Math.round((done / possible) * 100) : 0,
    });
  }

  const certs = await db.forgeCertificate.count({ where: { courseId } });

  return {
    courseId,
    learnerCount: enrollments.length,
    completedCount,
    avgProgress: enrollments.length ? Math.round(progressSum / enrollments.length) : 0,
    activeLast7Days,
    atRisk: atRisk.slice(0, 15),
    moduleHeatmap,
    certificatesIssued: certs,
  };
}
