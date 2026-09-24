import test from 'node:test';
import assert from 'node:assert/strict';
import { clipBasesText, mergeBasesParts } from '../../lib/opportunity/bases-text';

test('clipBasesText trims and caps', () => {
  assert.equal(clipBasesText('  hello   world  '), 'hello world');
  const long = 'x'.repeat(50);
  assert.equal(clipBasesText(long, 10).endsWith('…'), true);
  assert.ok(clipBasesText(long, 10).length <= 11);
});

test('mergeBasesParts keeps titles and drops empty', () => {
  const text = mergeBasesParts([
    { title: 'Bases', text: 'Elegibilidade para cooperativas.' },
    { title: 'Vazio', text: '   ' },
  ]);
  assert.match(text, /### Bases/);
  assert.match(text, /cooperativas/);
  assert.equal(text.includes('Vazio'), false);
});
