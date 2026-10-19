import 'server-only';

import { getGoogleCalendarAccessToken } from '@/lib/meet/calendar-google';
import { syncGoogleCalendarBidirectional } from '@/lib/meet/calendar-google-sync';
import { addDaysYmd } from '@/lib/meet/booking-slots';
import type { AgendaBusyGoogleEvent, GoogleBusyFetch } from '@/lib/meet/agenda-busy';

export { googleMeetRoomSlug } from '@/lib/meet/calendar-google-sync';

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

export function isGoogleImportedMeetRoomSlug(roomSlug?: string | null): boolean {
  return Boolean(roomSlug?.startsWith('gcal-'));
}

/** Listagem pontual (UI/debug). Sync real: syncGoogleCalendarBidirectional. */
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

  const timeMin = opts?.timeMin ?? new Date(Date.now() - 90 * 86_400_000);
  const timeMax = opts?.timeMax ?? new Date(Date.now() + 30 * 86_400_000);
  const url = new URL(GOOGLE_CALENDAR_EVENTS);
  url.searchParams.set('singleEvents', 'true');
  url.searchParams.set('orderBy', 'startTime');
  url.searchParams.set('timeMin', timeMin.toISOString());
  url.searchParams.set('timeMax', timeMax.toISOString());
  url.searchParams.set('maxResults', String(Math.min(250, Math.max(1, opts?.maxResults ?? 250))));

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

type GoogleAgendaItem = {
  id?: string;
  status?: string;
  summary?: string;
  description?: string;
  htmlLink?: string;
  hangoutLink?: string;
  location?: string;
  transparency?: string;
  eventType?: string;
  attendees?: Array<{ self?: boolean; responseStatus?: string }>;
  conferenceData?: { entryPoints?: Array<{ entryPointType?: string; uri?: string }> };
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
};

function agendaEventUrls(item: GoogleAgendaItem): string[] {
  const urls = new Set<string>();
  const conference = conferenceUrlFromGoogleEvent(item);
  if (conference) urls.add(conference);
  for (const text of [item.location, item.description, item.hangoutLink]) {
    if (!text) continue;
    const found = text.match(/https?:\/\/[^\s<>"']+/gi) || [];
    for (const url of found) urls.add(url.replace(/[.,;)]+$/, ''));
  }
  return [...urls];
}

/**
 * Eventos do calendário Google no intervalo visível.
 * `off` se a conta não está ligada. `error` se o Google falhou — a agenda segue com o CHORUS.
 */
export async function listAgendaGoogleEvents(
  userId: string,
  timeMin: Date,
  timeMax: Date,
): Promise<GoogleBusyFetch> {
  try {
    const { accessToken, needsReconnect, connected } = await getGoogleCalendarAccessToken(userId);
    if (!connected || needsReconnect || !accessToken) return { state: 'off', events: [] };

    const rows: AgendaBusyGoogleEvent[] = [];
    let pageToken = '';
    for (let page = 0; page < 4; page += 1) {
      const url = new URL(GOOGLE_CALENDAR_EVENTS);
      url.searchParams.set('singleEvents', 'true');
      url.searchParams.set('orderBy', 'startTime');
      url.searchParams.set('timeMin', timeMin.toISOString());
      url.searchParams.set('timeMax', timeMax.toISOString());
      url.searchParams.set('maxResults', '250');
      if (pageToken) url.searchParams.set('pageToken', pageToken);

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) {
        console.warn('[chorus/agenda] google list', res.status);
        return { state: 'error', events: [] };
      }
      const data = (await res.json()) as { items?: GoogleAgendaItem[]; nextPageToken?: string };
      for (const item of data.items || []) {
        const mapped = mapAgendaGoogleItem(item);
        if (mapped) rows.push(mapped);
      }
      if (!data.nextPageToken) break;
      pageToken = data.nextPageToken;
    }
    return { state: 'ok', events: rows };
  } catch (error) {
    console.warn('[chorus/agenda] google busy', error instanceof Error ? error.message : error);
    return { state: 'error', events: [] };
  }
}

function mapAgendaGoogleItem(item: GoogleAgendaItem): AgendaBusyGoogleEvent | null {
  if (!item.id || item.status === 'cancelled') return null;
  if (item.transparency === 'transparent') return null;
  if (item.eventType === 'birthday' || item.eventType === 'workingLocation') return null;
  const self = item.attendees?.find((attendee) => attendee.self);
  if (self?.responseStatus === 'declined') return null;

  const title = (item.summary || '').trim().slice(0, 200);
  const urls = agendaEventUrls(item);
  const allDay = Boolean(item.start?.date && !item.start?.dateTime);
  if (allDay && item.start?.date) {
    const startYmd = item.start.date;
    const endYmdExclusive = item.end?.date && item.end.date > startYmd ? item.end.date : addDaysYmd(startYmd, 1);
    return {
      id: item.id,
      title,
      allDay: true,
      startsAt: null,
      endsAt: null,
      startYmd,
      endYmdExclusive,
      urls,
    };
  }

  const startRaw = item.start?.dateTime;
  if (!startRaw) return null;
  const startsAt = new Date(startRaw);
  const endsAt = item.end?.dateTime ? new Date(item.end.dateTime) : new Date(startsAt.getTime() + 60 * 60_000);
  if (!Number.isFinite(startsAt.getTime()) || !Number.isFinite(endsAt.getTime()) || endsAt <= startsAt) return null;
  return {
    id: item.id,
    title,
    allDay: false,
    startsAt,
    endsAt,
    startYmd: null,
    endYmdExclusive: null,
    urls,
  };
}

/** Sync Google → CHORUS (incremental; sem janela artificial). */
export async function importGoogleCalendarIntoMeet(opts: {
  companyId: string;
  userId: string;
  timeMin?: Date;
  timeMax?: Date;
}): Promise<{ imported: number; updated: number; skipped: number; sessionIds: string[]; mode?: string }> {
  const result = await syncGoogleCalendarBidirectional({
    companyId: opts.companyId,
    userId: opts.userId,
  });
  return {
    imported: result.imported,
    updated: result.updated + result.cancelled,
    skipped: result.skipped,
    sessionIds: [],
    mode: result.mode,
  };
}
