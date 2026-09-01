import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  studioEditorSelectionAtDocEnd,
  studioEditorSelectionAtDocStart,
  studioSafeEditorSerializedText,
} from '@/lib/studio/rich-text';

/** Minimal ProseMirror-like resolved pos for unit tests. */
function mockPos(opts: {
  parentOffset: number;
  depth: number;
  indices: number[];
  childCounts: number[];
  parentSize: number;
}) {
  return {
    parentOffset: opts.parentOffset,
    depth: opts.depth,
    index: (d: number) => opts.indices[d] ?? 0,
    node: (d: number) => ({ childCount: opts.childCounts[d] ?? 1 }),
    parent: { content: { size: opts.parentSize } },
  };
}

describe('studio rich-text editor boundaries', () => {
  it('detects doc start only on first top-level block', () => {
    const docStart = mockPos({ parentOffset: 0, depth: 1, indices: [0, 0], childCounts: [2, 1], parentSize: 0 });
    const para2Start = mockPos({ parentOffset: 0, depth: 1, indices: [1, 0], childCounts: [2, 1], parentSize: 0 });
    assert.equal(studioEditorSelectionAtDocStart(docStart, true), true);
    assert.equal(studioEditorSelectionAtDocStart(para2Start, true), false);
  });

  it('detects doc end only on last top-level block', () => {
    const para1End = mockPos({ parentOffset: 5, depth: 1, indices: [0, 0], childCounts: [2, 1], parentSize: 5 });
    const docEnd = mockPos({ parentOffset: 8, depth: 1, indices: [1, 0], childCounts: [2, 1], parentSize: 8 });
    assert.equal(studioEditorSelectionAtDocEnd(para1End, true), false);
    assert.equal(studioEditorSelectionAtDocEnd(docEnd, true), true);
  });

  it('blocks empty serialization when plain text remains', () => {
    assert.equal(studioSafeEditorSerializedText('<p></p>', 12), null);
    assert.equal(studioSafeEditorSerializedText('<p>Olá</p>', 3), 'Olá');
  });
});
