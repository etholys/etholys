import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  assembleAgendaExternalBusy,
  externalBusyRanges,
  type AgendaBusySession,
} from '../../lib/meet/agenda-busy';
import { DEFAULT_BOOKING_WINDOWS, buildOpenSlots } from '../../lib/meet/booking-slots';
import { meetShortCode } from '../../lib/meet/short-link';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');

const windows = DEFAULT_BOOKING_WINDOWS;
const zone = 'America/Sao_Paulo';

function session(partial: Partial<AgendaBusySession> & Pick<AgendaBusySession, 'id' | 'startsAt' | 'endsAt'>): AgendaBusySession {
  return {
    title: 'Reunião CHORUS',
    roomSlug: 'etholys-room',
    meetingUrl: null,
    googleCalendarEventId: null,
    importedFromGoogle: false,
    linkedToBooking: false,
    ...partial,
  };
}

test('a CHORUS meeting closes only its own hour and a manual-style stack stays separate', () => {
  const blocks = assembleAgendaExternalBusy({
    sessions: [
      session({
        id: 'cm1234567890abcd',
        startsAt: new Date('2026-10-19T13:00:00.000Z'),
        endsAt: new Date('2026-10-19T14:00:00.000Z'),
        googleCalendarEventId: 'g-native',
      }),
    ],
    google: { state: 'ok', events: [] },
    bookingGoogleEventIds: [],
    timeZone: zone,
    windows,
  });
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0]?.source, 'chorus');
  assert.equal(blocks[0]?.title, 'Reunião CHORUS');

  const slots = buildOpenSlots({
    timeZone: zone,
    slotMinutes: 60,
    windows,
    days: 2,
    now: new Date('2026-10-19T11:00:00.000Z'),
    fromYmd: '2026-10-19',
    busy: externalBusyRanges(blocks),
  });
  assert.equal(slots.some((slot) => slot.startsAt === '2026-10-19T13:00:00.000Z'), false);
  assert.equal(slots.some((slot) => slot.startsAt === '2026-10-19T14:00:00.000Z'), true);
  assert.equal(slots.some((slot) => slot.startsAt === '2026-10-20T13:00:00.000Z'), true);
  assert.equal('title' in externalBusyRanges(blocks)[0]!, false);
});

test('the Google copy of a CHORUS meeting is not drawn twice', () => {
  const id = 'cm1234567890abcd';
  const code = meetShortCode(id);
  const blocks = assembleAgendaExternalBusy({
    sessions: [
      session({
        id,
        startsAt: new Date('2026-10-19T13:00:00.000Z'),
        endsAt: new Date('2026-10-19T14:00:00.000Z'),
        googleCalendarEventId: 'g-native',
        meetingUrl: `https://app.etholys.com/m/${code}`,
      }),
    ],
    google: {
      state: 'ok',
      events: [
        {
          id: 'g-native_20261019T130000Z',
          title: 'Reunião CHORUS',
          allDay: false,
          startsAt: new Date('2026-10-19T13:00:00.000Z'),
          endsAt: new Date('2026-10-19T14:00:00.000Z'),
          startYmd: null,
          endYmdExclusive: null,
          urls: [`https://app.etholys.com/m/${code}`],
        },
        {
          id: 'g-other',
          title: 'Dentista',
          allDay: false,
          startsAt: new Date('2026-10-19T15:00:00.000Z'),
          endsAt: new Date('2026-10-19T16:00:00.000Z'),
          startYmd: null,
          endYmdExclusive: null,
          urls: [],
        },
      ],
    },
    bookingGoogleEventIds: [],
    timeZone: zone,
    windows,
  });
  assert.deepEqual(
    blocks.map((block) => block.source),
    ['chorus', 'google'],
  );
  assert.equal(blocks.filter((block) => block.id.startsWith('chorus:')).length, 1);
  assert.equal(blocks.find((block) => block.source === 'google')?.title, 'Dentista');
});

test('an agenda booking already linked to the session is not duplicated', () => {
  const blocks = assembleAgendaExternalBusy({
    sessions: [
      session({
        id: 'cm1234567890abcd',
        linkedToBooking: true,
        googleCalendarEventId: 'g-booked',
        startsAt: new Date('2026-10-19T13:00:00.000Z'),
        endsAt: new Date('2026-10-19T14:00:00.000Z'),
      }),
    ],
    google: {
      state: 'ok',
      events: [
        {
          id: 'g-booked',
          title: 'Pedido',
          allDay: false,
          startsAt: new Date('2026-10-19T13:00:00.000Z'),
          endsAt: new Date('2026-10-19T14:00:00.000Z'),
          startYmd: null,
          endYmdExclusive: null,
          urls: [],
        },
      ],
    },
    bookingGoogleEventIds: ['g-booked'],
    timeZone: zone,
    windows,
  });
  assert.equal(blocks.length, 0);
});

test('an all-day Google event closes that working day only', () => {
  const blocks = assembleAgendaExternalBusy({
    sessions: [],
    google: {
      state: 'ok',
      events: [
        {
          id: 'all-day',
          title: 'Viagem',
          allDay: true,
          startsAt: null,
          endsAt: null,
          startYmd: '2026-10-19',
          endYmdExclusive: '2026-10-20',
          urls: [],
        },
      ],
    },
    bookingGoogleEventIds: [],
    timeZone: zone,
    windows,
  });
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0]?.startsAt.toISOString(), '2026-10-19T12:00:00.000Z');
  assert.equal(blocks[0]?.endsAt.toISOString(), '2026-10-19T21:00:00.000Z');
  const slots = buildOpenSlots({
    timeZone: zone,
    slotMinutes: 60,
    windows,
    days: 2,
    now: new Date('2026-10-19T11:00:00.000Z'),
    fromYmd: '2026-10-19',
    busy: externalBusyRanges(blocks),
  });
  assert.equal(slots.some((slot) => slot.date === '2026-10-19'), false);
  assert.equal(slots.some((slot) => slot.date === '2026-10-20'), true);
});

test('when Google is unavailable, CHORUS meetings and stored Google mirrors still block', () => {
  const blocks = assembleAgendaExternalBusy({
    sessions: [
      session({
        id: 'cm1234567890abcd',
        startsAt: new Date('2026-10-19T13:00:00.000Z'),
        endsAt: new Date('2026-10-19T14:00:00.000Z'),
      }),
      session({
        id: 'cmimported0000001',
        title: 'Consulta',
        roomSlug: 'gcal-abc',
        importedFromGoogle: true,
        startsAt: new Date('2026-10-19T18:00:00.000Z'),
        endsAt: new Date('2026-10-19T19:00:00.000Z'),
      }),
    ],
    google: { state: 'error', events: [] },
    bookingGoogleEventIds: [],
    timeZone: zone,
    windows,
  });
  assert.equal(blocks.find((block) => block.source === 'chorus')?.title, 'Reunião CHORUS');
  assert.equal(blocks.find((block) => block.source === 'google')?.title, 'Consulta');
});

test('public agenda payload does not carry Google or CHORUS titles', () => {
  const booking = readFileSync(join(root, 'lib/meet/booking.ts'), 'utf8');
  const start = booking.indexOf('export async function getPublicAgenda');
  const end = booking.indexOf('function parseGuests');
  const pub = booking.slice(start, end);
  assert.match(pub, /loadBusy/);
  assert.doesNotMatch(pub, /externalBusy/);
  const guest = readFileSync(join(root, 'components/meet/ChorusPublicAgenda.tsx'), 'utf8');
  assert.doesNotMatch(guest, /externalBusy/);
  const calendar = readFileSync(join(root, 'components/meet/ChorusAgendaCalendar.tsx'), 'utf8');
  assert.match(calendar, /CHORUS/);
  assert.match(calendar, /Google/);
  assert.match(calendar, /Fechado/);
  assert.doesNotMatch(`${calendar}\n${guest}`, /jitsi|jibri|jigasi/i);
});
