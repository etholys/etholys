import 'server-only';

import { randomBytes } from 'crypto';
import { prisma } from '@/lib/prisma';
import { createMeetSession } from '@/lib/meet/create-session';
import { pushMeetSessionToGoogle } from '@/lib/meet/calendar-google-sync';
import { createGoogleCalendarEvent } from '@/lib/meet/calendar-google';
import { buildMeetIcs } from '@/lib/meet/ics';
import { meetAppBaseUrl, meetPublicJoinUrl } from '@/lib/meet/types';
import { sendMeetInviteEmail } from '@/lib/meet/send-meet-email';
import {
  addDaysYmd,
  buildOpenSlots,
  clampSlotMinutes,
  DEFAULT_BOOKING_WINDOWS,
  normalizeBookingWindows,
  rangesOverlap,
  ymdInTimeZone,
  type BookingWindowInput,
  type BusyRange,
} from '@/lib/meet/booking-slots';
import { collectHolidayDays, type HolidayDay } from '@/lib/meet/holidays';
import { normalizeHolidayCountries } from '@/lib/meet/holiday-countries';
import { isValidTimeZone, meetWallTimeToUtc } from '@/lib/meet/timezone';
import { bookingCalendarLinks } from '@/lib/meet/booking-calendar';
import {
  bookingEmailHtml,
  bookingLocale,
  bookingWhen,
  sendChorusBookingEmail,
  type BookingLocale,
} from '@/lib/meet/send-booking-email';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const OPEN_STATUSES = ['pending', 'accepted', 'counter_proposed'] as const;

export class BookingError extends Error {
  code: string;
  constructor(code: string) {
    super(code);
    this.code = code;
  }
}

function publicCode(): string {
  return randomBytes(12).toString('base64url');
}

function publicToken(): string {
  return randomBytes(24).toString('base64url');
}

export function agendaPublicPath(code: string): string {
  return `/a/${code}`;
}

export function agendaStatusPath(code: string, token: string): string {
  return `/a/${code}/r/${token}`;
}

export function agendaPublicUrl(code: string): string {
  return `${meetAppBaseUrl()}${agendaPublicPath(code)}`;
}

export function agendaStatusUrl(code: string, token: string): string {
  return `${meetAppBaseUrl()}${agendaStatusPath(code, token)}`;
}

type Held = { startsAt: Date; endsAt: Date };

function heldInterval(row: {
  status: string;
  startsAt: Date;
  endsAt: Date;
  proposedStartsAt: Date | null;
  proposedEndsAt: Date | null;
}): Held | null {
  if (row.status === 'declined' || row.status === 'cancelled') return null;
  if (
    row.status === 'counter_proposed' &&
    row.proposedStartsAt &&
    row.proposedEndsAt &&
    row.proposedEndsAt > row.proposedStartsAt
  ) {
    return { startsAt: row.proposedStartsAt, endsAt: row.proposedEndsAt };
  }
  if (row.endsAt > row.startsAt) return { startsAt: row.startsAt, endsAt: row.endsAt };
  return null;
}

function pageInclude() {
  return {
    owner: { select: { id: true, name: true, email: true } },
    windows: { orderBy: { weekday: 'asc' as const } },
    blocks: { orderBy: { startsAt: 'asc' as const } },
  };
}

export async function ensureBookingPage(companyId: string, ownerId: string) {
  const existing = await prisma.meetBookingPage.findUnique({
    where: { companyId_ownerId: { companyId, ownerId } },
    include: pageInclude(),
  });
  if (existing) return existing;

  const owner = await prisma.user.findUnique({
    where: { id: ownerId },
    select: { name: true },
  });
  const title = owner?.name?.trim() ? `Agenda de ${owner.name.trim()}` : 'Agenda CHORUS';

  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      return await prisma.meetBookingPage.create({
        data: {
          companyId,
          ownerId,
          publicCode: publicCode(),
          title: title.slice(0, 160),
          timeZone: 'America/Sao_Paulo',
          slotMinutes: 30,
          allowVirtual: true,
          allowInPerson: true,
          windows: { create: DEFAULT_BOOKING_WINDOWS },
        },
        include: pageInclude(),
      });
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (code === 'P2002') {
        const again = await prisma.meetBookingPage.findUnique({
          where: { companyId_ownerId: { companyId, ownerId } },
          include: pageInclude(),
        });
        if (again) return again;
        if (attempt < 3) continue;
      }
      throw error;
    }
  }
  throw new BookingError('create_failed');
}

function busyRanges(
  blocks: { startsAt: Date; endsAt: Date }[],
  requests: {
    id?: string;
    status: string;
    startsAt: Date;
    endsAt: Date;
    proposedStartsAt: Date | null;
    proposedEndsAt: Date | null;
  }[],
  exceptRequestId?: string,
): BusyRange[] {
  const ranges: BusyRange[] = blocks
    .filter((block) => block.endsAt > block.startsAt)
    .map((block) => ({ startsAt: block.startsAt, endsAt: block.endsAt }));
  for (const request of requests) {
    if (exceptRequestId && request.id === exceptRequestId) continue;
    const held = heldInterval(request);
    if (held) ranges.push(held);
  }
  return ranges;
}

async function loadBusy(pageId: string, exceptRequestId?: string) {
  const [blocks, requests] = await Promise.all([
    prisma.meetBookingBlock.findMany({ where: { pageId } }),
    prisma.meetBookingRequest.findMany({
      where: { pageId, status: { in: [...OPEN_STATUSES] } },
    }),
  ]);
  return busyRanges(blocks, requests, exceptRequestId);
}

export async function getPublicAgenda(code: string) {
  const page = await prisma.meetBookingPage.findUnique({
    where: { publicCode: code },
    include: {
      owner: { select: { name: true } },
      windows: true,
    },
  });
  if (!page) return null;
  const busy = await loadBusy(page.id);
  const slots = buildOpenSlots({
    timeZone: page.timeZone,
    slotMinutes: page.slotMinutes,
    windows: page.windows,
    busy,
    days: 21,
  });
  return {
    page: {
      title: page.title,
      description: page.description,
      timeZone: page.timeZone,
      slotMinutes: page.slotMinutes,
      allowVirtual: page.allowVirtual,
      allowInPerson: page.allowInPerson,
      locationText: page.locationText,
      ownerName: page.owner.name,
    },
    slots,
  };
}

function parseGuests(raw: unknown, bookerEmail: string): { name: string | null; email: string }[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>([bookerEmail]);
  const guests: { name: string | null; email: string }[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const email = String((item as { email?: string }).email || '')
      .trim()
      .toLowerCase();
    const name = String((item as { name?: string }).name || '').trim().slice(0, 120) || null;
    if (!EMAIL_RE.test(email) || seen.has(email)) continue;
    seen.add(email);
    guests.push({ name, email });
    if (guests.length >= 15) break;
  }
  return guests;
}

export async function createBookingRequest(input: {
  code: string;
  name: string;
  email: string;
  mode: string;
  startsAt: string;
  endsAt: string;
  note?: string | null;
  locationText?: string | null;
  guests?: unknown;
  locale?: string | null;
}) {
  const page = await prisma.meetBookingPage.findUnique({
    where: { publicCode: input.code },
    include: { owner: { select: { id: true, name: true, email: true } }, windows: true },
  });
  if (!page) throw new BookingError('not_found');

  const name = input.name.trim().slice(0, 120);
  const email = input.email.trim().toLowerCase();
  if (name.length < 1) throw new BookingError('name_required');
  if (!EMAIL_RE.test(email)) throw new BookingError('email_invalid');

  const mode = input.mode === 'presencial' ? 'presencial' : input.mode === 'virtual' ? 'virtual' : '';
  if (!mode) throw new BookingError('mode_invalid');
  if (mode === 'virtual' && !page.allowVirtual) throw new BookingError('mode_invalid');
  if (mode === 'presencial' && !page.allowInPerson) throw new BookingError('mode_invalid');

  const starts = new Date(input.startsAt);
  const ends = new Date(input.endsAt);
  if (!Number.isFinite(starts.getTime()) || !Number.isFinite(ends.getTime()) || ends <= starts) {
    throw new BookingError('slot_invalid');
  }

  const busy = await loadBusy(page.id);
  const slots = buildOpenSlots({
    timeZone: page.timeZone,
    slotMinutes: page.slotMinutes,
    windows: page.windows,
    busy,
    days: 21,
  });
  const match = slots.find(
    (slot) => slot.startsAt === starts.toISOString() && slot.endsAt === ends.toISOString(),
  );
  if (!match) throw new BookingError('slot_taken');

  const location =
    mode === 'presencial'
      ? (input.locationText || page.locationText || '').trim().slice(0, 500) || null
      : null;
  const guests = parseGuests(input.guests, email);
  const note = (input.note || '').trim().slice(0, 2000) || null;
  const locale = bookingLocale(input.locale);

  const created = await prisma.meetBookingRequest.create({
    data: {
      pageId: page.id,
      companyId: page.companyId,
      publicToken: publicToken(),
      bookerName: name,
      bookerEmail: email,
      mode,
      status: 'pending',
      startsAt: starts,
      endsAt: ends,
      locationText: location,
      note,
      guests: { create: guests },
    },
    include: { guests: true },
  });

  const statusUrl = agendaStatusUrl(page.publicCode, created.publicToken);
  const when = bookingWhen(starts, locale, page.timeZone);
  const modeLabel =
    mode === 'virtual'
      ? locale === 'pt'
        ? 'Virtual — sala CHORUS depois da confirmação'
        : locale === 'en'
          ? 'Virtual — CHORUS room after confirmation'
          : 'Virtual — sala CHORUS tras la confirmación'
      : locale === 'pt'
        ? `Presencial${location ? `: ${location}` : ''}`
        : locale === 'en'
          ? `In person${location ? `: ${location}` : ''}`
          : `Presencial${location ? `: ${location}` : ''}`;

  const bookerMail = await sendChorusBookingEmail({
    to: email,
    subject:
      locale === 'pt'
        ? `Pedido recebido: ${page.title}`
        : locale === 'en'
          ? `Request received: ${page.title}`
          : `Solicitud recibida: ${page.title}`,
    html: bookingEmailHtml({
      locale,
      intro:
        locale === 'pt'
          ? 'O seu pedido ficou pendente. O organizador ainda precisa de aceitar.'
          : locale === 'en'
            ? 'Your request is pending. The organizer still needs to accept it.'
            : 'Tu solicitud quedó pendiente. Quien organiza todavía tiene que aceptarla.',
      title: page.title,
      when,
      lines: [modeLabel],
      ctaLabel: locale === 'pt' ? 'Ver pedido' : locale === 'en' ? 'View request' : 'Ver solicitud',
      ctaUrl: statusUrl,
    }),
  });

  if (page.owner.email) {
    const orgLocale: BookingLocale = 'pt';
    await sendChorusBookingEmail({
      to: page.owner.email,
      subject: `Novo pedido na agenda: ${name}`,
      html: bookingEmailHtml({
        locale: orgLocale,
        intro: `${name} pediu um horário na sua agenda CHORUS.`,
        title: page.title,
        when,
        lines: [email, modeLabel, note || ''].filter(Boolean),
        ctaLabel: 'Abrir agenda',
        ctaUrl: `${meetAppBaseUrl()}/hub/meet/agenda`,
      }),
    });
  }

  return {
    token: created.publicToken,
    statusPath: agendaStatusPath(page.publicCode, created.publicToken),
    mailSent: bookerMail.sent,
  };
}

function serializeRequest(
  row: {
    id: string;
    publicToken: string;
    bookerName: string;
    bookerEmail: string;
    mode: string;
    status: string;
    startsAt: Date;
    endsAt: Date;
    proposedStartsAt: Date | null;
    proposedEndsAt: Date | null;
    locationText: string | null;
    note: string | null;
    meetSessionId: string | null;
    createdAt: Date;
    guests: { name: string | null; email: string }[];
    meetSession?: { id: string; meetingUrl: string | null; companyId: string } | null;
  },
  publicCodeValue: string,
) {
  const joinUrl =
    row.status === 'accepted' && row.mode === 'virtual' && row.meetSessionId
      ? meetPublicJoinUrl(row.meetSessionId, row.meetSession?.companyId || '')
      : null;
  return {
    id: row.id,
    status: row.status,
    mode: row.mode,
    bookerName: row.bookerName,
    bookerEmail: row.bookerEmail,
    startsAt: row.startsAt.toISOString(),
    endsAt: row.endsAt.toISOString(),
    proposedStartsAt: row.proposedStartsAt?.toISOString() || null,
    proposedEndsAt: row.proposedEndsAt?.toISOString() || null,
    locationText: row.locationText,
    note: row.note,
    meetSessionId: row.meetSessionId,
    joinUrl,
    statusUrl: agendaStatusUrl(publicCodeValue, row.publicToken),
    guests: row.guests.map((guest) => ({ name: guest.name, email: guest.email })),
    createdAt: row.createdAt.toISOString(),
  };
}

export async function getOrganizerAgenda(companyId: string, ownerId: string) {
  const page = await ensureBookingPage(companyId, ownerId);
  const requests = await prisma.meetBookingRequest.findMany({
    where: { pageId: page.id },
    include: {
      guests: true,
      meetSession: { select: { id: true, meetingUrl: true, companyId: true } },
    },
    orderBy: { startsAt: 'desc' },
    take: 200,
  });
  return {
    page: {
      id: page.id,
      publicCode: page.publicCode,
      publicUrl: agendaPublicUrl(page.publicCode),
      title: page.title,
      description: page.description,
      timeZone: page.timeZone,
      slotMinutes: page.slotMinutes,
      locationText: page.locationText,
      allowVirtual: page.allowVirtual,
      allowInPerson: page.allowInPerson,
      windows: page.windows.map((window) => ({
        weekday: window.weekday,
        startMin: window.startMin,
        endMin: window.endMin,
      })),
      holidayCountries: page.holidayCountries || [],
      blocks: page.blocks.map((block) => ({
        id: block.id,
        startsAt: block.startsAt.toISOString(),
        endsAt: block.endsAt.toISOString(),
        source: block.source || 'manual',
        label: block.label,
      })),
    },
    requests: requests.map((row) => serializeRequest(row, page.publicCode)),
  };
}

export async function updateBookingPage(input: {
  companyId: string;
  ownerId: string;
  title: string;
  description?: string | null;
  timeZone: string;
  slotMinutes: number;
  locationText?: string | null;
  allowVirtual: boolean;
  allowInPerson: boolean;
  windows: BookingWindowInput[];
  holidayCountries?: unknown;
  locale?: string | null;
}) {
  const page = await ensureBookingPage(input.companyId, input.ownerId);
  const title = input.title.trim().slice(0, 160);
  if (!title) throw new BookingError('title_required');
  if (!input.allowVirtual && !input.allowInPerson) throw new BookingError('mode_invalid');
  const windows = normalizeBookingWindows(input.windows);
  if (windows.length === 0) throw new BookingError('windows_required');
  const requestedZone = input.timeZone.trim();
  if (!isValidTimeZone(requestedZone)) throw new BookingError('timezone_invalid');
  const timeZone = requestedZone;
  const holidayCountries =
    input.holidayCountries === undefined
      ? normalizeHolidayCountries(page.holidayCountries)
      : normalizeHolidayCountries(input.holidayCountries);

  await prisma.$transaction([
    prisma.meetBookingWindow.deleteMany({ where: { pageId: page.id } }),
    prisma.meetBookingPage.update({
      where: { id: page.id },
      data: {
        title,
        description: (input.description || '').trim().slice(0, 2000) || null,
        timeZone,
        slotMinutes: clampSlotMinutes(input.slotMinutes),
        locationText: (input.locationText || '').trim().slice(0, 500) || null,
        allowVirtual: input.allowVirtual,
        allowInPerson: input.allowInPerson,
        holidayCountries,
        windows: { create: windows },
      },
    }),
  ]);
  await replaceHolidayBlocks(page.id, holidayCountries, timeZone, input.locale);
  return getOrganizerAgenda(input.companyId, input.ownerId);
}

async function replaceHolidayBlocks(
  pageId: string,
  countries: string[],
  timeZone: string,
  locale?: string | null,
) {
  const year = Number(ymdInTimeZone(new Date(), timeZone).slice(0, 4)) || new Date().getUTCFullYear();
  const days: HolidayDay[] = countries.length
    ? collectHolidayDays(countries, year - 1, year + 2, locale || 'en')
    : [];
  await prisma.meetBookingBlock.deleteMany({ where: { pageId, source: 'holiday' } });
  const data = days.flatMap((day) => {
    const startsAt = meetWallTimeToUtc(`${day.ymd}T00:00`, timeZone);
    const endsAt = meetWallTimeToUtc(`${addDaysYmd(day.ymd, 1)}T00:00`, timeZone);
    if (!Number.isFinite(startsAt.getTime()) || !Number.isFinite(endsAt.getTime()) || endsAt <= startsAt) return [];
    return [{ pageId, startsAt, endsAt, source: 'holiday', label: day.label }];
  });
  if (data.length > 0) {
    await prisma.meetBookingBlock.createMany({ data });
  }
}

export async function addBookingBlock(input: {
  companyId: string;
  ownerId: string;
  startsAt: string;
  endsAt: string;
}) {
  const page = await ensureBookingPage(input.companyId, input.ownerId);
  const startsAt = new Date(input.startsAt);
  const endsAt = new Date(input.endsAt);
  if (!Number.isFinite(startsAt.getTime()) || !Number.isFinite(endsAt.getTime()) || endsAt <= startsAt) {
    throw new BookingError('slot_invalid');
  }
  if (endsAt.getTime() - startsAt.getTime() > 400 * 24 * 60 * 60 * 1000) {
    throw new BookingError('slot_invalid');
  }
  await prisma.meetBookingBlock.create({
    data: { pageId: page.id, startsAt, endsAt },
  });
  return getOrganizerAgenda(input.companyId, input.ownerId);
}

export async function removeBookingBlock(companyId: string, ownerId: string, blockId: string) {
  const page = await ensureBookingPage(companyId, ownerId);
  await prisma.meetBookingBlock.deleteMany({ where: { id: blockId, pageId: page.id, source: 'manual' } });
  return getOrganizerAgenda(companyId, ownerId);
}

async function ownedRequest(companyId: string, ownerId: string, requestId: string) {
  const request = await prisma.meetBookingRequest.findFirst({
    where: { id: requestId, companyId, page: { ownerId, companyId } },
    include: {
      guests: true,
      page: { include: { owner: { select: { id: true, name: true, email: true } } } },
      meetSession: { select: { id: true, meetingUrl: true, companyId: true } },
    },
  });
  if (!request) throw new BookingError('not_found');
  return request;
}

function conflicts(
  ranges: BusyRange[],
  starts: Date,
  ends: Date,
): boolean {
  return ranges.some((range) =>
    rangesOverlap(starts.getTime(), ends.getTime(), range.startsAt.getTime(), range.endsAt.getTime()),
  );
}

async function confirmRequest(
  request: Awaited<ReturnType<typeof ownedRequest>>,
  startsAt: Date,
  endsAt: Date,
  locale: BookingLocale,
) {
  let meetSessionId = request.meetSessionId;
  let joinUrl: string | null = null;

  if (request.mode === 'virtual' && !meetSessionId) {
    const session = await createMeetSession({
      companyId: request.companyId,
      createdById: request.page.ownerId,
      title: `${request.page.title} · ${request.bookerName}`.slice(0, 200),
      description: request.note || undefined,
      scheduledAt: startsAt,
      endsAt,
      inviteEmails: [request.bookerEmail, ...request.guests.map((guest) => guest.email)],
    });
    meetSessionId = session.id;
    joinUrl = meetPublicJoinUrl(session.id, request.companyId);
    try {
      await pushMeetSessionToGoogle({
        userId: request.page.ownerId,
        sessionId: session.id,
        timeZone: request.page.timeZone,
      });
    } catch (error) {
      console.warn('[chorus/agenda] google sync', error);
    }
  }

  const location = request.mode === 'presencial' ? request.locationText : joinUrl;
  if (request.mode === 'presencial' && !request.googleCalendarEventId) {
    try {
      const event = await createGoogleCalendarEvent(request.page.ownerId, {
        title: `${request.page.title} · ${request.bookerName}`.slice(0, 200),
        description: request.note || request.page.title,
        locationUrl: request.locationText || undefined,
        startsAt,
        endsAt,
        timeZone: request.page.timeZone,
        attendeeEmails: [request.bookerEmail, ...request.guests.map((guest) => guest.email)],
        notifyAttendees: false,
      });
      await prisma.meetBookingRequest.update({
        where: { id: request.id },
        data: {
          googleCalendarEventId: event.id,
          googleCalendarHtmlLink: event.htmlLink || null,
        },
      });
    } catch (error) {
      console.info('[chorus/agenda] google presencial skipped', error instanceof Error ? error.message : error);
    }
  }

  const updated = await prisma.meetBookingRequest.update({
    where: { id: request.id },
    data: {
      status: 'accepted',
      startsAt,
      endsAt,
      proposedStartsAt: null,
      proposedEndsAt: null,
      meetSessionId,
    },
    include: {
      guests: true,
      meetSession: { select: { id: true, meetingUrl: true, companyId: true } },
    },
  });

  if (!joinUrl && updated.meetSessionId) {
    joinUrl = meetPublicJoinUrl(updated.meetSessionId, request.companyId);
  }

  const when = bookingWhen(startsAt, locale, request.page.timeZone);
  const statusUrl = agendaStatusUrl(request.page.publicCode, request.publicToken);
  const recipients = [request.bookerEmail, ...request.guests.map((guest) => guest.email)];
  let mailSent = false;

  if (request.mode === 'virtual' && joinUrl && meetSessionId) {
    for (const to of recipients) {
      const result = await sendMeetInviteEmail({
        to,
        title: `${request.page.title} · ${request.bookerName}`.slice(0, 200),
        meetingUrl: joinUrl,
        sessionId: meetSessionId,
        scheduledAt: startsAt,
        endsAt,
        hostName: request.page.owner.name,
        locale,
        timeZone: request.page.timeZone,
      });
      mailSent = mailSent || result.sent;
    }
  } else {
    for (const to of recipients) {
      const result = await sendChorusBookingEmail({
        to,
        subject:
          locale === 'pt'
            ? `Confirmado: ${request.page.title}`
            : locale === 'en'
              ? `Confirmed: ${request.page.title}`
              : `Confirmado: ${request.page.title}`,
        html: bookingEmailHtml({
          locale,
          intro:
            locale === 'pt'
              ? 'A reunião presencial está confirmada.'
              : locale === 'en'
                ? 'The in-person meeting is confirmed.'
                : 'La reunión presencial está confirmada.',
          title: request.page.title,
          when,
          lines: [location || ''].filter(Boolean),
          ctaLabel: locale === 'pt' ? 'Ver reserva' : locale === 'en' ? 'View booking' : 'Ver reserva',
          ctaUrl: statusUrl,
        }),
        ics: {
          uid: `${request.id}@etholys.chorus`,
          title: request.page.title,
          description: statusUrl,
          location: location || undefined,
          startsAt,
          endsAt,
        },
      });
      mailSent = mailSent || result.sent;
    }
  }

  return {
    request: serializeRequest(updated, request.page.publicCode),
    mailSent,
    joinUrl,
  };
}

export async function organizerAct(input: {
  companyId: string;
  ownerId: string;
  requestId: string;
  action: string;
  proposedStartsAt?: string | null;
  proposedEndsAt?: string | null;
  locale?: string | null;
}) {
  const request = await ownedRequest(input.companyId, input.ownerId, input.requestId);
  const locale = bookingLocale(input.locale);
  const statusUrl = agendaStatusUrl(request.page.publicCode, request.publicToken);

  if (input.action === 'accept') {
    if (request.status !== 'pending' && request.status !== 'counter_proposed') {
      throw new BookingError('status_invalid');
    }
    const starts =
      request.status === 'counter_proposed' && request.proposedStartsAt
        ? request.proposedStartsAt
        : request.startsAt;
    const ends =
      request.status === 'counter_proposed' && request.proposedEndsAt
        ? request.proposedEndsAt
        : request.endsAt;
    return confirmRequest(request, starts, ends, locale);
  }

  if (input.action === 'decline') {
    if (request.status !== 'pending' && request.status !== 'counter_proposed') {
      throw new BookingError('status_invalid');
    }
    const updated = await prisma.meetBookingRequest.update({
      where: { id: request.id },
      data: { status: 'declined', proposedStartsAt: null, proposedEndsAt: null },
      include: { guests: true, meetSession: { select: { id: true, meetingUrl: true, companyId: true } } },
    });
    const mail = await sendChorusBookingEmail({
      to: request.bookerEmail,
      subject:
        locale === 'pt'
          ? `Pedido recusado: ${request.page.title}`
          : locale === 'en'
            ? `Request declined: ${request.page.title}`
            : `Solicitud rechazada: ${request.page.title}`,
      html: bookingEmailHtml({
        locale,
        intro:
          locale === 'pt'
            ? 'O organizador recusou este horário.'
            : locale === 'en'
              ? 'The organizer declined this time.'
              : 'Quien organiza rechazó este horario.',
        title: request.page.title,
        when: bookingWhen(request.startsAt, locale, request.page.timeZone),
        ctaLabel: locale === 'pt' ? 'Ver pedido' : locale === 'en' ? 'View request' : 'Ver solicitud',
        ctaUrl: statusUrl,
      }),
    });
    return { request: serializeRequest(updated, request.page.publicCode), mailSent: mail.sent, joinUrl: null };
  }

  if (input.action === 'counter') {
    if (request.status !== 'pending' && request.status !== 'counter_proposed') {
      throw new BookingError('status_invalid');
    }
    const starts = new Date(input.proposedStartsAt || '');
    const ends = new Date(input.proposedEndsAt || '');
    if (!Number.isFinite(starts.getTime()) || !Number.isFinite(ends.getTime()) || ends <= starts) {
      throw new BookingError('slot_invalid');
    }
    if (ends.getTime() - starts.getTime() > 8 * 60 * 60 * 1000) throw new BookingError('slot_invalid');
    if (starts.getTime() <= Date.now()) throw new BookingError('slot_invalid');
    const busy = await loadBusy(request.pageId, request.id);
    if (conflicts(busy, starts, ends)) throw new BookingError('slot_taken');
    const updated = await prisma.meetBookingRequest.update({
      where: { id: request.id },
      data: { status: 'counter_proposed', proposedStartsAt: starts, proposedEndsAt: ends },
      include: { guests: true, meetSession: { select: { id: true, meetingUrl: true, companyId: true } } },
    });
    const mail = await sendChorusBookingEmail({
      to: request.bookerEmail,
      subject:
        locale === 'pt'
          ? `Novo horário proposto: ${request.page.title}`
          : locale === 'en'
            ? `New time proposed: ${request.page.title}`
            : `Nuevo horario propuesto: ${request.page.title}`,
      html: bookingEmailHtml({
        locale,
        intro:
          locale === 'pt'
            ? 'O organizador propôs outro horário. Pode aceitar ou recusar sem criar conta.'
            : locale === 'en'
              ? 'The organizer proposed another time. You can accept or decline without an account.'
              : 'Quien organiza propuso otro horario. Puedes aceptar o rechazar sin crear una cuenta.',
        title: request.page.title,
        when: bookingWhen(starts, locale, request.page.timeZone),
        ctaLabel: locale === 'pt' ? 'Responder' : locale === 'en' ? 'Reply' : 'Responder',
        ctaUrl: statusUrl,
      }),
    });
    return { request: serializeRequest(updated, request.page.publicCode), mailSent: mail.sent, joinUrl: null };
  }

  if (input.action === 'close') {
    const held = heldInterval(request) || { startsAt: request.startsAt, endsAt: request.endsAt };
    await prisma.meetBookingBlock.create({
      data: { pageId: request.pageId, startsAt: held.startsAt, endsAt: held.endsAt },
    });
    let mailSent = false;
    if (request.status === 'pending' || request.status === 'counter_proposed') {
      await prisma.meetBookingRequest.update({
        where: { id: request.id },
        data: { status: 'declined' },
      });
      const mail = await sendChorusBookingEmail({
        to: request.bookerEmail,
        subject:
          locale === 'pt'
            ? `Horário fechado: ${request.page.title}`
            : locale === 'en'
              ? `Time closed: ${request.page.title}`
              : `Horario cerrado: ${request.page.title}`,
        html: bookingEmailHtml({
          locale,
          intro:
            locale === 'pt'
              ? 'Esse horário foi fechado e o pedido não segue.'
              : locale === 'en'
                ? 'That time was closed and the request will not go ahead.'
                : 'Ese horario se cerró y la solicitud no sigue.',
          title: request.page.title,
          when: bookingWhen(held.startsAt, locale, request.page.timeZone),
          ctaUrl: statusUrl,
          ctaLabel: locale === 'pt' ? 'Ver pedido' : locale === 'en' ? 'View request' : 'Ver solicitud',
        }),
      });
      mailSent = mail.sent;
    }
    const fresh = await ownedRequest(input.companyId, input.ownerId, input.requestId);
    return { request: serializeRequest(fresh, request.page.publicCode), mailSent, joinUrl: null };
  }

  throw new BookingError('action_invalid');
}

export async function getBookingStatus(code: string, token: string) {
  const request = await prisma.meetBookingRequest.findFirst({
    where: { publicToken: token, page: { publicCode: code } },
    include: {
      guests: true,
      page: { select: { title: true, timeZone: true, publicCode: true, locationText: true } },
      meetSession: { select: { id: true, meetingUrl: true, companyId: true } },
    },
  });
  if (!request) return null;
  const effectiveStart =
    request.status === 'counter_proposed' && request.proposedStartsAt
      ? request.proposedStartsAt
      : request.startsAt;
  const effectiveEnd =
    request.status === 'counter_proposed' && request.proposedEndsAt
      ? request.proposedEndsAt
      : request.endsAt;
  const joinUrl =
    request.status === 'accepted' && request.mode === 'virtual' && request.meetSessionId
      ? meetPublicJoinUrl(request.meetSessionId, request.companyId)
      : null;
  const location =
    request.mode === 'presencial' ? request.locationText || request.page.locationText || '' : joinUrl || '';
  const details = [request.page.title, joinUrl || request.locationText || ''].filter(Boolean).join('\n');
  return {
    request: {
      status: request.status,
      mode: request.mode,
      bookerName: request.bookerName,
      title: request.page.title,
      timeZone: request.page.timeZone,
      startsAt: request.startsAt.toISOString(),
      endsAt: request.endsAt.toISOString(),
      proposedStartsAt: request.proposedStartsAt?.toISOString() || null,
      proposedEndsAt: request.proposedEndsAt?.toISOString() || null,
      locationText: request.locationText,
      note: request.note,
      joinUrl,
      guests: request.guests.map((guest) => ({ name: guest.name, email: guest.email })),
    },
    calendar:
      request.status === 'declined' || request.status === 'cancelled'
        ? null
        : bookingCalendarLinks({
            title: request.page.title,
            details,
            location,
            startsAt: effectiveStart,
            endsAt: effectiveEnd,
            icsPath: `/api/meet/public/agenda/${encodeURIComponent(code)}/r/${encodeURIComponent(token)}/ics`,
          }),
  };
}

export async function bookerRespond(input: {
  code: string;
  token: string;
  action: string;
  locale?: string | null;
}) {
  const request = await prisma.meetBookingRequest.findFirst({
    where: { publicToken: input.token, page: { publicCode: input.code } },
    include: {
      guests: true,
      page: { include: { owner: { select: { id: true, name: true, email: true } } } },
      meetSession: { select: { id: true, meetingUrl: true, companyId: true } },
    },
  });
  if (!request) throw new BookingError('not_found');
  const locale = bookingLocale(input.locale);

  if (input.action === 'decline') {
    if (request.status !== 'pending' && request.status !== 'counter_proposed') {
      throw new BookingError('status_invalid');
    }
    await prisma.meetBookingRequest.update({
      where: { id: request.id },
      data: { status: 'cancelled', proposedStartsAt: null, proposedEndsAt: null },
    });
    if (request.page.owner.email) {
      await sendChorusBookingEmail({
        to: request.page.owner.email,
        subject: `${request.bookerName} recusou o horário`,
        html: bookingEmailHtml({
          locale: 'pt',
          intro: `${request.bookerName} recusou ou cancelou o pedido na agenda CHORUS.`,
          title: request.page.title,
          when: bookingWhen(
            request.proposedStartsAt || request.startsAt,
            'pt',
            request.page.timeZone,
          ),
        }),
      });
    }
    return getBookingStatus(input.code, input.token);
  }

  if (input.action === 'accept') {
    if (request.status !== 'counter_proposed' || !request.proposedStartsAt || !request.proposedEndsAt) {
      throw new BookingError('status_invalid');
    }
    const owned = await ownedRequest(request.companyId, request.page.ownerId, request.id);
    await confirmRequest(owned, request.proposedStartsAt, request.proposedEndsAt, locale);
    return getBookingStatus(input.code, input.token);
  }

  throw new BookingError('action_invalid');
}

export function bookingIcs(input: {
  uid: string;
  title: string;
  description: string;
  location: string;
  startsAt: Date;
  endsAt: Date;
}): string {
  return buildMeetIcs({
    uid: input.uid,
    title: input.title,
    description: input.description,
    locationUrl: input.location,
    startsAt: input.startsAt,
    endsAt: input.endsAt,
  }).replace('PRODID:-//Etholys//Meet//EN', 'PRODID:-//Etholys//CHORUS//EN');
}

export async function getBookingIcs(code: string, token: string): Promise<string | null> {
  const status = await getBookingStatus(code, token);
  if (!status || !status.calendar) return null;
  const startIso =
    status.request.status === 'counter_proposed' && status.request.proposedStartsAt
      ? status.request.proposedStartsAt
      : status.request.startsAt;
  const endIso =
    status.request.status === 'counter_proposed' && status.request.proposedEndsAt
      ? status.request.proposedEndsAt
      : status.request.endsAt;
  const location =
    status.request.mode === 'virtual'
      ? status.request.joinUrl || 'CHORUS'
      : status.request.locationText || '';
  return bookingIcs({
    uid: `${token}@etholys.chorus`,
    title: status.request.title,
    description: status.request.joinUrl || status.request.title,
    location,
    startsAt: new Date(startIso),
    endsAt: new Date(endIso),
  });
}
