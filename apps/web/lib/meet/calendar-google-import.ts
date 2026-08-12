import 'server-only';

import { getGoogleCalendarAccessToken } from '@/lib/meet/calendar-google';
import { upsertExternalCalendarMeetSession } from '@/lib/meet/create-session';

const GOOGLE_CALENDAR_EVENTS = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';

export type GoogleCalendarListedEvent = {
  id: string;
  title: string;
  description: string | null;
  htmlLink: string | null;
  scheduledAt: Date;
  endsAt: Date;
  conferenceUrl: string | null;
};

function extractUrlFromText(text: string): string | null {
  const match = text.match(
    /https?:\/\/(?:[\w.-]+\.)?(?:zoom\.us|teams\.microsoft\.com|meet\.google\.com|meet\.etholys\.com)[^\s<>"']+/i,
  );
  return match?.[0]?.replace(/[.,;)]+$/, '') || null;
}

function conferenceUrlFromGoogleEvent(event: {
  hangoutLink?: string;
  location?: string;
  description?: string;
  conferenceData?: { entryPoints?: Array<{ entryPointType?: string; uri?: string }> };
}): string | null {
  if (event.hangoutLink?.trim()) return event.hangoutLink.trim();
  const video = event.conferenceData?.entryPoints?.find(
    (entry) => entry.entryPointType === 'video' && entry.uri,
  );
  if (video?.uri) return video.uri;
  if (event.location && /^https?:\/\//i.test(event.location.trim())) {
    return event.location.trim();
  }
  if (event.location) {
    const fromLocation = extractUrlFromText(event.location);
    if (fromLocation) return fromLocation;
  }
  if (event.description) {
    const fromDescription = extractUrlFromText(event.description);
    if (fromDescription) return fromDescription;
  }
  return null;
}

export function googleMeetRoomSlug(googleEventId: string): string {
  const safe = googleEventId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 48);
  return `gcal-${safe || 'event'}`;
}

export function isGoogleImportedMeetRoomSlug(roomSlug?: string | null): boolean {
  return Boolean(roomSlug?.startsWith('gcal-'));
}

export async function listGoogleCalendarEvents(
  userId: string,
  opts?: { timeMin?: Date; timeMax?: Date; maxResults?: number },
): Promise<GoogleCalendarListedEvent[]> {
  const { accessToken, needsReconnect, connected } = await getGoogleCalendarAccessToken(userId);
  if (!connected || needsReconnect || !accessToken) {
    throw new Error(
      'Google Calendar não ligado. Liga o Google Calendar no Meet (scope calendar.events).',
    );
  }

  const timeMin = opts?.timeMin ?? new Date(Date.now() - 7 * 86_400_000);
  const timeMax = opts?.timeMax ?? new Date(Date.now() + 21 * 86_400_000);
  const url = new URL(GOOGLE_CALENDAR_EVENTS);
  url.searchParams.set('singleEvents', 'true');
  url.searchParams.set('orderBy', 'startTime');
  url.searchParams.set('timeMin', timeMin.toISOString());
  url.searchParams.set('timeMax', timeMax.toISOString());
  url.searchParams.set('maxResults', String(Math.min(250, Math.max(1, opts?.maxResults ?? 120))));

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`Google Calendar list (${res.status}): ${t.slice(0, 300)}`);
  }

  const data = (await res.json()) as {
    items?: Array<{
      id?: string;
      status?: string;
      summary?: string;
      description?: string;
      htmlLink?: string;
      hangoutLink?: string;
      location?: string;
      conferenceData?: { entryPoints?: Array<{ entryPointType?: string; uri?: string }> };
      start?: { dateTime?: string; date?: string };
      end?: { dateTime?: string; date?: string };
    }>;
  };

  const rows: GoogleCalendarListedEvent[] = [];
  for (const item of data.items || []) {
    if (!item.id || item.status === 'cancelled') continue;
    const startRaw = item.start?.dateTime || item.start?.date;
    const endRaw = item.end?.dateTime || item.end?.date;
    if (!startRaw) continue;
    const scheduledAt = new Date(startRaw);
    let endsAt = endRaw ? new Date(endRaw) : new Date(scheduledAt.getTime() + 60 * 60_000);
    // Eventos all-day: Google manda date (sem hora); trata como dia civil
    if (!item.start?.dateTime && item.start?.date) {
      scheduledAt.setHours(9, 0, 0, 0);
      endsAt = new Date(scheduledAt.getTime() + 60 * 60_000);
    }
    if (!Number.isFinite(scheduledAt.getTime())) continue;
    if (!Number.isFinite(endsAt.getTime()) || endsAt <= scheduledAt) {
      endsAt = new Date(scheduledAt.getTime() + 60 * 60_000);
    }
    rows.push({
      id: item.id,
      title: (item.summary || 'Sem título').trim().slice(0, 200),
      description: item.description?.trim() || null,
      htmlLink: item.htmlLink || null,
      scheduledAt,
      endsAt,
      conferenceUrl: conferenceUrlFromGoogleEvent(item),
    });
  }
  return rows;
}

export async function importGoogleCalendarIntoMeet(opts: {
  companyId: string;
  userId: string;
  timeMin?: Date;
  timeMax?: Date;
}): Promise<{ imported: number; updated: number; skipped: number; sessionIds: string[] }> {
  const events = await listGoogleCalendarEvents(opts.userId, {
    timeMin: opts.timeMin,
    timeMax: opts.timeMax,
  });

  let imported = 0;
  let updated = 0;
  let skipped = 0;
  const sessionIds: string[] = [];

  for (const event of events) {
    // Ignorar eventos que já são salas Etholys Meet (evitar eco do sync de saída)
    if (event.conferenceUrl && /meet\.etholys\.com/i.test(event.conferenceUrl)) {
      skipped += 1;
      continue;
    }
    const descriptionParts = [
      event.description,
      event.htmlLink ? `Google Calendar: ${event.htmlLink}` : null,
      event.conferenceUrl ? `Link da reunião: ${event.conferenceUrl}` : null,
    ].filter(Boolean);

    const result = await upsertExternalCalendarMeetSession({
      companyId: opts.companyId,
      createdById: opts.userId,
      roomSlug: googleMeetRoomSlug(event.id),
      title: event.title,
      description: descriptionParts.join('\n\n') || null,
      scheduledAt: event.scheduledAt,
      endsAt: event.endsAt,
      meetingUrl: event.conferenceUrl,
    });
    sessionIds.push(result.session.id);
    if (result.created) imported += 1;
    else updated += 1;
  }

  return { imported, updated, skipped, sessionIds };
}
