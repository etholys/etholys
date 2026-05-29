import test from 'node:test';
import assert from 'node:assert/strict';
import { buildNexusQuickSteps, safeVentureStage } from '../../lib/nexus-guides';

test('safeVentureStage returns DISCOVER for invalid or empty input', () => {
  assert.equal(safeVentureStage(null), 'DISCOVER');
  assert.equal(safeVentureStage(undefined), 'DISCOVER');
  assert.equal(safeVentureStage(''), 'DISCOVER');
  assert.equal(safeVentureStage('NOT_A_STAGE'), 'DISCOVER');
});

test('safeVentureStage preserves valid stages', () => {
  assert.equal(safeVentureStage('FOCUS'), 'FOCUS');
  assert.equal(safeVentureStage('SCALE_GLOBAL'), 'SCALE_GLOBAL');
});

test('buildNexusQuickSteps adds network to internal Nexus paths', () => {
  const nid = 'net_cuid_1';
  const steps = buildNexusQuickSteps('DISCOVER', nid);
  const first = steps[0];
  assert.ok(first);
  assert.match(first.path, /\/hub\/nexus\/diagnosis\?/);
  assert.match(first.path, new RegExp(`network=${encodeURIComponent(nid)}`));
});

test('buildNexusQuickSteps leaves global routes without network', () => {
  const steps = buildNexusQuickSteps('BUILD', null);
  const dash = steps.find((s) => s.path === '/dashboard');
  assert.ok(dash);
  assert.equal(dash.path, '/dashboard');
});
