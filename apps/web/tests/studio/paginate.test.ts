import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { StudioCanvasState } from '@/lib/studio/types';
import {
  mergeStudioDocument,
  reflowStudioDocument,
  studioCanvasTextLength,
  studioLikelyOverPaginated,
} from '@/lib/studio/paginate';

function makeParagraphPage(order: number, text: string): StudioCanvasState['pages'][0] {
  return {
    id: `page-${order}`,
    title: `Página ${order + 1}`,
    order,
    pageSize: 'A4',
    layoutMode: 'blank',
    moldId: null,
    blocks: [
      {
        id: `block-${order}`,
        kind: 'paragraph',
        text,
        order: 0,
      },
    ],
  };
}

function makeOverPaginated(n: number): StudioCanvasState {
  const pages = Array.from({ length: n }, (_, i) =>
    makeParagraphPage(i, `Parágrafo ${i + 1} — conteúdo da secção ${i + 1}.`),
  );
  return {
    format: 'report',
    pageSize: 'A4',
    orientation: 'portrait',
    studioMode: 'write',
    pages,
  };
}

describe('studio paginate', () => {
  it('detects over-paginated documents (picote)', () => {
    assert.equal(studioLikelyOverPaginated(makeOverPaginated(98)), true);
    assert.equal(studioLikelyOverPaginated(makeOverPaginated(3)), false);
  });

  it('mergeStudioDocument joins picote without losing text', () => {
    const src = makeOverPaginated(98);
    const merged = mergeStudioDocument(src);
    assert.ok(merged.pages.length < 98);
    assert.ok(merged.pages.length > 0);
    for (let i = 0; i < 98; i++) {
      const needle = `Parágrafo ${i + 1}`;
      const hay = merged.pages.map((p) => p.blocks.map((b) => b.text).join('\n')).join('\n');
      assert.ok(hay.includes(needle), `missing ${needle}`);
    }
  });

  it('reflow after editing first block keeps all content', () => {
    const merged = mergeStudioDocument(makeOverPaginated(98));
    const firstPage = merged.pages[0]!;
    const firstBlock = firstPage.blocks[0]!;
    const edited: StudioCanvasState = {
      ...merged,
      pages: merged.pages.map((p) =>
        p.id !== firstPage.id
          ? p
          : {
              ...p,
              blocks: p.blocks.map((b) =>
                b.id === firstBlock.id ? { ...b, text: `${b.text}\nLinha extra.` } : b,
              ),
            },
      ),
    };
    const reflowed = reflowStudioDocument(edited, { pageTitlePrefix: 'Página' });
    assert.ok(reflowed.pages.length > 1);
    assert.ok(studioCanvasTextLength(reflowed) >= studioCanvasTextLength(merged));
  });
});
