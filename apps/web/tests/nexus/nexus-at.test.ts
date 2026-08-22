import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AT_CASE_KINDS,
  AT_ENGAGEMENT_KINDS,
  AT_OPEN_STATUSES,
  buildAtCaseTags,
  enrichAtCase,
  isAtOpenStatus,
  parseAtCaseKindFromTags,
  parseAtEngagementIdFromTags,
  parseAtProjectIdFromTags,
} from '../../lib/nexus-at';

test('exposes engagement and case kinds', () => {
  assert.ok(AT_ENGAGEMENT_KINDS.includes('CONTRACT'));
  assert.ok(AT_CASE_KINDS.includes('visit'));
  assert.ok(AT_OPEN_STATUSES.includes('TODO'));
});

test('builds and parses case tags with project', () => {
  const tags = buildAtCaseTags('eng_1', 'proj_9', 'visit');
  assert.match(tags, /nexus:at/);
  assert.match(tags, /nexus:at-engagement:eng_1/);
  assert.match(tags, /nexus:at-project:proj_9/);
  assert.equal(parseAtCaseKindFromTags(tags), 'visit');
  assert.equal(parseAtProjectIdFromTags(tags), 'proj_9');
  assert.equal(parseAtEngagementIdFromTags(tags), 'eng_1');
});

test('enriches case with open flag', () => {
  const e = enrichAtCase({ tags: buildAtCaseTags('e', 'p', 'call'), status: 'IN_PROGRESS' });
  assert.equal(e.caseKind, 'call');
  assert.equal(e.isOpen, true);
  assert.equal(isAtOpenStatus('DONE'), false);
});
