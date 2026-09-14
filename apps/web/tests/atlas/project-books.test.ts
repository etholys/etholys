import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildProjectBooks,
  companyResultStatus,
} from '../../lib/atlas/project-books';

const P = 'proj-impulsa';

test('560 imputed + 480 paid + fuel internal → informe 560, cash 560, margin from income', () => {
  const rows = buildProjectBooks(
    [
      { projectId: P, type: 'EXPENSE', amount: 560, scope: 'PROJECT_ONLY', executionStatus: 'EXECUTED', currency: 'USD' },
      { projectId: P, type: 'EXPENSE', amount: 480, scope: 'COMPANY_ONLY', executionStatus: 'EXECUTED', currency: 'USD' },
      { projectId: P, type: 'EXPENSE', amount: 80, scope: 'COMPANY_ONLY', executionStatus: 'EXECUTED', currency: 'USD' },
      { projectId: P, type: 'INCOME', amount: 560, scope: 'SHARED', executionStatus: 'EXECUTED', currency: 'USD' },
    ],
    [{ id: P, name: 'Impulsa' }],
  );
  assert.equal(rows.length, 1);
  const r = rows[0];
  assert.equal(r.imputedOut, 560);
  assert.equal(r.internalOut, 560);
  assert.equal(r.reportedOut, 560);
  assert.equal(r.companyOut, 560);
  assert.equal(r.companyIn, 560);
  assert.equal(r.companyResult, 0);
  assert.equal(companyResultStatus(r.companyResult), 'even');
});

test('SHARED airfare hits both books; COMPANY_ONLY chairs only hit cash', () => {
  const rows = buildProjectBooks([
    { projectId: P, type: 'EXPENSE', amount: 936.83, scope: 'SHARED', executionStatus: 'EXECUTED' },
    { projectId: P, type: 'EXPENSE', amount: 50, scope: 'COMPANY_ONLY', executionStatus: 'EXECUTED' },
  ]);
  const r = rows[0];
  assert.equal(r.sharedOut, 936.83);
  assert.equal(r.internalOut, 50);
  assert.equal(r.reportedOut, 936.83);
  assert.equal(r.companyOut, 986.83);
});

test('reimbursement covers internal cash and never hits SIEP', () => {
  const rows = buildProjectBooks([
    { projectId: P, type: 'EXPENSE', amount: 10000, scope: 'COMPANY_ONLY', executionStatus: 'EXECUTED' },
    {
      projectId: P,
      type: 'TRANSFER_IN',
      amount: 18171.9,
      scope: 'COMPANY_ONLY',
      origin: 'REIMBURSEMENT',
      executionStatus: 'EXECUTED',
    },
  ]);
  const r = rows[0];
  assert.equal(r.reportedIn, 0);
  assert.equal(r.reportedOut, 0);
  assert.equal(r.reimbursedIn, 18171.9);
  assert.equal(r.companyOut, 10000);
  assert.equal(r.companyResult, 8171.9);
  assert.equal(companyResultStatus(r.companyResult), 'margin');
});

test('FORECAST does not move executed books; COMPANY_ONLY income is cash-only', () => {
  const rows = buildProjectBooks([
    { projectId: P, type: 'EXPENSE', amount: 100, scope: 'SHARED', executionStatus: 'FORECAST' },
    { projectId: P, type: 'INCOME', amount: 200, scope: 'COMPANY_ONLY', executionStatus: 'EXECUTED' },
  ]);
  const r = rows[0];
  assert.equal(r.reportedOut, 0);
  assert.equal(r.companyOut, 0);
  assert.equal(r.reportedIn, 0);
  assert.equal(r.companyIn, 200);
  assert.equal(r.companyResult, 200);
  assert.equal(companyResultStatus(r.companyResult), 'margin');
  assert.equal(companyResultStatus(-1), 'loss');
});
