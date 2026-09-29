import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { matrixToImportText, parseFunderImportText } from '@/lib/opportunity/funder-import';

describe('funder-import', () => {
  it('parses pipe rows and marks ok', () => {
    const rows = parseFunderImportText(
      'Nombre|Institución|URL\nAECID 2026|AECID|https://www.aecid.es/call',
    );
    assert.equal(rows.length, 1);
    assert.equal(rows[0].ok, true);
    assert.equal(rows[0].name, 'AECID 2026');
    assert.equal(rows[0].institution, 'AECID');
  });

  it('flags missing name', () => {
    const rows = parseFunderImportText('|OnlyInst|https://x.com');
    assert.equal(rows[0].ok, false);
    assert.ok(rows[0].issues.includes('missing_name'));
  });

  it('matrixToImportText joins sheets', () => {
    const text = matrixToImportText([
      ['Name', 'Inst', 'URL'],
      ['Fondo X', 'BID', 'https://iadb.org'],
    ]);
    const rows = parseFunderImportText(text);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].name, 'Fondo X');
  });
});
