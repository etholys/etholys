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
});

test('listDiagnosticQuestions prefers deep matrix for agriculture', () => {
  const program = defaultIncubationProgram();
  const qs = listDiagnosticQuestions('agriculture', program);
  assert.ok(qs.some((q) => q.id.startsWith('AGR-')));
  assert.ok(qs.every((q) => q.id.startsWith('AGR-') || q.id.startsWith('u_')));
});
