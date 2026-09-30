import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  discoveryYieldPromptHint,
  isDiscoveryUnlimited,
  maxDiscoveryPacks,
  maxEnrichCandidates,
  maxNormalizeCandidates,
  maxPerInstitution,
} from '@/lib/opportunity/discovery-caps';

describe('discovery-caps', () => {
  it('defaults to unlimited mode — no practical quantity ceiling', () => {
    assert.equal(isDiscoveryUnlimited(), true);
    assert.ok(maxNormalizeCandidates() >= 10_000);
    assert.ok(maxEnrichCandidates() >= 10_000);
    assert.ok(maxPerInstitution() >= 10_000);
    assert.equal(maxDiscoveryPacks(), 3);
    assert.match(discoveryYieldPromptHint(), /EVERY|no artificial/i);
    assert.doesNotMatch(discoveryYieldPromptHint(), /12–24/);
  });
});
