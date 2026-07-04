import test from 'node:test';
import assert from 'node:assert/strict';
import { generateFeriaCode, normalizeRoomCode, pickRandomGroup } from '../../lib/forge/feria-kiosk-core';

test('normalizeRoomCode trims and uppercases', () => {
  assert.equal(normalizeRoomCode(' ab-c12 '), 'ABC12');
});

test('generateFeriaCode produces alphanumeric codes', () => {
  const code = generateFeriaCode(6);
  assert.equal(code.length, 6);
  assert.match(code, /^[A-Z2-9]+$/);
});

test('pickRandomGroup chooses group with space', () => {
  const groups = [
    { id: 'a', memberCount: 4 },
    { id: 'b', memberCount: 2 },
    { id: 'c', memberCount: 4 },
  ];
  assert.equal(pickRandomGroup(groups, 4)?.id, 'b');
});

test('pickRandomGroup returns null when full', () => {
  const groups = [
    { id: 'a', memberCount: 4 },
    { id: 'b', memberCount: 4 },
  ];
  assert.equal(pickRandomGroup(groups, 4), null);
});
