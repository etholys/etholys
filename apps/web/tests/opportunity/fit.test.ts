import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateFit, orgBucket } from '../../lib/opportunity/fit';
import type { OpportunityBriefing, ScanCandidate } from '../../lib/opportunity/scan-types';

const briefing = (over: Partial<OpportunityBriefing> = {}): OpportunityBriefing => ({
  themes: ['rural'],
  countries: ['Uruguay'],
  kinds: ['grant'],
  amountMax: 80_000,
  privateEligible: true,
  entityType: 'empresa privada',
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
  ...over,
});

test('orgBucket maps common labels', () => {
  assert.equal(orgBucket('empresa privada SRL'), 'private');
  assert.equal(orgBucket('ONG ambiental'), 'ngo');
  assert.equal(orgBucket('Ministerio de Agricultura'), 'public');
});

test('country mismatch is no-go', () => {
  const fit = evaluateFit(candidate({ eligibleCountries: 'Kenya, Uganda' }), briefing());
  const country = fit.items.find((i) => i.id === 'country');
  assert.equal(country?.status, 'no_go');
  assert.equal(fit.verdict, 'no_go');
});

test('private company vs public-only call is no-go', () => {
  const fit = evaluateFit(
    candidate({
      whoCanApply: 'Sólo entidades públicas y ministerios.',
      eligibility: 'No admite empresas.',
    }),
    briefing({ privateEligible: true, entityType: 'empresa privada' }),
  );
  assert.equal(fit.items.find((i) => i.id === 'org_type')?.status, 'no_go');
  assert.equal(fit.items.find((i) => i.id === 'private')?.status, 'no_go');
  assert.equal(fit.verdict, 'no_go');
});

test('matching grant still open is go or caution, never no-go', () => {
  const fit = evaluateFit(candidate(), briefing(), { now: Date.parse('2026-09-24T12:00:00') });
  assert.notEqual(fit.verdict, 'no_go');
  assert.equal(fit.items.find((i) => i.id === 'kind')?.status, 'go');
  assert.equal(fit.items.find((i) => i.id === 'deadline')?.status, 'go');
  assert.equal(fit.items.find((i) => i.id === 'ceiling')?.status, 'go');
});

test('closed deadline and credit vs grant briefing is no-go', () => {
  const fit = evaluateFit(
    candidate({
      type: 'Crédito',
      availabilityStatus: 'closed',
      closesAt: '2026-01-01',
    }),
    briefing({ kinds: ['grant'] }),
    { now: Date.parse('2026-09-24T12:00:00') },
  );
  assert.equal(fit.items.find((i) => i.id === 'kind')?.status, 'no_go');
  assert.equal(fit.items.find((i) => i.id === 'deadline')?.status, 'no_go');
  assert.equal(fit.verdict, 'no_go');
});
