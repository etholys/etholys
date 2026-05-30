import 'server-only';

import { Prisma } from '@prisma/client';
import { getForgeDb } from '@/lib/forge/db';
import type {
  JourneyMapState,
  JourneyMaterial,
  JourneyStation,
  JourneyTimelineEntry,
} from '@/lib/forge/learner-journey-types';

export type {
  JourneyTimelineEntry,
  JourneyMaterial,
  JourneyStation,
  JourneyMapState,
} from '@/lib/forge/learner-journey-types';

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export async function ensureLearnerJourney(courseId: string, userId: string) {
  return getForgeDb().forgeLearnerJourney.upsert({
    where: { courseId_userId: { courseId, userId } },
    create: { courseId, userId, mapState: {}, materials: [], timeline: [] },
    update: {},
  });
}

export async function rebuildJourneyMapState(courseId: string, userId: string): Promise<JourneyMapState> {
  const modules = await getForgeDb().forgeModule.findMany({
    where: { courseId },
    orderBy: { sortOrder: 'asc' },
    include: {
      activities: {
        orderBy: { sortOrder: 'asc' },
        include: {
          progress: { where: { userId } },
          gameSessions: { where: { userId }, orderBy: { updatedAt: 'desc' }, take: 1 },
        },
      },
    },
  });

  let totalActs = 0;
  let doneActs = 0;
  const stations: JourneyStation[] = modules.map((mod) => {
    const acts = mod.activities;
    const done = acts.filter((a) => a.progress[0]?.status === 'completed').length;
    totalActs += acts.length;
    doneActs += done;
    return {
      moduleId: mod.id,
      title: mod.title,
      sortOrder: mod.sortOrder,
      completed: acts.length > 0 && done >= acts.length,
      activityTotal: acts.length,
      activityDone: done,
    };
  });

  const boardActivity = modules
    .flatMap((m) => m.activities)
    .find((a) => a.type === 'game' && a.gameSpecId);
  const latestSession = boardActivity?.gameSessions[0];
  const boardState = (latestSession?.state ?? {}) as Record<string, unknown>;
  const insights = Array.isArray(boardState.insights) ? boardState.insights : [];

  return {
    stations,
    board: boardActivity
      ? {
          position: typeof boardState.position === 'number' ? boardState.position : 0,
          ecoCredits: typeof boardState.ecoCredits === 'number' ? boardState.ecoCredits : 500,
          impactPoints: typeof boardState.impactPoints === 'number' ? boardState.impactPoints : 0,
          insightsCount: insights.length,
          finished: Boolean(boardState.finished),
          activityId: boardActivity.id,
          updatedAt: latestSession?.updatedAt.toISOString(),
        }
      : undefined,
    progressPercent: totalActs > 0 ? Math.round((doneActs / totalActs) * 100) : 0,
  };
}

export async function appendJourneyEvent(
  courseId: string,
  userId: string,
  entry: Omit<JourneyTimelineEntry, 'id' | 'at'>
) {
  const journey = await ensureLearnerJourney(courseId, userId);
  const timeline = Array.isArray(journey.timeline) ? [...(journey.timeline as JourneyTimelineEntry[])] : [];
  timeline.unshift({
    id: uid(),
    at: new Date().toISOString(),
    ...entry,
  });
  const mapState = await rebuildJourneyMapState(courseId, userId);
  await getForgeDb().forgeLearnerJourney.update({
    where: { id: journey.id },
    data: {
      timeline: timeline.slice(0, 200) as Prisma.InputJsonValue,
      mapState: mapState as Prisma.InputJsonValue,
    },
  });
}

export async function addJourneyMaterial(
  courseId: string,
  userId: string,
  material: Omit<JourneyMaterial, 'id' | 'at'>
) {
  const journey = await ensureLearnerJourney(courseId, userId);
  const materials = Array.isArray(journey.materials) ? [...(journey.materials as JourneyMaterial[])] : [];
  materials.unshift({
    id: uid(),
    at: new Date().toISOString(),
    ...material,
  });
  await getForgeDb().forgeLearnerJourney.update({
    where: { id: journey.id },
    data: { materials: materials.slice(0, 100) as Prisma.InputJsonValue },
  });
}

export async function syncJourneyAfterGameAction(opts: {
  courseId: string;
  userId: string;
  activityId: string;
  activityTitle: string;
  actionType: string;
  state: Record<string, unknown>;
  events: { type?: string; message?: string }[];
}) {
  const insights = Array.isArray(opts.state.insights) ? (opts.state.insights as string[]) : [];
  const lastInsight = insights[insights.length - 1];

  if (opts.actionType === 'complete_card' || opts.actionType === 'record_insight') {
    if (lastInsight) {
      await addJourneyMaterial(opts.courseId, opts.userId, {
        kind: 'ficha',
        title: `Ficha — ${opts.activityTitle}`,
        body: lastInsight,
        activityId: opts.activityId,
      });
    }
  }

  const msg = opts.events.find((e) => e.message)?.message;
  await appendJourneyEvent(opts.courseId, opts.userId, {
    type: `game.${opts.actionType}`,
    title: msg ?? `Jugada: ${opts.actionType}`,
    activityId: opts.activityId,
    payload: {
      position: opts.state.position,
      ecoCredits: opts.state.ecoCredits,
      impactPoints: opts.state.impactPoints,
    },
  });
}

export async function syncJourneyAfterActivityComplete(opts: {
  courseId: string;
  userId: string;
  activityId: string;
  activityTitle: string;
  activityType: string;
  moduleTitle: string;
  score?: number | null;
  payload?: Record<string, unknown>;
}) {
  const kind =
    opts.activityType === 'quiz'
      ? 'quiz'
      : opts.activityType === 'lesson' || opts.activityType === 'media'
        ? 'lesson'
        : opts.activityType === 'game'
          ? 'game'
          : 'lesson';

  await appendJourneyEvent(opts.courseId, opts.userId, {
    type: 'activity.completed',
    title: `Completado: ${opts.activityTitle}`,
    detail: opts.moduleTitle,
    activityId: opts.activityId,
    moduleTitle: opts.moduleTitle,
    payload: { score: opts.score, ...opts.payload },
  });

  if (opts.payload && typeof opts.payload === 'object') {
    const text =
      typeof opts.payload.text === 'string'
        ? opts.payload.text
        : typeof opts.payload.last === 'string'
          ? opts.payload.last
          : null;
    if (text) {
      await addJourneyMaterial(opts.courseId, opts.userId, {
        kind: kind === 'quiz' ? 'quiz' : 'insight',
        title: opts.activityTitle,
        body: text,
        activityId: opts.activityId,
        score: opts.score ?? undefined,
      });
    }
  }

  const mapState = await rebuildJourneyMapState(opts.courseId, opts.userId);
  await getForgeDb().forgeLearnerJourney.update({
    where: { courseId_userId: { courseId: opts.courseId, userId: opts.userId } },
    data: { mapState: mapState as Prisma.InputJsonValue },
  });
}

export async function getLearnerJourneyBundle(courseId: string, userId: string) {
  await ensureLearnerJourney(courseId, userId);
  const mapState = await rebuildJourneyMapState(courseId, userId);
  const journey = await getForgeDb().forgeLearnerJourney.findUnique({
    where: { courseId_userId: { courseId, userId } },
    include: {
      user: { select: { id: true, name: true, email: true, image: true } },
      course: { select: { id: true, title: true, coverEmoji: true } },
    },
  });
  if (!journey) throw new Error('Journey not found');

  const profile = await getForgeDb().forgeLearnerProfile.findUnique({
    where: { courseId_userId: { courseId, userId } },
  });
  const enrollment = await getForgeDb().forgeEnrollment.findUnique({
    where: { courseId_userId: { courseId, userId } },
  });
  const progress = await getForgeDb().forgeActivityProgress.findMany({
    where: { userId, activity: { module: { courseId } } },
    include: {
      activity: { select: { id: true, title: true, type: true, module: { select: { title: true } } } },
    },
    orderBy: { completedAt: 'desc' },
  });

  await getForgeDb().forgeLearnerJourney.update({
    where: { id: journey.id },
    data: { mapState: mapState as Prisma.InputJsonValue },
  });

  return {
    journey: {
      mapState,
      materials: (journey.materials ?? []) as JourneyMaterial[],
      timeline: (journey.timeline ?? []) as JourneyTimelineEntry[],
      updatedAt: journey.updatedAt.toISOString(),
    },
    user: journey.user,
    course: journey.course,
    profile: profile ? { xp: profile.xp, level: profile.level, badges: profile.badges } : null,
    enrollment,
    activityProgress: progress.map((p) => ({
      activityId: p.activityId,
      title: p.activity.title,
      type: p.activity.type,
      moduleTitle: p.activity.module.title,
      status: p.status,
      score: p.score,
      completedAt: p.completedAt?.toISOString() ?? null,
      payload: p.payload,
    })),
  };
}
