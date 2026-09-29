import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildPropertyProgress,
  clampCoord,
  isCharacterized,
  isGeolocated,
  nextIncompleteStep,
  progressPercent,
} from '../../lib/radar/property-progress';
import { isRadarOrgRole, radarHomePath } from '../../lib/radar/org-role';

test('org role helpers', () => {
  assert.equal(isRadarOrgRole('producer'), true);
  assert.equal(isRadarOrgRole('provider'), true);
  assert.equal(isRadarOrgRole('admin'), false);
  assert.equal(radarHomePath('provider'), '/hub/radar/provider');
  assert.equal(radarHomePath('producer'), '/hub/radar/producer');
});

test('empty property starts at characterize', () => {
  assert.equal(nextIncompleteStep({}), 'characterize');
  assert.equal(progressPercent({}), 0);
  assert.equal(isCharacterized({}), false);
});

test('characterize unlocks draw as next step', () => {
  const input = { moduleId: 'agriculture', crop: 'milho' };
  assert.equal(isCharacterized(input), true);
  assert.equal(nextIncompleteStep(input), 'draw');
  const steps = buildPropertyProgress(input);
  assert.equal(steps[0].done, true);
  assert.equal(steps[1].done, false);
});

test('plant drawn when layout has spaces or units exist', () => {
  assert.equal(
    nextIncompleteStep({
      moduleId: 'agriculture',
      layoutJson: { version: 1, spaces: [{ id: 'u1', x: 10, y: 10, w: 20, h: 20 }] },
    }),
    'geolocate'
  );
  assert.equal(nextIncompleteStep({ moduleId: 'agriculture', unitCount: 1 }), 'geolocate');
});

test('geo and sensors complete the rail', () => {
  const almost = {
    moduleId: 'agriculture',
    unitCount: 2,
    lat: -15.8,
    lng: -47.9,
  };
  assert.equal(isGeolocated(almost), true);
  assert.equal(nextIncompleteStep(almost), 'sensors');
  assert.equal(progressPercent({ ...almost, sensorCount: 1 }), 100);
});

test('clampCoord rejects junk', () => {
  assert.equal(clampCoord(Number.NaN, 0), null);
  assert.equal(clampCoord(100, 0), null);
  assert.deepEqual(clampCoord(-15.7801, -47.9292), { lat: -15.7801, lng: -47.9292 });
});
