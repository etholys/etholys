import { getForgeDb } from '@/lib/forge/db';
import { isForgeActivityType, levelFromXp, xpForActivity } from '@/lib/forge/types';

export async function awardActivityCompletion(opts: {
  companyId: string;
  userId: string;
  courseId: string;
  activityId: string;
  activityType: string;
  xpWeight?: number;
  score?: number | null;
}): Promise<{ xpGained: number; level: number; totalXp: number }> {
  const type = isForgeActivityType(opts.activityType) ? opts.activityType : 'lesson';
  const xpGained = xpForActivity(type, opts.xpWeight ?? 1);

  const existing = await getForgeDb().forgeLearnerProfile.findUnique({
    where: { courseId_userId: { courseId: opts.courseId, userId: opts.userId } },
  });

  const finalXp = (existing?.xp ?? 0) + xpGained;
  const level = levelFromXp(finalXp);

  await getForgeDb().forgeLearnerProfile.upsert({
    where: { courseId_userId: { courseId: opts.courseId, userId: opts.userId } },
    create: {
      courseId: opts.courseId,
      userId: opts.userId,
      xp: finalXp,
      level,
    },
    update: { xp: finalXp, level },
  });

  await getForgeDb().forgeGamificationEvent.create({
    data: {
      companyId: opts.companyId,
      userId: opts.userId,
      courseId: opts.courseId,
      type: 'activity.completed',
      payload: {
        activityId: opts.activityId,
        activityType: opts.activityType,
        xpGained,
        score: opts.score ?? null,
      },
    },
  });

  return { xpGained, level, totalXp: finalXp };
}
