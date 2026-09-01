import 'server-only';

import { prisma } from '@/lib/prisma';

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_CALENDAR_EVENTS = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';

export function isGoogleCalendarScope(scope: string | null | undefined): boolean {
  if (!scope) return false;
  return scope.includes('calendar.events') || scope.includes('calendar');
}

async function refreshGoogleAccessToken(refreshToken: string): Promise<{
  access_token: string;
  expires_at?: number;
}> {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    throw new Error('Google Calendar não está disponível neste momento.');
  }
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`Google token refresh falhou (${res.status}): ${t.slice(0, 200)}`);
  }
  const data = (await res.json()) as { access_token: string; expires_in?: number };
  return {
    access_token: data.access_token,
    expires_at: data.expires_in ? Math.floor(Date.now() / 1000) + data.expires_in : undefined,
  };
}

export async function getGoogleCalendarAccessToken(userId: string): Promise<{
  accessToken: string;
  connected: boolean;
  needsReconnect: boolean;
}> {
  const account = await prisma.account.findFirst({
    where: { userId, provider: 'google' },
  });
  if (!account?.access_token && !account?.refresh_token) {
    return { accessToken: '', connected: false, needsReconnect: true };
  }
  if (!isGoogleCalendarScope(account.scope)) {
    return { accessToken: '', connected: true, needsReconnect: true };
  }

  const expiresAt = account.expires_at ?? 0;
  const soon = Math.floor(Date.now() / 1000) + 60;
  if (account.access_token && expiresAt > soon) {
    return { accessToken: account.access_token, connected: true, needsReconnect: false };
  }

  if (!account.refresh_token) {
    return { accessToken: '', connected: true, needsReconnect: true };
  }

  const refreshed = await refreshGoogleAccessToken(account.refresh_token);
  await prisma.account.update({
    where: { id: account.id },
    data: {
      access_token: refreshed.access_token,
      expires_at: refreshed.expires_at ?? account.expires_at,
    },
  });
  return { accessToken: refreshed.access_token, connected: true, needsReconnect: false };
}

export type MeetCalendarEventInput = {
  title: string;
  description?: string;
  locationUrl?: string;
  startsAt: Date;
  endsAt: Date;
  /** IANA timezone, ex. America/Sao_Paulo — obrigatório para a API Google. */
  timeZone?: string;
  attendeeEmails?: string[];
  /** Enviar e-mail de convite do Google aos attendees (sendUpdates=all). */
  notifyAttendees?: boolean;
  /** RRULE sem prefixo RRULE: — ex. FREQ=WEEKLY;COUNT=12 */
  recurrenceRule?: string | null;
};

/** Formata instante como data/hora local da zona (sem offset), para Google Calendar. */
export function formatGoogleCalendarDateTime(
  date: Date,
  timeZone: string,
): { dateTime: string; timeZone: string } {
  const zone = timeZone.trim() || 'UTC';
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: zone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  const parts = formatter.formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value || '00';
  const dateTime = `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}:${get('second')}`;
  return { dateTime, timeZone: zone };
}

export async function createGoogleCalendarEvent(
  userId: string,
  event: MeetCalendarEventInput,
): Promise<{ htmlLink: string; id: string }> {
  const { accessToken, needsReconnect, connected } = await getGoogleCalendarAccessToken(userId);
  if (!connected || needsReconnect || !accessToken) {
    throw new Error(
      'Google Calendar não está ligado. Ligue a conta Google em Meet.',
    );
  }

  const timeZone = event.timeZone?.trim() || 'UTC';
  const body: Record<string, unknown> = {
    summary: event.title,
    description: event.description || undefined,
    location: event.locationUrl || undefined,
    start: formatGoogleCalendarDateTime(event.startsAt, timeZone),
    end: formatGoogleCalendarDateTime(event.endsAt, timeZone),
    attendees: event.attendeeEmails?.map((email) => ({ email })),
  };
  if (event.recurrenceRule) {
    body.recurrence = [`RRULE:${event.recurrenceRule}`];
  }

  const url = new URL(GOOGLE_CALENDAR_EVENTS);
  const shouldNotify =
    event.notifyAttendees !== false && Boolean(event.attendeeEmails?.length);
  if (shouldNotify) url.searchParams.set('sendUpdates', 'all');
  else url.searchParams.set('sendUpdates', 'none');
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`Google Calendar API (${res.status}): ${t.slice(0, 300)}`);
  }

  const data = (await res.json()) as { id: string; htmlLink?: string };
  return { id: data.id, htmlLink: data.htmlLink || '' };
}
