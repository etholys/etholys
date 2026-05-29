/** Sessões ao vivo agendadas (calendário FORGE). */

export type ForgeLiveSessionStatus = 'upcoming' | 'live' | 'past';

export type SerializedLiveSession = {
  id: string;
  courseId: string;
  title: string;
  startsAt: string;
  endsAt: string | null;
  meetingUrl: string | null;
  activityId: string | null;
  activityTitle: string | null;
  facilitatorNotes: string | null;
  recordingUrl: string | null;
  recordingNotes: string | null;
  sortOrder: number;
  status: ForgeLiveSessionStatus;
};

export function sessionStatus(
  startsAt: Date,
  endsAt: Date | null,
  now = new Date()
): ForgeLiveSessionStatus {
  const end = endsAt ?? new Date(startsAt.getTime() + 2 * 60 * 60 * 1000);
  if (now < startsAt) return 'upcoming';
  if (now > end) return 'past';
  return 'live';
}

export function pickFeaturedSession(
  sessions: SerializedLiveSession[],
  now = new Date()
): SerializedLiveSession | null {
  const live = sessions.find((s) => s.status === 'live');
  if (live) return live;
  const upcoming = sessions
    .filter((s) => s.status === 'upcoming')
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  return upcoming[0] ?? null;
}

export function formatSessionWhen(iso: string, locale = 'es'): string {
  try {
    return new Date(iso).toLocaleString(locale, {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}
