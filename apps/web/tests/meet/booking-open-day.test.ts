import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildOpenDayWindows,
  isValidOpenDayYmd,
  normalizeOpenDayHours,
  openDayPublicPath,
} from '../../lib/meet/booking-open-day';
import { buildOpenSlots } from '../../lib/meet/booking-slots';
import { meetWallTimeToUtc } from '../../lib/meet/timezone';

test('open day ymd and hours validation', () => {
  assert.equal(isValidOpenDayYmd('2026-10-24'), true);
  assert.equal(isValidOpenDayYmd('2026-02-30'), false);
  assert.equal(isValidOpenDayYmd('24-10-2026'), false);
  assert.deepEqual(normalizeOpenDayHours(9 * 60, 12 * 60), { startMin: 540, endMin: 720 });
  assert.equal(normalizeOpenDayHours(10 * 60, 10 * 60 + 10), null);
  assert.equal(openDayPublicPath('abc123'), '/a/d/abc123');
});

test('open day windows expose only that weekday', () => {
  // 2026-10-24 is Saturday (6)
  const windows = buildOpenDayWindows('2026-10-24', 9 * 60, 11 * 60);
  assert.deepEqual(windows, [{ weekday: 6, startMin: 540, endMin: 660 }]);
  assert.deepEqual(buildOpenDayWindows('bad', 9 * 60, 11 * 60), []);
});

test('open day slots stay on the selected date', () => {
  const windows = buildOpenDayWindows('2026-10-24', 9 * 60, 11 * 60);
  const slots = buildOpenSlots({
    timeZone: 'America/Sao_Paulo',
    slotMinutes: 30,
    windows,
    fromYmd: '2026-10-24',
    days: 1,
    now: new Date('2026-10-20T12:00:00.000Z'),
  });
  assert.ok(slots.length >= 2);
  assert.ok(slots.every((slot) => slot.date === '2026-10-24'));
  assert.equal(slots[0]?.startsAt, meetWallTimeToUtc('2026-10-24T09:00', 'America/Sao_Paulo').toISOString());
});
