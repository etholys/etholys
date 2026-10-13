import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DISCOVERY_RUN_STALE_IDLE_MS,
  isDiscoveryRunStale,
} from '../../lib/opportunity/scan-run-liveness';

const now = Date.parse('2026-10-12T22:00:00.000Z');

test('running scan with a fresh heartbeat is not stale', () => {
  assert.equal(
    isDiscoveryRunStale(
      { status: 'running', updatedAt: new Date(now - 10 * 60 * 1000) },
      now,
    ),
    false,
  );
});

test('running scan idle past the window is stale even if it started long ago', () => {
  assert.equal(
    isDiscoveryRunStale(
      { status: 'running', updatedAt: new Date(now - DISCOVERY_RUN_STALE_IDLE_MS - 1) },
      now,
    ),
    true,
  );
});

test('finished scans are never treated as stale', () => {
  assert.equal(
    isDiscoveryRunStale(
      { status: 'completed', updatedAt: new Date(now - 2 * DISCOVERY_RUN_STALE_IDLE_MS) },
      now,
    ),
    false,
  );
});
