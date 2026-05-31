import type { Prisma } from '@prisma/client';
import { parseDeliveryMode, parseLiveConfig } from '@/lib/forge/delivery';
import { getJitsiBaseUrl } from '@/lib/forge/jitsi-config';
import { parseGamePlayMode } from '@/lib/forge/game-play-mode';

type CourseWithTree = Prisma.ForgeCourseGetPayload<{
  include: {
    modules: {
      include: { activities: { include: { gameSpec: true } } };
      orderBy: { sortOrder: 'asc' };
    };
  };
}>;

export function serializeForgeCourse(
  course: CourseWithTree,
  extras?: { progressPercent?: number; xp?: number; level?: number; canFacilitate?: boolean }
) {
  const activities = course.modules.flatMap((m) => m.activities);
  return {
    id: course.id,
    companyId: course.companyId,
    programId: course.programId,
    title: course.title,
    description: course.description,
    status: course.status,
    deliveryMode: parseDeliveryMode(course.deliveryMode),
    gamePlayMode: parseGamePlayMode(course.gamePlayMode),
    cohortMode: course.cohortMode === 'open' ? 'open' : 'invite_only',
    liveConfig: parseLiveConfig(course.liveConfig),
    jitsiBaseUrl: getJitsiBaseUrl(),
    coverEmoji: course.coverEmoji,
    hasLibro: Boolean(course.libroPdfPath),
    libroPdfName: course.libroPdfName,
    hasPresentation: Boolean(
      course.presentationSlides ||
        course.presentationPdfPath ||
        course.presentationEmbedUrl
    ),
    presentationSlides: (course.presentationSlides as unknown[]) ?? [],
    presentationPdfName: course.presentationPdfName,
    presentationEmbedUrl: course.presentationEmbedUrl,
    libroOcrStatus: course.libroOcrStatus ?? null,
    libroOcrReady: course.libroOcrStatus === 'done',
    estimatedHours: course.estimatedHours,
    gamification: course.gamification,
    createdAt: course.createdAt.toISOString(),
    updatedAt: course.updatedAt.toISOString(),
    moduleCount: course.modules.length,
    activityCount: activities.length,
    progressPercent: extras?.progressPercent,
    canFacilitate: extras?.canFacilitate,
    learner: extras?.xp != null ? { xp: extras.xp, level: extras.level ?? 1 } : undefined,
    modules: course.modules.map((mod) => ({
      id: mod.id,
      title: mod.title,
      sortOrder: mod.sortOrder,
      activities: mod.activities.map((a) => ({
        id: a.id,
        type: a.type,
        title: a.title,
        sortOrder: a.sortOrder,
        config: a.config,
        xpWeight: a.xpWeight,
        gameSpecId: a.gameSpecId ?? a.gameSpec?.id ?? null,
        gameSpec: a.gameSpec
          ? {
              id: a.gameSpec.id,
              engine: a.gameSpec.engine,
              title: a.gameSpec.title,
              status: a.gameSpec.status,
            }
          : null,
      })),
    })),
  };
}
