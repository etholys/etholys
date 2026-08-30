import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  blockIdsToPageNumbers,
  previewStructurePatches,
} from '../../lib/studio/canvas-patch-preview';
import { emptyStudioCanvas } from '../../lib/studio/types';

describe('canvas-patch-preview', () => {
  it('maps block ids to page numbers', () => {
    const canvas = emptyStudioCanvas('report');
    const id = canvas.pages[0].blocks[0]!.id;
    assert.deepEqual(blockIdsToPageNumbers(canvas, [id]), [1]);
  });

  it('previews structure apply patches', () => {
    const canvas = emptyStudioCanvas('report');
    const proposal = `## Sección A\n- Punto 1\n\n## Sección B\n- Punto 2`;
    const preview = previewStructurePatches(canvas, proposal, 'apply');
    assert.ok(preview.sectionCount >= 2);
    assert.ok(preview.blockIds.length >= 2);
    assert.ok(preview.patchCount >= 2);
  });
});
