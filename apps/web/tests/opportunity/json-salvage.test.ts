import test from 'node:test';
import assert from 'node:assert/strict';
import { salvageJsonText, truncateForStructure } from '../../lib/opportunity/json-salvage';

test('salvage recovers truncated candidates array', () => {
  const raw = `{"candidates":[{"name":"A","institution":"X"},{"name":"B","institution":"Y","descrip`;
  const fixed = salvageJsonText(raw);
  const parsed = JSON.parse(fixed) as { candidates: unknown[] };
  assert.ok(parsed.candidates.length >= 1);
  assert.equal((parsed.candidates[0] as { name: string }).name, 'A');
});

test('truncateForStructure caps long research', () => {
  const long = 'x'.repeat(50_000);
  const out = truncateForStructure(long, 1000);
  assert.ok(out.length < 1200);
  assert.match(out, /truncated/i);
});
