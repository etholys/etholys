import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BILLING_CATALOG,
  commissionAmountCents,
  getSku,
  periodBounds,
  quoteSku,
  yearlyFromMonthly,
} from '../../lib/billing/catalog';

test('catalog covers plans, systems, add-ons, licenses and commissions', () => {
  const kinds = new Set(BILLING_CATALOG.map((s) => s.kind));
  for (const k of ['plan', 'system', 'addon', 'license', 'commission'] as const) {
    assert.ok(kinds.has(k), `missing kind ${k}`);
  }
  assert.ok(getSku('sys.ATLAS'));
  assert.ok(getSku('plan.institucional'));
  assert.ok(getSku('addon.siep.smart_import'));
  assert.ok(getSku('addon.atlas.smart_import'));
  assert.ok(getSku('commission.fundhub.success_fee'));
});

test('yearly list price is 10× monthly', () => {
  assert.equal(yearlyFromMonthly(14900), 149000);
  const atlas = getSku('sys.ATLAS')!;
  const month = quoteSku(atlas, 'MONTH');
  const year = quoteSku(atlas, 'YEAR');
  assert.ok(!('error' in month) && !('error' in year));
  assert.equal(year.priceCents, yearlyFromMonthly(month.priceCents));
});

test('annual license quote sums contracted systems', () => {
  const sku = getSku('license.annual')!;
  const empty = quoteSku(sku, 'YEAR', { licensedSystems: [] });
  assert.ok('error' in empty);
  const quoted = quoteSku(sku, 'YEAR', { licensedSystems: ['ATLAS', 'SIEP'] });
  assert.ok(!('error' in quoted));
  const atlas = getSku('sys.ATLAS')!.priceCents!;
  const siep = getSku('sys.SIEP')!.priceCents!;
  assert.equal(quoted.priceCents, yearlyFromMonthly(atlas + siep));
});

test('commission bps on captured funds', () => {
  assert.equal(commissionAmountCents(1_000_000, 250), 25_000);
  assert.equal(commissionAmountCents(0, 250), 0);
  assert.equal(commissionAmountCents(99, 1500), 15);
});

test('addons declare parent system', () => {
  const smart = getSku('addon.siep.smart_import')!;
  assert.deepEqual(smart.requiresSystems, ['SIEP']);
  const atlasSmart = getSku('addon.atlas.smart_import')!;
  assert.deepEqual(atlasSmart.requiresSystems, ['ATLAS']);
  const fee = getSku('commission.fundhub.success_fee')!;
  assert.deepEqual(fee.requiresSystems, ['FUNDHUB']);
  assert.equal(fee.commissionBps, 250);
});

test('period bounds advance month and year', () => {
  const from = new Date(Date.UTC(2026, 0, 15));
  const m = periodBounds(from, 'MONTH');
  assert.equal(m.end.getUTCMonth(), 1);
  const y = periodBounds(from, 'YEAR');
  assert.equal(y.end.getUTCFullYear(), 2027);
});
