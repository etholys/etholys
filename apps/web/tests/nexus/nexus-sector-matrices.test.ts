import test from 'node:test';
import assert from 'node:assert/strict';
import { hasDeepSectorMatrix, matrixItemsToDxQuestions } from '../../lib/nexus-sector-matrices';
import { listDiagnosticQuestions } from '../../lib/nexus-sector-diagnostic';
import { defaultIncubationProgram } from '../../lib/nexus-incubation-program';

test('agriculture and agroindustry have deep matrices', () => {
  assert.equal(hasDeepSectorMatrix('agriculture'), true);
  assert.equal(hasDeepSectorMatrix('agroindustry'), true);
  assert.equal(hasDeepSectorMatrix('retail_supermarket'), false);
});

test('matrix questions use CMM 1-5 options', () => {
  const qs = matrixItemsToDxQuestions('agriculture', 'standard');
  assert.ok(qs.length >= 10);
  assert.equal(qs[0]?.options.length, 5);
  assert.equal(qs[0]?.options[0]?.id, 'cmm1');
  assert.equal(qs[0]?.options[4]?.score, 100);
  assert.match(qs[0]!.prompt.es, /Nivel de madurez/i);
  assert.ok(qs[0]!.help.es.length > 40);
});

test('listDiagnosticQuestions uses layers first; matrix only on deep+', () => {
  const standard = listDiagnosticQuestions('agriculture', defaultIncubationProgram());
  assert.ok(standard.some((q) => q.id === 'core_scale'));
  assert.ok(standard.some((q) => q.section === 'sector'));
  assert.ok(!standard.some((q) => q.id.startsWith('AGR-')));

  const deepProg = defaultIncubationProgram();
  deepProg.diagnosticDepth = 'deep';
  const deep = listDiagnosticQuestions('agriculture', deepProg);
  assert.ok(deep.some((q) => q.id.startsWith('AGR-')));
});
