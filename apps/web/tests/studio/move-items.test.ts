import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

describe('studio move-items', () => {
  it('module exports descendant helper', async () => {
    const mod = await import('../../lib/studio/move-items');
    assert.equal(typeof mod.studioFolderIsDescendantOf, 'function');
  });
});
