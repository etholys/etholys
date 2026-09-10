import test from 'node:test';
import assert from 'node:assert/strict';
import { dateOnlyIso, formatDateOnly, parseDateOnlyToUtc } from '../../lib/atlas/date-only';

test('YYYY-MM-DD stays on the same calendar day (no TZ rollback)', () => {
  const d = parseDateOnlyToUtc('2026-09-08');
  assert.ok(d);
  assert.equal(d.toISOString().slice(0, 10), '2026-09-08');
  assert.equal(dateOnlyIso('2026-09-08T00:00:00.000Z'), '2026-09-08');
  assert.equal(formatDateOnly('2026-09-08T00:00:00.000Z', 'en-CA'), '2026-09-08');
});

test('executedDate fallback uses the marked date, not wall-clock now', () => {
  const marked = parseDateOnlyToUtc('2026-09-01');
  const stampedNow = parseDateOnlyToUtc(new Date('2026-09-09T21:15:00.000Z'));
  assert.equal(dateOnlyIso(marked), '2026-09-01');
  assert.notEqual(dateOnlyIso(marked), dateOnlyIso(stampedNow));
});
