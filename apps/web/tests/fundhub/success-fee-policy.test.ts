import test from 'node:test';
import assert from 'node:assert/strict';
import { successFeeAllowed } from '../../lib/fundhub/success-fee-policy';

test('success fee blocked for public and university accounts', () => {
  assert.equal(successFeeAllowed('universidad pública'), false);
  assert.equal(successFeeAllowed('Ministerio de Economía'), false);
  assert.equal(successFeeAllowed('consultoria privada SRL'), true);
  assert.equal(successFeeAllowed(null), true);
});
