import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyContractKind,
  defaultIncubationProgram,
  programLoopsAnnually,
} from '../../lib/nexus-incubation-program';
import {
  contractLoops,
  inferOfferKind,
  quadForQuestion,
  scoreAtQuads,
} from '../../lib/nexus-at-cycle';
import { buildTechnicalBrief } from '../../lib/nexus-diagnostic-brief';
import { computeFullDiagnosticResult, listDiagnosticQuestions } from '../../lib/nexus-sector-diagnostic';

test('contract kind decides loop vs close', () => {
  assert.equal(contractLoops('permanent').annualReview, true);
  assert.equal(contractLoops('permanent').rediagnoseAfterMonths, 12);
  assert.equal(contractLoops('project').loops, false);
  assert.equal(contractLoops('punctual').annualReview, false);

  const perm = applyContractKind(defaultIncubationProgram(), 'permanent');
  assert.equal(perm.contractKind, 'permanent');
  assert.equal(perm.mode, 'ongoing');
  assert.equal(programLoopsAnnually(perm), true);

  const one = applyContractKind(defaultIncubationProgram(), 'punctual');
  assert.equal(one.contractKind, 'punctual');
  assert.equal(programLoopsAnnually(one), false);
});

test('offer kind and 360 quads feed the diagnostic document', () => {
  assert.equal(inferOfferKind({ core_offer: 'both' }), 'both');
  assert.equal(quadForQuestion({ id: 'lvl_cash', pillarSlug: 'finance' }), 'management');
  assert.equal(quadForQuestion({ id: 'sec_agr_market', section: 'sector' }), 'commercial');
  assert.equal(quadForQuestion({ id: 'prod_layer', section: 'production' }), 'production');

  const program = defaultIncubationProgram();
  const qs = listDiagnosticQuestions('livestock', program);
  const answers: Record<string, string> = {};
  qs.forEach((q) => {
    answers[q.id] = q.id === 'core_offer' ? 'both' : q.options[0]?.id || '';
  });
  const diag = computeFullDiagnosticResult('livestock', qs, answers, 'pt');
  const brief = buildTechnicalBrief('livestock', diag, answers, 'pt');
  assert.equal(brief.offerKind, 'both');
  assert.match(brief.quantitative, /\/100/);
  assert.match(brief.qualitative, /Qualitativo|360/i);
  assert.ok(brief.quantitative.length > 40);
  const quads = scoreAtQuads(diag.weaknesses.concat(diag.strengths), 'pt');
  assert.ok(quads.length === 4);
});
