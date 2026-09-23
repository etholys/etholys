import assert from 'node:assert/strict';
import { test } from 'node:test';
import { companyHasHubTool } from '../lib/hub-tool-addons';
import { resolveHubCardAccess } from '../lib/hub-system-license';

test('Studio/Work stay visible when billing is not enforced', () => {
  assert.equal(companyHasHubTool('studio', { billingEnforced: false, addOnCodes: [] }), true);
  assert.equal(companyHasHubTool('work', { billingEnforced: false, addOnCodes: [] }), true);
});

test('Studio/Work require add-on when billing is enforced', () => {
  assert.equal(companyHasHubTool('studio', { billingEnforced: true, addOnCodes: [] }), false);
  assert.equal(
    companyHasHubTool('studio', { billingEnforced: true, addOnCodes: ['addon.tool.studio'] }),
    true,
  );
  assert.equal(companyHasHubTool('work', { billingEnforced: true, addOnCodes: [] }), false);
  assert.equal(
    companyHasHubTool('work', { billingEnforced: true, addOnCodes: ['addon.tool.work'] }),
    true,
  );
});

test('Hub cards lock uncontracted Studio/Work', () => {
  assert.equal(
    resolveHubCardAccess('studio', true, ['NEXUS'], { billingEnforced: true, addOnCodes: [] }),
    'locked',
  );
  assert.equal(
    resolveHubCardAccess('studio', true, ['NEXUS'], {
      billingEnforced: true,
      addOnCodes: ['addon.tool.studio'],
    }),
    'open',
  );
  assert.equal(resolveHubCardAccess('advisor', true, ['NEXUS'], { billingEnforced: true }), 'open');
});
