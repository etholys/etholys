import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getEconomicSector,
  listSectorCatalog,
  normalizeEconomicSectorId,
  parseCompanySectorId,
  sectorLabel,
} from '../../lib/nexus-economic-sectors';

test('lists economic sectors with focus areas and case kinds', () => {
  const catalog = listSectorCatalog();
  assert.ok(catalog.length >= 10);
  const ag = catalog.find((s) => s.id === 'agriculture');
  assert.ok(ag);
  assert.ok(ag!.focusAreas.length >= 2);
  assert.ok(ag!.suggestedCaseKinds.includes('visit'));
});

test('normalizes sector ids and labels', () => {
  assert.equal(normalizeEconomicSectorId(' agriculture '), 'agriculture');
  assert.equal(normalizeEconomicSectorId('unknown_xyz'), null);
  assert.equal(sectorLabel('food_hospitality', 'pt'), getEconomicSector('food_hospitality')!.label.pt);
});

test('reads sector from company context json', () => {
  assert.equal(parseCompanySectorId({ sectorId: 'livestock' }), 'livestock');
  assert.equal(parseCompanySectorId({ sectorId: 'bad' }), null);
  assert.equal(parseCompanySectorId(null), null);
});
