import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildYieldSnapshot, formatUsd } from '../../lib/opportunity/yield-stats';

describe('yield-stats', () => {
  it('computes last-run cost and $/candidate', () => {
    const snap = buildYieldSnapshot(
      [
        { id: 'a', status: 'completed', created: 10, estimatedCostUsd: 0.5, startedAt: '2026-09-29' },
        { id: 'b', status: 'completed', created: 4, estimatedCostUsd: 0.2, startedAt: '2026-09-28' },
      ],
      { pendingOpen: 3, pendingReference: 1, later: 2, catalogTotal: 12 },
    );
    assert.equal(snap.lastRunCostUsd, 0.5);
    assert.equal(snap.lastRunCandidates, 10);
    assert.equal(snap.costPerCandidateUsd, 0.05);
    assert.equal(snap.avgCostLastRunsUsd, 0.35);
    assert.equal(snap.runsWithCost, 2);
    assert.equal(snap.inboxOpen, 3);
    assert.equal(snap.catalogTotal, 12);
  });

  it('handles missing cost without NaN', () => {
    const snap = buildYieldSnapshot(
      [{ id: 'a', status: 'completed', created: 5 }],
      { pendingOpen: 0, pendingReference: 0, later: 0, catalogTotal: 0 },
    );
    assert.equal(snap.lastRunCostUsd, null);
    assert.equal(snap.costPerCandidateUsd, null);
    assert.equal(formatUsd(null), '—');
  });
});
