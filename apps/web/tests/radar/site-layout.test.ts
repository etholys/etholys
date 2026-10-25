import test from 'node:test';
import assert from 'node:assert/strict';
import {
  autoLayoutSpaces,
  mergeLayoutWithSpaces,
  moveSpace,
  parseRadarLayout,
  placeSpace,
  rotateSpace,
  sanitizeLayoutPatch,
  setSpaceRotation,
  unplaceSpace,
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
  assert.equal(merged.spaces.find((s) => s.id === 'b')?.placed, false);
  assert.ok(merged.spaces.find((s) => s.id === 'b'));
  assert.equal(merged.sensors[0]?.spaceId, 'a');
});

test('parse and sanitize keep rotation and explicit placement', () => {
  const doc = parseRadarLayout({
    spaces: [
      { id: 'p1', x: 10, y: 12, w: 20, h: 16, rotation: 375, placed: true },
      { id: 'p2', x: 30, y: 30, w: 20, h: 16 },
    ],
    sensors: [],
  });
  assert.ok(doc);
  assert.equal(doc!.spaces[0].rotation, 15);
  assert.equal(doc!.spaces[0].placed, true);
  assert.equal(doc!.spaces[1].placed, false);
  assert.equal(doc!.spaces[1].rotation, 0);
  const patch = sanitizeLayoutPatch(doc, new Set(['p1', 'p2']), new Set());
  assert.equal(patch!.spaces[0].rotation, 15);
  assert.equal(patch!.spaces[0].placed, true);
  assert.equal(patch!.spaces[1].placed, false);
});

test('place move rotate and unplace one space', () => {
  const base = parseRadarLayout({
    spaces: [{ id: 'a', x: 10, y: 10, w: 20, h: 16, placed: false }],
    sensors: [],
  })!;
  const placed = placeSpace(base, 'a', 50, 40);
  const spot = placed.spaces[0];
  assert.equal(spot.placed, true);
  assert.equal(spot.x, 40);
  assert.equal(spot.y, 32);
  const moved = moveSpace(placed, 'a', 20, 20);
  assert.equal(moved.spaces[0].x, 10);
  assert.equal(moved.spaces[0].y, 12);
  const turned = rotateSpace(moved, 'a', 15);
  assert.equal(turned.spaces[0].rotation, 15);
  const absolute = setSpaceRotation(turned, 'a', 47.3);
  assert.equal(absolute.spaces[0].rotation, 47.3);
  const wrapped = setSpaceRotation(absolute, 'a', -10);
  assert.equal(wrapped.spaces[0].rotation, 350);
  const cleared = unplaceSpace(wrapped, 'a');
  assert.equal(cleared.spaces[0].placed, false);
  assert.equal(cleared.spaces[0].id, 'a');
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
