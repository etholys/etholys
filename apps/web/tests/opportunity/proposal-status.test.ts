import test from 'node:test';
import assert from 'node:assert/strict';
import {
  nextProposalStatuses,
  parseProposalStatus,
  proposalMatchesStatusFilter,
  proposalStatusLabel,
  proposalStatusToPipeline,
} from '../../lib/opportunity/proposal-status';

test('parseProposalStatus normalizes legacy archived/won', () => {
  assert.equal(parseProposalStatus('archived'), 'withdrawn');
  assert.equal(parseProposalStatus('won'), 'approved');
  assert.equal(parseProposalStatus('revision_requested'), 'revision_requested');
  assert.equal(parseProposalStatus('nope'), 'draft');
});

test('next transitions from draft include submitted', () => {
  assert.deepEqual(nextProposalStatuses('draft'), ['submitted', 'withdrawn']);
  assert.ok(nextProposalStatuses('submitted').includes('approved'));
  assert.ok(nextProposalStatuses('revision_requested').includes('resubmitted'));
});

test('status filters group in-progress and closed', () => {
  assert.equal(proposalMatchesStatusFilter('submitted', 'in_progress'), true);
  assert.equal(proposalMatchesStatusFilter('resubmitted', 'in_progress'), true);
  assert.equal(proposalMatchesStatusFilter('draft', 'in_progress'), false);
  assert.equal(proposalMatchesStatusFilter('rejected', 'closed'), true);
  assert.equal(proposalMatchesStatusFilter('withdrawn', 'closed'), true);
  assert.equal(proposalMatchesStatusFilter('approved', 'approved'), true);
});

test('labels are locale-aware (es default)', () => {
  assert.equal(proposalStatusLabel('approved', 'es'), 'Aprobada');
  assert.equal(proposalStatusLabel('approved', 'pt'), 'Aprovada');
  assert.equal(proposalStatusLabel('approved', 'en'), 'Approved');
  assert.equal(proposalStatusLabel('draft', 'es'), 'Borrador');
});

test('pipeline mapping for En curso sync', () => {
  assert.equal(proposalStatusToPipeline('submitted'), 'submitted');
  assert.equal(proposalStatusToPipeline('approved'), 'won');
  assert.equal(proposalStatusToPipeline('rejected'), 'lost');
  assert.equal(proposalStatusToPipeline('draft'), null);
});
