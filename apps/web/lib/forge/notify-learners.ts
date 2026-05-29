import 'server-only';

import { getForgeDb } from '@/lib/forge/db';
import { createNotification } from '@/lib/notify';
import { getCourseProgressPercent } from '@/lib/forge/progress';
import { buildForgeNudgeNotification, parseForgeEmailLocale } from '@/lib/forge/email-templates';
import { sendForgeNudgeEmail } from '@/lib/forge/send-forge-email';
import type { CourseAnalytics } from '@/lib/forge/course-analytics-types';
import type { Locale } from '@/lib/i18n';

export type LearnerNotifyResult = {
  userId: string;
  email: string | null;
  inApp: boolean;
  emailSent: boolean;
  error?: string;
};

export async function notifyAtRiskLearners(
  courseId: string,
  courseTitle: string,
  analytics: CourseAnalytics,
  locale: Locale = 'es'
): Promise<LearnerNotifyResult[]> {
  const loc = parseForgeEmailLocale(locale);
  const results: LearnerNotifyResult[] = [];
  const courseUrl = `/hub/forge/cursos/${courseId}`;

  for (const row of analytics.atRisk) {
    const user = await getForgeDb().user.findUnique({
      where: { id: row.userId },
      select: { email: true, name: true },
    });
    if (!user?.email) {
      results.push({
        userId: row.userId,
        email: null,
        inApp: false,
        emailSent: false,
        error: 'sin email',
      });
      continue;
    }

    const notify = buildForgeNudgeNotification({
      courseTitle,
      kind: 'at_risk',
      progressPercent: row.progressPercent,
      locale: loc,
    });
    await createNotification({
      userId: row.userId,
      type: 'forge_nudge',
      title: notify.title,
      message: notify.message,
      link: courseUrl,
    });

    const mail = await sendForgeNudgeEmail({
      to: user.email,
      userName: user.name,
      courseTitle,
      courseUrl,
      kind: 'at_risk',
      progressPercent: row.progressPercent,
      locale: loc,
    });

    results.push({
      userId: row.userId,
      email: user.email,
      inApp: true,
      emailSent: mail.sent,
      error: mail.error,
    });
  }

  return results;
}

/** Alunos sem actividade há N dias (default 7). */
export async function notifyInactiveLearners(
  courseId: string,
  courseTitle: string,
  inactiveDays = 7,
  locale: Locale = 'es'
): Promise<LearnerNotifyResult[]> {
  const loc = parseForgeEmailLocale(locale);
  const db = getForgeDb();
  const enrollments = await db.forgeEnrollment.findMany({
    where: { courseId, status: 'active' },
    include: { user: { select: { id: true, email: true, name: true } } },
  });

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - inactiveDays);

  const activities = await db.forgeLearningActivity.findMany({
    where: { module: { courseId } },
    select: { id: true },
  });
  const activityIds = activities.map((a) => a.id);

  const results: LearnerNotifyResult[] = [];
  const courseUrl = `/hub/forge/cursos/${courseId}`;

  for (const e of enrollments) {
    const recent = await db.forgeActivityProgress.findFirst({
      where: {
        userId: e.userId,
        activityId: { in: activityIds },
        updatedAt: { gte: cutoff },
      },
    });
    if (recent) continue;

    const pct = await getCourseProgressPercent(courseId, e.userId);
    if (pct >= 100) continue;

    if (!e.user.email) continue;

    const notify = buildForgeNudgeNotification({ courseTitle, kind: 'inactive', locale: loc });
    await createNotification({
      userId: e.userId,
      type: 'forge_nudge',
      title: notify.title,
      message: notify.message,
      link: courseUrl,
    });

    const mail = await sendForgeNudgeEmail({
      to: e.user.email,
      userName: e.user.name,
      courseTitle,
      courseUrl,
      kind: 'inactive',
      progressPercent: pct,
      locale: loc,
    });

    results.push({
      userId: e.userId,
      email: e.user.email,
      inApp: true,
      emailSent: mail.sent,
      error: mail.error,
    });
  }

  return results;
}
