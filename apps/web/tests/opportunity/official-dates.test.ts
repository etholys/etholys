import test from 'node:test';
import assert from 'node:assert/strict';
import {
  dateAppearsInExcerpt,
  looksPlaceholderDate,
  sanitizeCandidateDates,
  sanitizeIsoDate,
} from '../../lib/opportunity/availability';

test('1 January ISO is treated as invented placeholder', () => {
  assert.equal(looksPlaceholderDate('2026-01-01'), true);
  assert.equal(looksPlaceholderDate('2026-01-01T00:00:00.000Z'), true);
  assert.equal(looksPlaceholderDate('2026-03-15'), false);
});

test('placeholder date is dropped unless the official excerpt states it', () => {
  assert.equal(sanitizeIsoDate('2026-01-01'), null);
  assert.equal(
    sanitizeIsoDate('2026-01-01', 'Applications open 1 January 2026 on the official page'),
    '2026-01-01',
  );
  assert.equal(
    sanitizeIsoDate('2026-03-15', 'x'.repeat(500) + ' nothing about march'),
    null,
  );
});

test('dateAppearsInExcerpt accepts ES / PT month tokens', () => {
  assert.equal(dateAppearsInExcerpt('2026-01-01', 'Abre el 1 enero 2026'), true);
  assert.equal(dateAppearsInExcerpt('2026-09-26', 'prazo 26 sept 2026'), true);
});

test('sanitizeCandidateDates clears invented 1 Jan opensAt', () => {
  const next = sanitizeCandidateDates({
    opensAt: '2026-01-01',
    closesAt: null,
    deadline: '2026-01-01',
    sourceExcerpt: 'Rolling call — deadline a confirmar na página oficial.',
  });
  assert.equal(next.opensAt, null);
  assert.equal(next.deadline, null);
});
