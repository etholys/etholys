import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  parseReviewStatus,
  reviewStatusLabel,
  isProposalReviewStatus,
} from '../../lib/opportunity/proposal-review';

describe('proposal-review', () => {
  it('parses and labels statuses', () => {
    assert.equal(parseReviewStatus('approved'), 'approved');
    assert.equal(parseReviewStatus('nope'), 'draft');
    assert.equal(isProposalReviewStatus('in_review'), true);
    assert.match(reviewStatusLabel('approved', 'pt'), /Aprov/);
  });
});
