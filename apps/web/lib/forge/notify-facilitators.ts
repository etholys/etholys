import 'server-only';

import { getForgeDb } from '@/lib/forge/db';
import {
  buildForgeFacilitatorAtRiskNotification,
  parseForgeEmailLocale,
} from '@/lib/forge/email-templates';
import type { Locale } from '@/lib/i18n';
import { createNotification } from '@/lib/notify';
import type { CourseAnalytics } from '@/lib/forge/course-analytics-types';

/** Avisa facilitadores/admins da org quando há alunos em risco. */
export async function notifyFacilitatorsAtRisk(
  companyId: string,
  courseId: string,
  courseTitle: string,
  analytics: CourseAnalytics,
  locale?: Locale
): Promise<void> {
  if (analytics.atRisk.length === 0) return;

  const loc = parseForgeEmailLocale(locale);

  const admins = await getForgeDb().companyUser.findMany({
    where: { companyId, role: 'ADMIN' },
    select: { userId: true },
  });

  const invitedBy = await getForgeDb().forgeEnrollment.findMany({
    where: { courseId, invitedById: { not: null } },
    select: { invitedById: true },
    distinct: ['invitedById'],
  });

  const userIds = new Set<string>();
  for (const a of admins) userIds.add(a.userId);
  for (const i of invitedBy) {
    if (i.invitedById) userIds.add(i.invitedById);
  }

  const link = `/hub/forge/cursos/${courseId}/analytics`;
  const notify = buildForgeFacilitatorAtRiskNotification({
    courseTitle,
    atRiskCount: analytics.atRisk.length,
    avgProgress: analytics.avgProgress,
    locale: loc,
  });

  for (const userId of userIds) {
    await createNotification({
      userId,
      type: 'forge_at_risk',
      title: notify.title,
      message: notify.message,
      link,
    });
  }
}
