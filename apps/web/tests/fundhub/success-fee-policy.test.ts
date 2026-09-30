import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { successFeeAllowed, successFeeBlockReason } from '../../lib/fundhub/success-fee-policy';

describe('success-fee-policy', () => {
  it('blocks public entities and allows private consulting', () => {
    assert.equal(successFeeAllowed('universidad pública'), false);
    assert.equal(successFeeAllowed('Ministerio de Economía'), false);
    assert.equal(successFeeAllowed('consultoria privada SRL'), true);
    assert.equal(successFeeAllowed(null), true);
  });

  it('explains block reason', () => {
    const reason = successFeeBlockReason('universidad pública', null, 'pt');
    assert.ok(reason && /públic/.test(reason));
    assert.equal(successFeeBlockReason('consultora privada', null, 'es'), null);
  });
});
