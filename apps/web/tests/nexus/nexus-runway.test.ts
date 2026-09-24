import test from 'node:test';
import assert from 'node:assert/strict';
import {
  continueChapterHref,
  emptyTouch,
  isChapterComplete,
  withNetworkPath,
} from '../../lib/nexus-runway';
import type { RunwayMetrics } from '../../lib/nexus-runway';

const m: RunwayMetrics = {
  pendingRoadmapActions: 1,
  completedRoadmapActions: 0,
  openServiceTickets: 0,
};

test('continue href is diagnosis when nothing done', () => {
  const href = continueChapterHref(emptyTouch(), null, null);
  assert.match(href, /diagnosis/);
});

test('withNetworkPath appends network', () => {
  assert.equal(withNetworkPath('/hub/nexus/roadmap', 'nid1'), '/hub/nexus/roadmap?network=nid1');
});

test('roadmap complete only with roadmap activity in metrics', () => {
  const t = { ...emptyTouch(), diagnosis: true, campo: true, monitor: true, services: true };
  assert.equal(isChapterComplete('roadmap', t, null), false);
  assert.equal(isChapterComplete('roadmap', t, m), true);
});

test('after full touch and metrics, continue loops to campo', () => {
  const t = { diagnosis: true, roadmap: true, campo: true, monitor: true, services: true };
  const fullM: RunwayMetrics = { pendingRoadmapActions: 1, completedRoadmapActions: 0, openServiceTickets: 1 };
  const href = continueChapterHref(t, fullM, null);
  assert.match(href, /campo/);
});
