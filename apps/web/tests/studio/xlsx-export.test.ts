import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { extractStudioXlsxSheets, studioCanvasToXlsxBuffer } from '@/lib/studio/xlsx-export';
import { emptyStudioCanvas } from '@/lib/studio/types';

describe('xlsx export', () => {
  it('extracts table blocks as sheets', () => {
    const canvas = emptyStudioCanvas('report');
    canvas.pages[0]!.blocks = [
      {
        id: 't1',
        kind: 'table',
        text: '| KPI | Valor |\n| --- | --- |\n| Vendas | 100 |',
        order: 0,
      },
    ];
    const sheets = extractStudioXlsxSheets(canvas);
    assert.equal(sheets.length, 1);
    assert.equal(sheets[0]!.headers[0], 'KPI');
    assert.equal(sheets[0]!.rows[0]![1], '100');
  });

  it('produces valid xlsx zip', async () => {
    const canvas = emptyStudioCanvas('report');
    canvas.pages[0]!.blocks = [
      {
        id: 't1',
        kind: 'table',
        text: '| A | B |\n| --- | --- |\n| 1 | 2 |',
        order: 0,
      },
    ];
    const buf = await studioCanvasToXlsxBuffer('Test', canvas);
    assert.ok(buf.length > 200);
    assert.equal(buf[0], 0x50);
  });
});
