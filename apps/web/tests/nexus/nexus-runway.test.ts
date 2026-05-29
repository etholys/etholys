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

test('continue href is journey when nothing done', () => {
  const href = continueChapterHref(emptyTouch(), null, null);
  assert.match(href, /journey/);
});

test('withNetworkPath appends network', () => {
  assert.equal(withNetworkPath('/hub/nexus/roadmap', 'nid1'), '/hub/nexus/roadmap?network=nid1');
});

test('roadmap complete only with roadmap activity in metrics', () => {
  const t = { ...emptyTouch(), journey: true, diagnosis: true, services: true, library: true };
  assert.equal(isChapterComplete('roadmap', t, null), false);
  assert.equal(isChapterComplete('roadmap', t, m), true);
});

test('after full touch and metrics, continue loops to journey', () => {
  const t = { journey: true, diagnosis: true, roadmap: true, services: true, library: true };
  const fullM: RunwayMetrics = { pendingRoadmapActions: 1, completedRoadmapActions: 0, openServiceTickets: 1 };
  const href = continueChapterHref(
    t,
    fullM,
    null,
  );
  assert.match(href, /journey/);
});
