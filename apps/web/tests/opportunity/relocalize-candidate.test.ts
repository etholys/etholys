import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  candidateNeedsRelocalization,
  detectNarrativeLocale,
  looksLikePortuguese,
  looksLikeSpanish,
} from '@/lib/opportunity/relocalize-candidate-locale';
import type { ScanCandidate } from '@/lib/opportunity/scan-types';

test('detects Portuguese vs Spanish narrative blobs', () => {
  assert.equal(looksLikePortuguese('Organizações sem fins lucrativos também podem candidatar-se após verificação.'), true);
  assert.equal(looksLikeSpanish('Las organizaciones sin fines de lucro también pueden postular según las bases.'), true);
  assert.equal(
    detectNarrativeLocale('Não são elegíveis organizações com atuação só comercial.'),
    'pt',
  );
  assert.equal(
    detectNarrativeLocale('Según las bases, quién puede postular después del plazo.'),
    'es',
  );
});

test('candidateNeedsRelocalization when hub locale mismatches narrative', () => {
  const ptCandidate = {
    name: 'Call',
    institution: 'Org',
    description:
      'Esta convocatória financia organizações sem fins lucrativos com atuação em inovação rural.',
    whoCanApply: 'ONGs e universidades também podem candidatar-se após elegibilidade.',
    eligibility: 'Não são elegíveis empresas só comerciais.',
  } as ScanCandidate;

  assert.equal(candidateNeedsRelocalization(ptCandidate, 'pt'), false);
  assert.equal(candidateNeedsRelocalization(ptCandidate, 'es'), true);
  assert.equal(candidateNeedsRelocalization(ptCandidate, 'en'), true);

  const esCandidate = {
    ...ptCandidate,
    description: 'Esta convocatoria financia organizaciones sin fines de lucro según las bases.',
    whoCanApply: 'ONG y universidades también pueden postular después del plazo.',
    eligibility: 'No son elegibles empresas solo comerciales.',
  } as ScanCandidate;

  assert.equal(candidateNeedsRelocalization(esCandidate, 'es'), false);
  assert.equal(candidateNeedsRelocalization(esCandidate, 'pt'), true);
});
