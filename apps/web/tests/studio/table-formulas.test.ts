import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  displayTableCellValue,
  evaluateTableFormula,
  isTableFormula,
  tableCellRef,
} from '@/lib/studio/table-formulas';
import { parseMarkdownTable } from '@/lib/studio/table-markdown';

const TABLE = '| A | B |\n| --- | --- |\n| 10 | 20 |\n| 30 | 40 |';

describe('table-formulas', () => {
  it('detects formula cells', () => {
    assert.equal(isTableFormula('=SUM(A2:A3)'), true);
    assert.equal(isTableFormula('100'), false);
  });

  it('evaluates SUM, AVG, MIN, MAX', () => {
    const grid = parseMarkdownTable(TABLE)!;
    assert.equal(evaluateTableFormula('=SUM(B2:B3)', grid), '60');
    assert.equal(evaluateTableFormula('=AVG(A2:B3)', grid), '25');
    assert.equal(evaluateTableFormula('=MIN(A2:B3)', grid), '10');
    assert.equal(evaluateTableFormula('=MAX(A2:B3)', grid), '40');
  });

  it('resolves nested formula references', () => {
    const grid = parseMarkdownTable('| Valor |\n| --- |\n| 5 |\n| =SUM(A2:A2) |')!;
    assert.equal(displayTableCellValue('=SUM(A2:A3)', grid), '10');
  });

  it('returns cell ref labels', () => {
    assert.equal(tableCellRef(0, 0), 'A2');
    assert.equal(tableCellRef(1, 1), 'B3');
  });
});
