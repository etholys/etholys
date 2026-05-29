import type { ForgeLiveSession, ForgeLearningActivity } from '@prisma/client';
import { sessionStatus, type SerializedLiveSession } from '@/lib/forge/live-sessions';

type Row = ForgeLiveSession & {
  focusActivity?: Pick<ForgeLearningActivity, 'title'> | null;
};

export function serializeLiveSession(row: Row, now = new Date()): SerializedLiveSession {
  const startsAt = row.startsAt;
  const endsAt = row.endsAt;
  return {
    id: row.id,
    courseId: row.courseId,
    title: row.title,
    startsAt: startsAt.toISOString(),
    endsAt: endsAt?.toISOString() ?? null,
    meetingUrl: row.meetingUrl,
    activityId: row.activityId,
    activityTitle: row.focusActivity?.title ?? null,
    facilitatorNotes: row.facilitatorNotes,
    recordingUrl: row.recordingUrl,
    recordingNotes: row.recordingNotes,
    sortOrder: row.sortOrder,
    status: sessionStatus(startsAt, endsAt, now),
  };
}
