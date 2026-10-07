import 'server-only';

import { randomUUID } from 'crypto';
import { prisma } from '@/lib/prisma';
import {
  createGoogleCalendarEvent,
  formatGoogleCalendarDateTime,
  getGoogleCalendarAccessToken,
  googleCalendarMasterEventId,
  patchGoogleCalendarEvent,
  type MeetCalendarEventInput,
} from '@/lib/meet/calendar-google';
import { upsertExternalCalendarMeetSession, collectMeetGuestEmails } from '@/lib/meet/create-session';
import { meetRecurrenceToRrule, isMeetRecurrenceFrequency } from '@/lib/meet/recurrence';
import { meetPublicJoinUrl } from '@/lib/meet/types';

export function googleMeetRoomSlug(googleEventId: string): string {
  const safe = googleEventId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 48);
  return `gcal-${safe || 'event'}`;
}

const GOOGLE_CALENDAR_EVENTS = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';
const GOOGLE_CALENDAR_WATCH = 'https://www.googleapis.com/calendar/v3/calendars/primary/events/watch';

export type GoogleListedEvent = {
  id: string;
  status?: string;
  title: string;
  description: string | null;
  htmlLink: string | null;
  scheduledAt: Date;
  endsAt: Date;
  conferenceUrl: string | null;
  /** true se o utilizador autenticado é o organizador do evento Google */
  organizerSelf: boolean;
  organizerEmail: string | null;
};

function googleEventIdsRelated(a: string, b: string): boolean {
  if (a === b) return true;
  const ma = googleCalendarMasterEventId(a);
  const mb = googleCalendarMasterEventId(b);
  return ma === mb || ma === b || a === mb;
}

function extractUrlFromText(text: string): string | null {
  const match = text.match(
    /https?:\/\/(?:[\w.-]+\.)?(?:zoom\.us|teams\.microsoft\.com|meet\.google\.com|meet\.etholys\.com)[^\s<>"']+/i,
  );
  return match?.[0]?.replace(/[.,;)]+$/, '') || null;
}

function normalizeMeetingUrl(url: string): string {
  return url.trim().replace(/\/+$/, '');
}

/** Extrai o slug da sala CHORUS a partir de meet.etholys.com/… */
export function chorusRoomSlugFromMeetingUrl(url: string): string | null {
  try {
    const parsed = new URL(url.trim());
    if (!/meet\.etholys\.com$/i.test(parsed.hostname)) return null;
    const slug = decodeURIComponent(parsed.pathname.replace(/^\/+/, ''))
      .split('/')[0]
      ?.trim();
    return slug || null;
  } catch {
    return null;
  }
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

function parseGoogleItem(item: {
  id?: string;
  status?: string;
  summary?: string;
  description?: string;
  htmlLink?: string;
  hangoutLink?: string;
  location?: string;
  conferenceData?: { entryPoints?: Array<{ entryPointType?: string; uri?: string }> };
  organizer?: { email?: string; self?: boolean };
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
}): GoogleListedEvent | null {
  if (!item.id) return null;
  const startRaw = item.start?.dateTime || item.start?.date;
  const endRaw = item.end?.dateTime || item.end?.date;
  if (!startRaw && item.status !== 'cancelled') return null;
  const scheduledAt = startRaw ? new Date(startRaw) : new Date();
  let endsAt = endRaw ? new Date(endRaw) : new Date(scheduledAt.getTime() + 60 * 60_000);
  if (!item.start?.dateTime && item.start?.date) {
    scheduledAt.setHours(9, 0, 0, 0);
    endsAt = new Date(scheduledAt.getTime() + 60 * 60_000);
  }
  if (!Number.isFinite(scheduledAt.getTime())) return null;
  if (!Number.isFinite(endsAt.getTime()) || endsAt <= scheduledAt) {
    endsAt = new Date(scheduledAt.getTime() + 60 * 60_000);
  }
  return {
    id: item.id,
    status: item.status,
    title: (item.summary || 'Sem título').trim().slice(0, 200),
    description: item.description?.trim() || null,
    htmlLink: item.htmlLink || null,
    scheduledAt,
    endsAt,
    conferenceUrl: conferenceUrlFromGoogleEvent(item),
    organizerSelf: Boolean(item.organizer?.self),
    organizerEmail: item.organizer?.email?.trim().toLowerCase() || null,
  };
}

function publicAppBaseUrl(): string {
  const raw =
    process.env.NEXTAUTH_URL?.trim() ||
    process.env.APP_URL?.trim() ||
    'https://app.etholys.com';
  return raw.replace(/\/$/, '');
}

async function ensureSyncRow(userId: string, companyId: string) {
  const client = prisma as unknown as {
    meetGoogleCalendarSync?: {
      upsert: (args: {
        where: { userId: string };
        create: { userId: string; companyId: string };
        update: { companyId: string };
      }) => Promise<{
        id: string;
        userId: string;
        companyId: string | null;
        syncToken: string | null;
        watchChannelId: string | null;
        watchResourceId: string | null;
        watchExpiration: Date | null;
        lastSyncedAt: Date | null;
        lastError: string | null;
      }>;
    };
  };
  if (!client.meetGoogleCalendarSync?.upsert) {
    throw new Error(
      'Sync Google indisponível: o cliente da base de dados está desactualizado (MeetGoogleCalendarSync). Redeploy da app web.',
    );
  }
  return client.meetGoogleCalendarSync.upsert({
    where: { userId },
    create: { userId, companyId },
    update: { companyId },
  });
}

type ListPage = {
  events: GoogleListedEvent[];
  nextPageToken?: string;
  nextSyncToken?: string;
};

async function listGoogleEventsPage(opts: {
  accessToken: string;
  syncToken?: string | null;
  pageToken?: string;
}): Promise<ListPage> {
  const url = new URL(GOOGLE_CALENDAR_EVENTS);
  url.searchParams.set('maxResults', '250');
  url.searchParams.set('showDeleted', 'true');

  if (opts.syncToken) {
    url.searchParams.set('syncToken', opts.syncToken);
  } else {
    // 1.º sync: intervalo vasto + paginação (API exige timeMin com singleEvents)
    const timeMin = new Date();
    timeMin.setFullYear(timeMin.getFullYear() - 10);
    const timeMax = new Date();
    timeMax.setFullYear(timeMax.getFullYear() + 5);
    url.searchParams.set('singleEvents', 'true');
    url.searchParams.set('orderBy', 'startTime');
    url.searchParams.set('timeMin', timeMin.toISOString());
    url.searchParams.set('timeMax', timeMax.toISOString());
  }
  if (opts.pageToken) url.searchParams.set('pageToken', opts.pageToken);

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${opts.accessToken}` },
  });
  if (res.status === 410) {
    const err = new Error('SYNC_TOKEN_INVALID') as Error & { code?: string };
    err.code = 'SYNC_TOKEN_INVALID';
    throw err;
  }
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`Google Calendar list (${res.status}): ${t.slice(0, 300)}`);
  }
  const data = (await res.json()) as {
    items?: Array<Parameters<typeof parseGoogleItem>[0]>;
    nextPageToken?: string;
    nextSyncToken?: string;
  };
  const events: GoogleListedEvent[] = [];
  for (const item of data.items || []) {
    const parsed = parseGoogleItem(item);
    if (parsed) events.push(parsed);
  }
  return {
    events,
    nextPageToken: data.nextPageToken,
    nextSyncToken: data.nextSyncToken,
  };
}

async function applyGoogleEventToChorus(opts: {
  companyId: string;
  userId: string;
  event: GoogleListedEvent;
}): Promise<'imported' | 'updated' | 'cancelled' | 'skipped' | 'purged'> {
  const { event, companyId, userId } = opts;

  const existingByGoogle = await prisma.meetSession.findFirst({
    where: {
      OR: [
        { googleCalendarEventId: event.id },
        { googleCalendarEventId: googleCalendarMasterEventId(event.id) },
      ],
    },
    select: {
      id: true,
      companyId: true,
      googleCalendarEventId: true,
      meetingUrl: true,
      roomSlug: true,
      status: true,
    },
  });

  if (event.status === 'cancelled') {
    if (existingByGoogle) {
      await prisma.meetSession.update({
        where: { id: existingByGoogle.id },
        data: { status: 'cancelled' },
      });
      return 'cancelled';
    }
    const bySlug = await prisma.meetSession.findFirst({
      where: { companyId, roomSlug: googleMeetRoomSlug(event.id) },
      select: { id: true },
    });
    if (bySlug) {
      await prisma.meetSession.update({
        where: { id: bySlug.id },
        data: { status: 'cancelled' },
      });
      return 'cancelled';
    }
    return 'skipped';
  }

  // Evento com link CHORUS (convite aceite / eco do push): ligar à sessão existente
  // ou criar entrada no hub — NUNCA ignorar, senão o convite some do calendário Etholys.
  if (event.conferenceUrl && /meet\.etholys\.com/i.test(event.conferenceUrl)) {
    const meetingUrl = normalizeMeetingUrl(event.conferenceUrl);
    const roomSlug = chorusRoomSlugFromMeetingUrl(meetingUrl);

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });
    const userEmail = user?.email?.trim().toLowerCase() || '';
    const isOrganizer =
      event.organizerSelf ||
      Boolean(userEmail && event.organizerEmail && userEmail === event.organizerEmail);

    const byRoom = await prisma.meetSession.findFirst({
      where: {
        companyId,
        OR: [
          { meetingUrl },
          { meetingUrl: event.conferenceUrl.trim() },
          ...(roomSlug
            ? [{ roomSlug }, { meetingUrl: { contains: roomSlug } }]
            : []),
        ],
      },
      select: { id: true, googleCalendarEventId: true, status: true },
      orderBy: { createdAt: 'asc' },
    });

    const linked = existingByGoogle || byRoom;

    // Organizador: reunião apagada / cancelada no CHORUS → limpar Google (não recriar).
    if (isOrganizer) {
      if (!linked || linked.status === 'cancelled') {
        await deleteGoogleCalendarEvent(userId, event.id);
        const master = googleCalendarMasterEventId(event.id);
        if (master !== event.id) {
          await deleteGoogleCalendarEvent(userId, master).catch(() => undefined);
        }
        return 'purged';
      }
      if (
        linked.googleCalendarEventId &&
        !googleEventIdsRelated(linked.googleCalendarEventId, event.id)
      ) {
        await deleteGoogleCalendarEvent(userId, event.id);
        return 'purged';
      }
    } else if (linked?.status === 'cancelled') {
      // Convidado: não ressuscitar sessão cancelada no tenant
      return 'skipped';
    }

    if (existingByGoogle) {
      if (existingByGoogle.status === 'cancelled') {
        if (isOrganizer) {
          await deleteGoogleCalendarEvent(userId, event.id);
          return 'purged';
        }
        return 'skipped';
      }
      await prisma.meetSession.update({
        where: { id: existingByGoogle.id },
        data: {
          title: event.title,
          scheduledAt: event.scheduledAt,
          endsAt: event.endsAt,
          meetingUrl,
          ...(roomSlug ? { roomSlug } : {}),
          googleCalendarHtmlLink: event.htmlLink,
          status: event.endsAt.getTime() < Date.now() ? 'ended' : 'scheduled',
        },
      });
      return 'updated';
    }

    if (byRoom && byRoom.status !== 'cancelled') {
      await prisma.meetSession.update({
        where: { id: byRoom.id },
        data: {
          googleCalendarEventId: event.id,
          googleCalendarHtmlLink: event.htmlLink,
          title: event.title,
          scheduledAt: event.scheduledAt,
          endsAt: event.endsAt,
          meetingUrl,
          status: event.endsAt.getTime() < Date.now() ? 'ended' : 'scheduled',
        },
      });
      // Quem sincroniza o convite passa a constar como convidado (se ainda não estiver).
      const already = await prisma.meetParticipant.findFirst({
        where: { sessionId: byRoom.id, userId },
        select: { id: true },
      });
      if (!already) {
        await prisma.meetParticipant.create({
          data: { sessionId: byRoom.id, userId, role: 'guest' },
        }).catch(() => undefined);
      }
      return 'updated';
    }

    // Organizador sem sessão activa: nunca recriar a partir do Google.
    if (isOrganizer) {
      await deleteGoogleCalendarEvent(userId, event.id);
      return 'purged';
    }

    const result = await upsertExternalCalendarMeetSession({
      companyId,
      createdById: userId,
      roomSlug: roomSlug || googleMeetRoomSlug(event.id),
      title: event.title,
      description: event.description,
      scheduledAt: event.scheduledAt,
      endsAt: event.endsAt,
      meetingUrl,
    });
    await prisma.meetSession.update({
      where: { id: result.session.id },
      data: {
        googleCalendarEventId: event.id,
        googleCalendarHtmlLink: event.htmlLink,
      },
    });
    return result.created ? 'imported' : 'updated';
  }

  const descriptionParts = [
    event.description,
    event.htmlLink ? `Google Calendar: ${event.htmlLink}` : null,
    event.conferenceUrl ? `Link da reunião: ${event.conferenceUrl}` : null,
  ].filter(Boolean);

  if (existingByGoogle) {
    await prisma.meetSession.update({
      where: { id: existingByGoogle.id },
      data: {
        title: event.title,
        description: descriptionParts.join('\n\n') || null,
        scheduledAt: event.scheduledAt,
        endsAt: event.endsAt,
        status: event.endsAt.getTime() < Date.now() ? 'ended' : 'scheduled',
        googleCalendarHtmlLink: event.htmlLink,
        ...(event.conferenceUrl ? { meetingUrl: event.conferenceUrl } : {}),
      },
    });
    return 'updated';
  }

  const result = await upsertExternalCalendarMeetSession({
    companyId,
    createdById: userId,
    roomSlug: googleMeetRoomSlug(event.id),
    title: event.title,
    description: descriptionParts.join('\n\n') || null,
    scheduledAt: event.scheduledAt,
    endsAt: event.endsAt,
    meetingUrl: event.conferenceUrl,
  });
  await prisma.meetSession.update({
    where: { id: result.session.id },
    data: {
      googleCalendarEventId: event.id,
      googleCalendarHtmlLink: event.htmlLink,
    },
  });
  return result.created ? 'imported' : 'updated';
}

async function ensureGoogleWatch(opts: {
  userId: string;
  accessToken: string;
  syncRowId: string;
  channelId?: string | null;
  expiration?: Date | null;
}) {
  const needsNew =
    !opts.channelId ||
    !opts.expiration ||
    opts.expiration.getTime() < Date.now() + 24 * 86_400_000;
  if (!needsNew) return;

  if (opts.channelId) {
    await fetch('https://www.googleapis.com/calendar/v3/channels/stop', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${opts.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        id: opts.channelId,
        resourceId: (
          await prisma.meetGoogleCalendarSync.findUnique({
            where: { id: opts.syncRowId },
            select: { watchResourceId: true },
          })
        )?.watchResourceId,
      }),
    }).catch(() => undefined);
  }

  const channelId = randomUUID();
  const address = `${publicAppBaseUrl()}/api/meet/calendar/google/webhook`;
  const res = await fetch(GOOGLE_CALENDAR_WATCH, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${opts.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      id: channelId,
      type: 'web_hook',
      address,
      // ~7 dias (máx. típico Google)
      expiration: String(Date.now() + 6 * 86_400_000),
    }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    console.warn('[meet/gcal-watch]', res.status, t.slice(0, 200));
    return;
  }
  const data = (await res.json()) as {
    id?: string;
    resourceId?: string;
    expiration?: string;
  };
  await prisma.meetGoogleCalendarSync.update({
    where: { id: opts.syncRowId },
    data: {
      watchChannelId: data.id || channelId,
      watchResourceId: data.resourceId || null,
      watchExpiration: data.expiration ? new Date(Number(data.expiration)) : null,
    },
  });
}

/**
 * Sync completa/incremental Google primary → CHORUS (sem janela curta).
 * Após o 1.º sync usa syncToken = alterações contínuas (criar/editar/apagar).
 */
export async function syncGoogleCalendarBidirectional(opts: {
  userId: string;
  companyId: string;
  /** Ignora syncToken e volta a ler o calendário completo (necessário após mudanças de lógica). */
  forceFull?: boolean;
}): Promise<{
  imported: number;
  updated: number;
  cancelled: number;
  skipped: number;
  purged: number;
  mode: 'full' | 'incremental';
}> {
  const { accessToken, connected, needsReconnect } = await getGoogleCalendarAccessToken(
    opts.userId,
  );
  if (!connected || needsReconnect || !accessToken) {
    throw new Error(
      'Google Calendar não ligado. Liga o Google Calendar no CHORUS (permissão calendar.events).',
    );
  }

  const syncRow = await ensureSyncRow(opts.userId, opts.companyId);
  let syncToken = opts.forceFull ? null : syncRow.syncToken;
  if (opts.forceFull && syncRow.syncToken) {
    await prisma.meetGoogleCalendarSync.update({
      where: { id: syncRow.id },
      data: { syncToken: null },
    });
  }
  let mode: 'full' | 'incremental' = syncToken ? 'incremental' : 'full';
  let imported = 0;
  let updated = 0;
  let cancelled = 0;
  let skipped = 0;
  let purged = 0;
  let nextSyncToken: string | undefined;

  const runPages = async (token: string | null) => {
    let pageToken: string | undefined;
    do {
      const page = await listGoogleEventsPage({
        accessToken,
        syncToken: token,
        pageToken,
      });
      for (const event of page.events) {
        try {
          const r = await applyGoogleEventToChorus({
            companyId: opts.companyId,
            userId: opts.userId,
            event,
          });
          if (r === 'imported') imported += 1;
          else if (r === 'updated') updated += 1;
          else if (r === 'cancelled') cancelled += 1;
          else if (r === 'purged') purged += 1;
          else skipped += 1;
        } catch (err) {
          console.warn('[meet/gcal-sync] apply', event.id, err);
          skipped += 1;
        }
      }
      pageToken = page.nextPageToken;
      if (page.nextSyncToken) nextSyncToken = page.nextSyncToken;
    } while (pageToken);
  };

  try {
    await runPages(syncToken);
  } catch (err) {
    const invalid =
      err instanceof Error &&
      ((err as Error & { code?: string }).code === 'SYNC_TOKEN_INVALID' ||
        /SYNC_TOKEN_INVALID/.test(err.message));
    if (!invalid) {
      await prisma.meetGoogleCalendarSync.update({
        where: { id: syncRow.id },
        data: { lastError: err instanceof Error ? err.message.slice(0, 500) : 'sync failed' },
      });
      throw err;
    }
    syncToken = null;
    mode = 'full';
    imported = 0;
    updated = 0;
    cancelled = 0;
    skipped = 0;
    purged = 0;
    nextSyncToken = undefined;
    await prisma.meetGoogleCalendarSync.update({
      where: { id: syncRow.id },
      data: { syncToken: null },
    });
    await runPages(null);
  }

  await prisma.meetGoogleCalendarSync.update({
    where: { id: syncRow.id },
    data: {
      syncToken: nextSyncToken || syncToken,
      lastSyncedAt: new Date(),
      lastError: null,
      companyId: opts.companyId,
    },
  });

  const fresh = await prisma.meetGoogleCalendarSync.findUniqueOrThrow({
    where: { id: syncRow.id },
  });
  await ensureGoogleWatch({
    userId: opts.userId,
    accessToken,
    syncRowId: fresh.id,
    channelId: fresh.watchChannelId,
    expiration: fresh.watchExpiration,
  });

  return { imported, updated, cancelled, skipped, purged, mode };
}

export async function syncGoogleCalendarByWatchChannel(channelId: string): Promise<void> {
  const row = await prisma.meetGoogleCalendarSync.findFirst({
    where: { watchChannelId: channelId },
  });
  if (!row?.companyId) return;
  await syncGoogleCalendarBidirectional({ userId: row.userId, companyId: row.companyId });
}

export async function pollAllGoogleCalendarSyncs(): Promise<{ users: number; errors: number }> {
  const rows = await prisma.meetGoogleCalendarSync.findMany({
    where: { companyId: { not: null } },
    select: { userId: true, companyId: true },
    take: 200,
  });
  let errors = 0;
  for (const row of rows) {
    if (!row.companyId) continue;
    try {
      await syncGoogleCalendarBidirectional({
        userId: row.userId,
        companyId: row.companyId,
      });
    } catch (err) {
      errors += 1;
      console.warn('[meet/gcal-poll]', row.userId, err);
    }
  }
  return { users: rows.length, errors };
}

export async function updateGoogleCalendarEvent(
  userId: string,
  eventId: string,
  event: MeetCalendarEventInput,
): Promise<void> {
  const { accessToken, needsReconnect, connected } = await getGoogleCalendarAccessToken(userId);
  if (!connected || needsReconnect || !accessToken) return;

  const timeZone = event.timeZone?.trim() || 'UTC';
  const body: Record<string, unknown> = {
    summary: event.title,
    description: event.description || undefined,
    location: event.locationUrl || undefined,
    start: formatGoogleCalendarDateTime(event.startsAt, timeZone),
    end: formatGoogleCalendarDateTime(event.endsAt, timeZone),
  };
  const res = await fetch(`${GOOGLE_CALENDAR_EVENTS}/${encodeURIComponent(eventId)}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    console.warn('[meet/gcal-update]', res.status, t.slice(0, 200));
  }
}

export async function deleteGoogleCalendarEvent(userId: string, eventId: string): Promise<void> {
  const { accessToken, needsReconnect, connected } = await getGoogleCalendarAccessToken(userId);
  if (!connected || needsReconnect || !accessToken) return;
  const res = await fetch(
    `${GOOGLE_CALENDAR_EVENTS}/${encodeURIComponent(eventId)}?sendUpdates=none`,
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );
  if (!res.ok && res.status !== 404 && res.status !== 410) {
    const t = await res.text().catch(() => '');
    console.warn('[meet/gcal-delete]', res.status, t.slice(0, 200));
  }
}

/** CHORUS → Google: cria ou actualiza o evento ligado (série = mestre). */
export async function pushMeetSessionToGoogle(opts: {
  userId: string;
  sessionId: string;
  timeZone?: string;
  /** Enviar actualização Google aos convidados (sendUpdates=all). */
  notifyAttendees?: boolean;
}): Promise<{ ok: boolean; eventId?: string; skipped?: string }> {
  const raw = await prisma.meetSession.findUnique({
    where: { id: opts.sessionId },
    include: {
      createdBy: { select: { email: true } },
      participants: {
        select: { email: true, role: true, user: { select: { email: true } } },
      },
    },
  });
  if (!raw) return { ok: false, skipped: 'missing' };

  // Séries: o evento Google vive no mestre (RRULE). Filhos sem ID não devem criar cópias.
  const masterId = raw.seriesParentId || raw.seriesId || raw.id;
  const session =
    masterId === raw.id
      ? raw
      : (await prisma.meetSession.findUnique({
          where: { id: masterId },
          include: {
            createdBy: { select: { email: true } },
            participants: {
              select: { email: true, role: true, user: { select: { email: true } } },
            },
          },
        })) || raw;

  if (session.isPermanent || !session.scheduledAt) {
    return { ok: false, skipped: 'unscheduled' };
  }
  if (session.status === 'cancelled') {
    if (session.googleCalendarEventId) {
      await deleteGoogleCalendarEvent(opts.userId, session.googleCalendarEventId);
      await prisma.meetSession.update({
        where: { id: session.id },
        data: { googleCalendarEventId: null, googleCalendarHtmlLink: null },
      });
    }
    return { ok: true, skipped: 'cancelled' };
  }

  const endsAt =
    session.endsAt && session.endsAt > session.scheduledAt
      ? session.endsAt
      : new Date(session.scheduledAt.getTime() + 60 * 60_000);

  const notify = Boolean(opts.notifyAttendees);
  const organizerEmail = (session.createdBy?.email || '').trim().toLowerCase();
  const attendeeEmails = notify
    ? collectMeetGuestEmails(session.participants).filter((email) => email !== organizerEmail)
    : [];

  const recurrence =
    session.recurrence && isMeetRecurrenceFrequency(session.recurrence)
      ? session.recurrence
      : 'none';
  const recurrenceRule = meetRecurrenceToRrule(recurrence, session.recurrenceUntil);

  // Convite Google → Hub CHORUS (conta + host). meetingUrl da sala fica só no embed.
  const joinUrl = meetPublicJoinUrl(session.id, session.companyId);
  const eventInput: MeetCalendarEventInput = {
    title: session.title,
    description: [session.description, joinUrl].filter(Boolean).join('\n\n') || undefined,
    locationUrl: joinUrl,
    startsAt: session.scheduledAt,
    endsAt,
    timeZone: opts.timeZone || 'UTC',
    attendeeEmails,
    notifyAttendees: notify,
    recurrenceRule: recurrence !== 'none' ? recurrenceRule : null,
  };

  // Preferir ID Google do mestre; se só o filho tiver, usar esse.
  const googleId = session.googleCalendarEventId || raw.googleCalendarEventId;

  if (googleId) {
    try {
      const patched = await patchGoogleCalendarEvent(opts.userId, googleId, eventInput);
      if (session.id !== raw.id || !session.googleCalendarEventId) {
        await prisma.meetSession.update({
          where: { id: session.id },
          data: {
            googleCalendarEventId: patched.id,
            googleCalendarHtmlLink: patched.htmlLink || null,
          },
        });
      }
      return { ok: true, eventId: patched.id };
    } catch (err) {
      console.warn('[meet/gcal-push] patch failed, recreating', err);
    }
  }

  try {
    const created = await createGoogleCalendarEvent(opts.userId, eventInput);
    await prisma.meetSession.update({
      where: { id: session.id },
      data: {
        googleCalendarEventId: created.id,
        googleCalendarHtmlLink: created.htmlLink || null,
      },
    });
    return { ok: true, eventId: created.id };
  } catch (err) {
    console.warn('[meet/gcal-push]', err);
    return { ok: false, skipped: err instanceof Error ? err.message : 'push_failed' };
  }
}
