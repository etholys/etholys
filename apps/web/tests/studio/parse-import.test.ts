import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseImportedTextToCanvas, parseImportedTextToSinglePage } from '@/lib/studio/parse-import';

describe('parseImportedTextToCanvas', () => {
  it('parses headings, bullets, tables and callouts', () => {
    const text = [
      '# Intro',
      '',
      'INTRODUÇÃO',
      '',
      '- Item A',
      '- Item B',
      '',
      '| KPI | Valor |',
      '| --- | --- |',
      '| Vendas | 100 |',
      '',
      '> Nota importante',
      '',
      'Parágrafo final.',
    ].join('\n');

    const canvas = parseImportedTextToCanvas(text, 'Relatório Q1');
    assert.equal(canvas.studioMode, 'write');
    assert.ok(canvas.pages.length >= 1);

    const kinds = canvas.pages.flatMap((p) => p.blocks.map((b) => b.kind));
    assert.ok(kinds.includes('heading'));
    assert.ok(kinds.includes('bullets'));
    assert.ok(kinds.includes('table'));
    assert.ok(kinds.includes('callout'));
    assert.ok(kinds.includes('paragraph'));

    const table = canvas.pages.flatMap((p) => p.blocks).find((b) => b.kind === 'table');
    assert.match(table!.text, /Vendas/);
  });

  it('paginates long imports (~8 blocks per page)', () => {
    const lines = ['# Doc'];
    for (let i = 0; i < 12; i++) lines.push(`Parágrafo ${i + 1}.`);
    const canvas = parseImportedTextToCanvas(lines.join('\n\n'), '');
    assert.ok(canvas.pages.length >= 2);
  });
});

describe('parseImportedTextToSinglePage', () => {
  it('merges multi-page import into one page', () => {
    const lines = ['# Doc'];
    for (let i = 0; i < 12; i++) lines.push(`Parágrafo ${i + 1}.`);
    const canvas = parseImportedTextToSinglePage(lines.join('\n\n'), 'Import');
    assert.equal(canvas.pages.length, 1);
    assert.ok(canvas.pages[0]!.blocks.length >= 12);
  });
});
