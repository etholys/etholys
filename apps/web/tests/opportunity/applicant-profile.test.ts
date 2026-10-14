import test from 'node:test';
import assert from 'node:assert/strict';
import { formatApplicantProfileForAnalysis } from '../../lib/opportunity/applicant-profile';
import { formatSiepAtlasSummary } from '../../lib/opportunity/siep-atlas-summary';
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
    mission: 'Organizar produtores.',
    vision: 'Cadeia justa.',
    sector: 'Agricultura',
    country: 'Uruguay',
    entityKind: 'cooperative',
    siepAtlasSummary: formatSiepAtlasSummary({
      projects: [{ name: 'Horta escolar', country: 'Uruguay' }],
      activity: 'Agricultura',
      country: 'Uruguay',
    }),
    briefing: baseBriefing,
  });
  assert.equal(hasProfile, true);
  assert.match(block, /Frutalcoop/);
  assert.match(block, /Quem é: Cooperativa de frutas/);
  assert.match(block, /Missão: Organizar produtores/);
  assert.match(block, /Visão: Cadeia justa/);
  assert.match(block, /Horta escolar \(Uruguay\)/);
  assert.match(block, /ATLAS — actividade: Agricultura/);
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
  assert.match(block, /quem é a empresa/);
  assert.match(block, /missão/);
  assert.match(block, /visão/);
  assert.match(block, /sinais SIEP\/ATLAS/);
  assert.match(block, /Rural Commerce/);
});
