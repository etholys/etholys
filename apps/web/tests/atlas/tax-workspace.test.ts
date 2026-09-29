import test from 'node:test';
import assert from 'node:assert/strict';
import {
  summarizeTaxYear,
  countryPack,
  normalizeCountryCode,
  filingLabel,
  fiscalRange,
} from '../../lib/atlas/tax-workspace';

test('calendar year range is Jan 1–next Jan 1 UTC', () => {
  const r = fiscalRange(2025, 1);
  assert.equal(r.start.toISOString(), '2025-01-01T00:00:00.000Z');
  assert.equal(r.end.toISOString(), '2026-01-01T00:00:00.000Z');
});

test('cash books ignore PROJECT_ONLY and FORECAST', () => {
  const s = summarizeTaxYear(
    [
      { type: 'INCOME', amount: 1000, scope: 'SHARED', executionStatus: 'EXECUTED', category: 'Sales' },
      { type: 'EXPENSE', amount: 200, scope: 'COMPANY_ONLY', executionStatus: 'EXECUTED', category: 'Fuel' },
      { type: 'EXPENSE', amount: 560, scope: 'PROJECT_ONLY', executionStatus: 'EXECUTED', category: 'Imputed' },
      { type: 'INCOME', amount: 50, scope: 'SHARED', executionStatus: 'FORECAST', category: 'Sales' },
      { type: 'TRANSFER_IN', amount: 80, scope: 'COMPANY_ONLY', origin: 'REIMBURSEMENT', executionStatus: 'EXECUTED', category: 'Reimb' },
    ],
    [],
    { taxYear: 2025, currency: 'USD' },
  );
  assert.equal(s.cashIncome, 1080);
  assert.equal(s.cashExpense, 200);
  assert.equal(s.cashResult, 880);
  assert.equal(s.projectOnlyOut, 560);
  assert.equal(s.forecastIncome, 50);
  assert.equal(s.reimbursementIn, 80);
  assert.equal(s.executedCount, 4);
});

test('invoice VAT splits output vs input and skips drafts', () => {
  const s = summarizeTaxYear(
    [],
    [
      { type: 'RECEIVABLE', status: 'PAID', taxAmount: 22, total: 122 },
      { type: 'PAYABLE', status: 'SENT', taxAmount: 10, total: 110 },
      { type: 'RECEIVABLE', status: 'DRAFT', taxAmount: 99, total: 999 },
      { type: 'PAYABLE', status: 'CANCELLED', taxAmount: 5, total: 50 },
    ],
    { taxYear: 2025, currency: 'UYU' },
  );
  assert.equal(s.invoiceOutputTax, 22);
  assert.equal(s.invoiceInputTax, 10);
  assert.equal(s.invoiceReceivableTotal, 122);
});

test('country packs are not US-only', () => {
  assert.equal(normalizeCountryCode('Uruguay'), 'UY');
  assert.equal(countryPack('BR').taxIdLabel, 'CNPJ');
  assert.ok(countryPack('BR').obligations.some((o) => o.id === 'irpj'));
  assert.ok(countryPack('XX').obligations.length >= 3);
  assert.equal(filingLabel('YEAR', 'pt'), 'Dossiê fiscal');
  assert.equal(filingLabel('1120', 'es'), 'US Form 1120');
});
