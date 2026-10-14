import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeLegalCountries, normalizeLegalCountries } from '../../lib/opportunity/legal-countries';

test('acrescenta um segundo país sem apagar o primeiro', () => {
  assert.deepEqual(mergeLegalCountries(['Brasil'], 'Uruguay'), ['Brasil', 'Uruguay']);
});

test('aceita vários de uma vez e ignora repetidos', () => {
  assert.deepEqual(mergeLegalCountries(['Brasil'], 'Uruguay, brasil, Perú'), ['Brasil', 'Uruguay', 'Perú']);
});

test('não descarta países depois do primeiro ao ler texto ou um único elemento', () => {
  assert.deepEqual(normalizeLegalCountries('Brasil, Uruguay, Perú'), ['Brasil', 'Uruguay', 'Perú']);
  assert.deepEqual(normalizeLegalCountries(['Brasil, Uruguay']), ['Brasil', 'Uruguay']);
  assert.deepEqual(normalizeLegalCountries(['Brasil', 'Uruguay']), ['Brasil', 'Uruguay']);
});

test('limita a lista a 20 países', () => {
  const many = Array.from({ length: 25 }, (_, i) => `País ${i + 1}`);
  assert.equal(normalizeLegalCountries(many).length, 20);
  assert.equal(normalizeLegalCountries(many)[0], 'País 1');
  assert.equal(normalizeLegalCountries(many)[19], 'País 20');
});
