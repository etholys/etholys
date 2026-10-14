import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeLegalCountries } from '../../lib/opportunity/legal-countries';

test('acrescenta um segundo país sem apagar o primeiro', () => {
  assert.deepEqual(mergeLegalCountries(['Brasil'], 'Uruguay'), ['Brasil', 'Uruguay']);
});

test('aceita vários de uma vez e ignora repetidos', () => {
  assert.deepEqual(mergeLegalCountries(['Brasil'], 'Uruguay, brasil, Perú'), ['Brasil', 'Uruguay', 'Perú']);
});
