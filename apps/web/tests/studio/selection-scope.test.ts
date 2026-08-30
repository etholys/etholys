import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { emptyStudioCanvas } from '../../lib/studio/types';
import {
  blockLabelWithPage,
  buildScopeSummary,
  pageSelectionState,
  togglePageBlockSelection,
} from '../../lib/studio/selection-scope';

describe('selection-scope', () => {
  const canvas = emptyStudioCanvas('report');
  canvas.pages[0].blocks.push({
    id: 'block-h2',
    kind: 'heading',
    title: 'Secção 2',
    text: '## Secção 2',
    order: 2,
  });

  it('detects full page selection', () => {
    const ids = canvas.pages[0].blocks.map((b) => b.id);
    assert.equal(pageSelectionState(canvas, canvas.pages[0].id, ids), 'full');
  });

  it('toggles page blocks', () => {
    const next = togglePageBlockSelection(canvas, canvas.pages[0].id, []);
    assert.equal(next.length, canvas.pages[0].blocks.length);
    const cleared = togglePageBlockSelection(canvas, canvas.pages[0].id, next);
    assert.equal(cleared.length, 0);
  });

  it('labels block with page number', () => {
    const label = blockLabelWithPage(canvas, 'block-h2');
    assert.match(label, /P\.1/);
  });

  it('summarizes scope by page', () => {
    const summary = buildScopeSummary(canvas, ['block-title']);
    assert.equal(summary.blockCount, 1);
    assert.deepEqual(summary.pageNumbers, [1]);
  });
});
