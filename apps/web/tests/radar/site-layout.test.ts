import test from 'node:test';
import assert from 'node:assert/strict';
import {
  autoLayoutSpaces,
  mergeLayoutWithSpaces,
  parseRadarLayout,
  sanitizeLayoutPatch,
} from '../../lib/radar/site-layout';

test('auto layout places all spaces on a grid', () => {
  const rects = autoLayoutSpaces(['a', 'b', 'c', 'd']);
  assert.equal(rects.length, 4);
  assert.ok(rects.every((r) => r.w >= 8 && r.h >= 8));
  assert.ok(rects.every((r) => r.x >= 0 && r.y >= 0 && r.x + r.w <= 100.1));
});

test('parseRadarLayout rejects junk and clamps coords', () => {
  assert.equal(parseRadarLayout(null), null);
  const doc = parseRadarLayout({
    spaces: [{ id: 'p1', x: -10, y: 200, w: 5, h: 50 }],
    sensors: [{ id: 's1', spaceId: 'p1', x: 150, y: -5 }],
  });
  assert.ok(doc);
  assert.equal(doc!.spaces[0].x, 0);
  assert.ok(doc!.spaces[0].y <= 95);
  assert.ok(doc!.spaces[0].w >= 8);
  assert.equal(doc!.sensors[0].x, 100);
  assert.equal(doc!.sensors[0].y, 0);
});

test('merge keeps saved positions and adds new spaces', () => {
  const merged = mergeLayoutWithSpaces(
    {
      version: 1,
      spaces: [{ id: 'a', x: 5, y: 5, w: 40, h: 40 }],
      sensors: [],
    },
    ['a', 'b'],
    [{ id: 's1', spaceId: 'a' }],
  );
  assert.equal(merged.spaces.find((s) => s.id === 'a')?.x, 5);
  assert.ok(merged.spaces.find((s) => s.id === 'b'));
  assert.equal(merged.sensors[0]?.spaceId, 'a');
});

test('sanitizeLayoutPatch drops unknown ids', () => {
  const patch = sanitizeLayoutPatch(
    {
      spaces: [
        { id: 'ok', x: 10, y: 10, w: 30, h: 30 },
        { id: 'nope', x: 0, y: 0, w: 20, h: 20 },
      ],
      sensors: [{ id: 'sens', spaceId: 'ok', x: 50, y: 50 }],
    },
    new Set(['ok']),
    new Set(['sens']),
  );
  assert.ok(patch);
  assert.equal(patch!.spaces.length, 1);
  assert.equal(patch!.spaces[0].id, 'ok');
  assert.equal(patch!.sensors.length, 1);
});
