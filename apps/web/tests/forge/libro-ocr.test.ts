import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { searchLibroOcrText } from '../../lib/forge/libro-search';

describe('searchLibroOcrText', () => {
  it('finds snippets', () => {
    const text = 'La Expedición comienza con el módulo Raíces. Los alumnos exploran el territorio.';
    const hits = searchLibroOcrText(text, 'expedición');
    assert.ok(hits.length >= 1);
    assert.match(hits[0].snippet.toLowerCase(), /expedición/);
  });

  it('returns empty for short query', () => {
    assert.equal(searchLibroOcrText('hello', '  ').length, 0);
  });
});
