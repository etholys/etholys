import test from 'node:test';
import assert from 'node:assert/strict';
import { formatApplicantProfileForAnalysis } from '../../lib/opportunity/applicant-profile';
import type { OpportunityBriefing } from '../../lib/opportunity/scan-types';

const baseBriefing: OpportunityBriefing = {
  themes: ['bioeconomia'],
  countries: ['Uruguay'],
  kinds: ['grant'],
  orgKind: 'coop',
};

test('perfil preenchido não pede o tipo de empresa de novo', () => {
  const { block, hasProfile } = formatApplicantProfileForAnalysis({
    name: 'Frutalcoop',
    description: 'Cooperativa de frutas no interior.',
    sector: 'Agricultura',
    country: 'Uruguay',
    entityKind: 'cooperative',
    briefing: baseBriefing,
  });
  assert.equal(hasProfile, true);
  assert.match(block, /Frutalcoop/);
  assert.match(block, /Cooperativa de frutas/);
  assert.match(block, /cooperativa ou associação/);
  assert.match(block, /Não perguntes de novo/);
  assert.doesNotMatch(block, /tipo de organização,/);
});

test('perfil vazio aponta o que falta no registo em vez de dizer que não há empresa', () => {
  const { block, hasProfile } = formatApplicantProfileForAnalysis({
    name: 'Rural Commerce',
    briefing: { themes: [], countries: [], kinds: ['grant'] },
  });
  assert.equal(hasProfile, false);
  assert.match(block, /Não digas que a empresa não existe/);
  assert.match(block, /tipo de organização/);
  assert.match(block, /descrição da organização/);
});
