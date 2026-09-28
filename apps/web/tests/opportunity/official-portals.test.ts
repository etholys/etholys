import test from 'node:test';
import assert from 'node:assert/strict';
import { isAggregatorFundingUrl } from '../../lib/opportunity/official-url';
import { formatOriginLine, OFFICIAL_PORTALS } from '../../lib/opportunity/official-portals';

test('official portal list has no aggregators', () => {
  assert.ok(OFFICIAL_PORTALS.length >= 8);
  for (const portal of OFFICIAL_PORTALS) {
    assert.equal(isAggregatorFundingUrl(portal.url), false, portal.url);
    assert.match(portal.url, /^https:\/\//);
  }
});

test('origin line names the scan and the date', () => {
  const line = formatOriginLine(
    { scanFocus: 'open_now', savedAt: '2026-09-26T12:00:00.000Z' },
    'pt',
  );
  assert.match(line, /Abertos agora/);
  assert.match(line, /26/);
});
