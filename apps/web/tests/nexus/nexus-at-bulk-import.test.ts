import test from 'node:test';
import assert from 'node:assert/strict';
import { parseBulkMipymeText } from '../../lib/nexus-at-bulk-import';

test('parses one name per line', () => {
  const r = parseBulkMipymeText('Cooperativa El Sol\nPadaria Norte');
  assert.equal(r.rows.length, 2);
  assert.equal(r.rows[0]?.name, 'Cooperativa El Sol');
  assert.equal(r.rows[1]?.name, 'Padaria Norte');
});

test('parses semicolon columns and skips header', () => {
  const r = parseBulkMipymeText(
    'nombre,sigla,sector\nTransportes Lima;TL;transport_logistics\nPanadería Norte;PN;food_hospitality'
  );
  assert.equal(r.rows.length, 2);
  assert.equal(r.rows[0]?.shortName, 'TL');
  assert.equal(r.rows[0]?.sectorId, 'transport_logistics');
  assert.equal(r.rows[1]?.sectorId, 'food_hospitality');
});

test('uses default sector when column missing', () => {
  const r = parseBulkMipymeText('Mi Empresa', 'agriculture');
  assert.equal(r.rows[0]?.sectorId, 'agriculture');
});

test('deduplicates by name', () => {
  const r = parseBulkMipymeText('Alpha\nalpha\nBeta');
  assert.equal(r.rows.length, 2);
  assert.equal(r.skipped, 1);
});
