/**
 * Ocupação automática da agenda CHORUS: reuniões da sala e eventos Google.
 * Puro — a página pública só recebe intervalos, sem títulos.
 */

import { meetShortCode } from '@/lib/meet/short-link';
import { meetWallTimeToUtc } from '@/lib/meet/timezone';
import {
  addDaysYmd,
  normalizeBookingWindows,
  weekdayOfYmd,
  type BookingWindowInput,
  type BusyRange,
} from '@/lib/meet/booking-slots';

export type AgendaBusySession = {
  id: string;
  title: string;
  startsAt: Date;
  endsAt: Date;
  roomSlug: string;
  meetingUrl: string | null;
  googleCalendarEventId: string | null;
  /** Espelho de um evento Google (sala importada), não uma reunião criada no CHORUS. */
  importedFromGoogle: boolean;
  /** Já desenhada como pedido da agenda. */
  linkedToBooking: boolean;
};

export type AgendaBusyGoogleEvent = {
  id: string;
  title: string;
  allDay: boolean;
  startsAt: Date | null;
  endsAt: Date | null;
  /** Dia inclusivo, quando allDay. */
  startYmd: string | null;
  /** Dia exclusivo, quando allDay. */
  endYmdExclusive: string | null;
  urls: string[];
};

export type GoogleBusyFetch = {
  /** off = conta sem Google; error = falha breve; ok = lista fiável (pode ser vazia). */
  state: 'off' | 'error' | 'ok';
  events: AgendaBusyGoogleEvent[];
};

export type AgendaExternalBlock = {
  id: string;
  source: 'chorus' | 'google';
  title: string;
  startsAt: Date;
  endsAt: Date;
};

/** ID mestre de uma ocorrência recorrente (`abc_20261006T170000Z` → `abc`). */
export function googleCalendarMasterEventId(eventId: string): string {
  const match = eventId.match(/^(.+)_\d{8}T\d{6}Z$/i);
  return match?.[1] || eventId;
}

export function googleEventIdsRelated(a: string, b: string): boolean {
  if (a === b) return true;
  const ma = googleCalendarMasterEventId(a);
  const mb = googleCalendarMasterEventId(b);
  return ma === mb || ma === b || a === mb;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function wallFromMinutes(ymd: string, minutes: number): string {
  const clamped = Math.max(0, Math.min(24 * 60, minutes));
  if (clamped >= 24 * 60) return `${addDaysYmd(ymd, 1)}T00:00`;
  return `${ymd}T${pad(Math.floor(clamped / 60))}:${pad(clamped % 60)}`;
}

/** Horário de trabalho desse dia. Sem janela, 09:00–18:00 — um evento de dia inteiro não espalha a semana. */
export function workingDayRange(
  ymd: string,
  timeZone: string,
  windows: BookingWindowInput[],
): BusyRange | null {
  const dayWindows = normalizeBookingWindows(windows).filter((row) => row.weekday === weekdayOfYmd(ymd));
  const startMin = dayWindows.length ? Math.min(...dayWindows.map((row) => row.startMin)) : 9 * 60;
  const endMin = dayWindows.length ? Math.max(...dayWindows.map((row) => row.endMin)) : 18 * 60;
  if (endMin <= startMin) return null;
  const startsAt = meetWallTimeToUtc(wallFromMinutes(ymd, startMin), timeZone);
  const endsAt = meetWallTimeToUtc(wallFromMinutes(ymd, endMin), timeZone);
  if (!Number.isFinite(startsAt.getTime()) || !Number.isFinite(endsAt.getTime()) || endsAt <= startsAt) return null;
  return { startsAt, endsAt };
}

function eachYmd(startYmd: string, endYmdExclusive: string): string[] {
  const days: string[] = [];
  let cursor = startYmd;
  while (cursor < endYmdExclusive && days.length < 40) {
    days.push(cursor);
    cursor = addDaysYmd(cursor, 1);
  }
  return days;
}

function normUrl(url: string): string {
  return url.trim().replace(/\/+$/, '').toLowerCase();
}

function sessionMarkers(session: AgendaBusySession): string[] {
  const markers: string[] = [];
  if (session.meetingUrl) markers.push(normUrl(session.meetingUrl));
  if (session.roomSlug) markers.push(session.roomSlug.toLowerCase());
  try {
    const code = meetShortCode(session.id);
    if (code) markers.push(`/m/${code.toLowerCase()}`);
  } catch {
    /* id fora do alfabeto do código curto */
  }
  return markers;
}

function googleMirrorsChorus(event: AgendaBusyGoogleEvent, session: AgendaBusySession): boolean {
  if (
    session.googleCalendarEventId &&
    googleEventIdsRelated(event.id, session.googleCalendarEventId)
  ) {
    return true;
  }
  const urls = event.urls.map(normUrl).filter(Boolean);
  if (urls.length === 0) return false;
  const markers = sessionMarkers(session);
  return urls.some((url) => markers.some((marker) => marker.length > 3 && url.includes(marker)));
}

function pushBlock(
  out: AgendaExternalBlock[],
  block: AgendaExternalBlock,
) {
  if (!Number.isFinite(block.startsAt.getTime()) || !Number.isFinite(block.endsAt.getTime())) return;
  if (block.endsAt <= block.startsAt) return;
  out.push(block);
}

/**
 * Junta reuniões CHORUS e eventos Google sem desenhar duas vezes a mesma reunião
 * `state !== 'ok'` significa que o Google não respondeu ou não está ligado:
 * as reuniões CHORUS e os espelhos já gravados continuam a ocupar o horário.
 */
export function assembleAgendaExternalBusy(input: {
  sessions: AgendaBusySession[];
  google: GoogleBusyFetch;
  bookingGoogleEventIds: string[];
  timeZone: string;
  windows: BookingWindowInput[];
}): AgendaExternalBlock[] {
  const native = input.sessions.filter((session) => !session.importedFromGoogle);
  const out: AgendaExternalBlock[] = [];

  for (const session of native) {
    if (session.linkedToBooking) continue;
    pushBlock(out, {
      id: `chorus:${session.id}`,
      source: 'chorus',
      title: session.title.trim() || 'CHORUS',
      startsAt: session.startsAt,
      endsAt: session.endsAt,
    });
  }

  if (input.google.state !== 'ok') {
    for (const session of input.sessions) {
      if (!session.importedFromGoogle || session.linkedToBooking) continue;
      pushBlock(out, {
        id: `google-session:${session.id}`,
        source: 'google',
        title: session.title.trim() || 'Google',
        startsAt: session.startsAt,
        endsAt: session.endsAt,
      });
    }
    return out;
  }

  for (const event of input.google.events) {
    const mirroredByBooking = input.bookingGoogleEventIds.some((id) => googleEventIdsRelated(event.id, id));
    if (mirroredByBooking) continue;
    const mirroredByChorus = native.some((session) => googleMirrorsChorus(event, session));
    if (mirroredByChorus) continue;

    if (event.allDay && event.startYmd && event.endYmdExclusive) {
      for (const ymd of eachYmd(event.startYmd, event.endYmdExclusive)) {
        const range = workingDayRange(ymd, input.timeZone, input.windows);
        if (!range) continue;
        pushBlock(out, {
          id: `google:${event.id}:${ymd}`,
          source: 'google',
          title: event.title.trim() || 'Google',
          startsAt: range.startsAt,
          endsAt: range.endsAt,
        });
      }
      continue;
    }

    if (!event.startsAt || !event.endsAt) continue;
    pushBlock(out, {
      id: `google:${event.id}`,
      source: 'google',
      title: event.title.trim() || 'Google',
      startsAt: event.startsAt,
      endsAt: event.endsAt,
    });
  }

  return out;
}

export function externalBusyRanges(blocks: AgendaExternalBlock[]): BusyRange[] {
  return blocks.map((block) => ({ startsAt: block.startsAt, endsAt: block.endsAt }));
}
