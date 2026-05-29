import { getForgeDb } from '@/lib/forge/db';
import { awardActivityCompletion } from '@/lib/forge/gamification';
import { issueForgeCertificate } from '@/lib/forge/certificates';
import { syncJourneyAfterActivityComplete } from '@/lib/forge/learner-journey';
import { createNotification } from '@/lib/notify';

export async function completeForgeActivity(opts: {
  userId: string;
  activityId: string;
  score?: number | null;
  payload?: Record<string, unknown>;
}): Promise<{
  progressId: string;
  courseId: string;
  companyId: string;
  gamification: { xpGained: number; level: number; totalXp: number };
}> {
  const activity = await getForgeDb().forgeLearningActivity.findUnique({
    where: { id: opts.activityId },
    include: { module: { include: { course: true } } },
  });
  if (!activity) throw new Error('Atividade não encontrada');

  const course = activity.module.course;
  const now = new Date();

  const progress = await getForgeDb().forgeActivityProgress.upsert({
    where: {
      activityId_userId: { activityId: opts.activityId, userId: opts.userId },
    },
    create: {
      activityId: opts.activityId,
      userId: opts.userId,
      status: 'completed',
      score: opts.score ?? null,
      payload: opts.payload ?? undefined,
      completedAt: now,
    },
    update: {
      status: 'completed',
      score: opts.score ?? undefined,
      payload: opts.payload ?? undefined,
      completedAt: now,
    },
  });

  await syncJourneyAfterActivityComplete({
    courseId: course.id,
    userId: opts.userId,
    activityId: activity.id,
    activityTitle: activity.title,
    activityType: activity.type,
    moduleTitle: activity.module.title,
    score: opts.score ?? null,
    payload: opts.payload,
  }).catch(() => {});

  const gamification = await awardActivityCompletion({
    companyId: course.companyId,
    userId: opts.userId,
    courseId: course.id,
    activityId: activity.id,
    activityType: activity.type,
    xpWeight: activity.xpWeight,
    score: opts.score ?? null,
  });

  const totalActivities = await getForgeDb().forgeLearningActivity.count({
    where: { module: { courseId: course.id } },
  });
  const completedCount = await getForgeDb().forgeActivityProgress.count({
    where: {
      userId: opts.userId,
      status: 'completed',
      activity: { module: { courseId: course.id } },
    },
  });

  let certificateId: string | null = null;

  if (totalActivities > 0 && completedCount >= totalActivities) {
    await getForgeDb().forgeEnrollment.updateMany({
      where: { courseId: course.id, userId: opts.userId, status: 'active' },
      data: { status: 'completed', completedAt: now },
    });
    await getForgeDb().forgeGamificationEvent.create({
      data: {
        companyId: course.companyId,
        userId: opts.userId,
        courseId: course.id,
        type: 'course.completed',
        payload: { completedActivities: completedCount },
      },
    });

    const cert = await issueForgeCertificate({
      companyId: course.companyId,
      courseId: course.id,
      userId: opts.userId,
      courseTitle: course.title,
    });
    certificateId = cert.id;
    await createNotification({
      userId: opts.userId,
      type: 'forge_certificate',
      title: `Certificado: ${course.title}`,
      message: 'Completaste el curso. Descarga tu certificado en FORGE.',
      link: '/hub/forge/certificados',
    });

    const profile = await getForgeDb().forgeLearnerProfile.findUnique({
      where: { courseId_userId: { courseId: course.id, userId: opts.userId } },
    });
    const badges = Array.isArray(profile?.badges) ? (profile!.badges as string[]) : [];
    if (!badges.includes('course_complete')) {
      await getForgeDb().forgeLearnerProfile.update({
        where: { courseId_userId: { courseId: course.id, userId: opts.userId } },
        data: { badges: [...badges, 'course_complete'] },
      });
    }
  }

  return {
    progressId: progress.id,
    courseId: course.id,
    companyId: course.companyId,
    gamification,
    certificateId,
    courseCompleted: certificateId != null,
  };
}

export async function getCourseProgressPercent(courseId: string, userId: string): Promise<number> {
  const total = await getForgeDb().forgeLearningActivity.count({
    where: { module: { courseId } },
  });
  if (total === 0) return 0;
  const done = await getForgeDb().forgeActivityProgress.count({
    where: {
      userId,
      status: 'completed',
      activity: { module: { courseId } },
    },
  });
  return Math.round((done / total) * 100);
}
