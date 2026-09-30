import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  filterInboxByProfileFit,
  scoreCandidateAgainstProfile,
  sortByProfileMatch,
  summarizeProfileYield,
} from '../../lib/opportunity/profile-match';
import type { OpportunityBriefing, ScanCandidate } from '../../lib/opportunity/scan-types';

const briefing = (over: Partial<OpportunityBriefing> = {}): OpportunityBriefing => ({
  themes: ['rural'],
  countries: ['Uruguay'],
  kinds: ['grant'],
  amountMax: 80_000,
  privateEligible: true,
  entityType: 'empresa privada',
  orgKind: 'private',
  legalCountries: ['Uruguay'],
  ...over,
});

const candidate = (over: Partial<ScanCandidate> = {}): ScanCandidate => ({
  tempId: 't1',
  name: 'ANDE rural 2026',
  institution: 'ANDE',
  type: 'Grant',
  whoCanApply: 'Empresas privadas y cooperativas rurales de Uruguay.',
  eligibility: 'Países elegibles: Uruguay.',
  amount: 50_000,
  currency: 'USD',
  closesAt: '2026-12-01',
  eligibleCountries: 'Uruguay',
  callUrl: 'https://www.ande.org.uy/convocatorias/rural-2026',
  availabilityStatus: 'open_now',
  ...over,
});

describe('profile-match', () => {
  it('scores a matching grant higher than a country mismatch', () => {
    const good = scoreCandidateAgainstProfile(candidate(), briefing(), {
      now: Date.parse('2026-09-24T12:00:00'),
    });
    const bad = scoreCandidateAgainstProfile(
      candidate({ eligibleCountries: 'Kenya', whoCanApply: 'NGOs in East Africa' }),
      briefing(),
      { now: Date.parse('2026-09-24T12:00:00') },
    );
    assert.ok(good.score > bad.score);
    assert.notEqual(good.verdict, 'no_go');
    assert.equal(bad.verdict, 'no_go');
  });

  it('sortByProfileMatch puts higher scores first', () => {
    const a = { ...candidate({ tempId: 'a', matchScore: 40 }), profileMatch: { score: 40, verdict: 'caution' as const, reasons: [] } };
    const b = { ...candidate({ tempId: 'b', matchScore: 90 }), profileMatch: { score: 90, verdict: 'go' as const, reasons: [] } };
    const sorted = sortByProfileMatch([a, b]);
    assert.equal(sorted[0].tempId, 'b');
  });

  it('filterInboxByProfileFit can drop hard no_go', () => {
    const kept = filterInboxByProfileFit(
      [
        candidate(),
        candidate({
          tempId: 't2',
          eligibleCountries: 'Kenya',
          whoCanApply: 'Only public ministries in Kenya.',
          type: 'Crédito',
          availabilityStatus: 'closed',
          closesAt: '2020-01-01',
        }),
      ],
      briefing({ kinds: ['grant'] }),
      { dropNoGo: true, now: Date.parse('2026-09-24T12:00:00') },
    );
    assert.equal(kept.length, 1);
    assert.equal(kept[0].tempId, 't1');
  });

  it('summarizeProfileYield counts verdicts', () => {
    const summary = summarizeProfileYield(
      [candidate(), candidate({ tempId: 't2', eligibleCountries: 'Kenya', whoCanApply: 'Kenya only' })],
      briefing(),
      { now: Date.parse('2026-09-24T12:00:00') },
    );
    assert.equal(summary.total, 2);
    assert.ok(summary.no_go >= 1);
    assert.ok(summary.avgScore > 0);
  });
});
