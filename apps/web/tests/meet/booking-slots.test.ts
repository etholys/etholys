import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BOOKING_SLOT_MINUTE_OPTIONS,
  DEFAULT_BOOKING_WINDOWS,
  buildOpenSlots,
  rangesOverlap,
  weekdayOfYmd,
} from '../../lib/meet/booking-slots';

test('weekday of 2026-10-19 is Monday', () => {
  assert.equal(weekdayOfYmd('2026-10-19'), 1);
});

test('default weekday window opens 09:00 America/Sao_Paulo and skips a busy hour', () => {
  const now = new Date('2026-10-19T11:00:00.000Z');
  const slots = buildOpenSlots({
    timeZone: 'America/Sao_Paulo',
    slotMinutes: 60,
    windows: DEFAULT_BOOKING_WINDOWS,
    days: 1,
    now,
    fromYmd: '2026-10-19',
  });
  assert.equal(slots[0]?.startsAt, '2026-10-19T12:00:00.000Z');
  assert.equal(slots[0]?.endsAt, '2026-10-19T13:00:00.000Z');
  assert.equal(slots.length, 9);

  const blocked = buildOpenSlots({
    timeZone: 'America/Sao_Paulo',
    slotMinutes: 60,
    windows: DEFAULT_BOOKING_WINDOWS,
    days: 1,
    now,
    fromYmd: '2026-10-19',
    busy: [
      {
        startsAt: new Date('2026-10-19T12:00:00.000Z'),
        endsAt: new Date('2026-10-19T13:00:00.000Z'),
      },
    ],
  });
  assert.equal(blocked[0]?.startsAt, '2026-10-19T13:00:00.000Z');
  assert.equal(blocked.length, 8);
});

test('ranges overlap on a shared edge only when they cross', () => {
  assert.equal(rangesOverlap(0, 10, 10, 20), false);
  assert.equal(rangesOverlap(0, 11, 10, 20), true);
});

test('Sunday has no default slots', () => {
  const slots = buildOpenSlots({
    timeZone: 'America/Sao_Paulo',
    slotMinutes: 30,
    windows: DEFAULT_BOOKING_WINDOWS,
    days: 1,
    now: new Date('2026-10-17T12:00:00.000Z'),
    fromYmd: '2026-10-18',
  });
  assert.equal(slots.length, 0);
});

test('slot length drives open slot spacing and end times', () => {
  assert.deepEqual([...BOOKING_SLOT_MINUTE_OPTIONS], [15, 30, 45, 60, 90, 120]);
  const now = new Date('2026-10-19T11:00:00.000Z');
  const thirty = buildOpenSlots({
    timeZone: 'America/Sao_Paulo',
    slotMinutes: 30,
    windows: [{ weekday: 1, startMin: 9 * 60, endMin: 11 * 60 }],
    days: 1,
    now,
    fromYmd: '2026-10-19',
  });
  const sixty = buildOpenSlots({
    timeZone: 'America/Sao_Paulo',
    slotMinutes: 60,
    windows: [{ weekday: 1, startMin: 9 * 60, endMin: 11 * 60 }],
    days: 1,
    now,
    fromYmd: '2026-10-19',
  });
  assert.equal(thirty.length, 4);
  assert.equal(sixty.length, 2);
  assert.equal(thirty[0]?.startsAt, '2026-10-19T12:00:00.000Z');
  assert.equal(thirty[0]?.endsAt, '2026-10-19T12:30:00.000Z');
  assert.equal(thirty[1]?.startsAt, '2026-10-19T12:30:00.000Z');
  assert.equal(sixty[0]?.endsAt, '2026-10-19T13:00:00.000Z');
  assert.equal(sixty[1]?.startsAt, '2026-10-19T13:00:00.000Z');
});
