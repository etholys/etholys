import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultIncubationProgram, depthFromProgram, workItemBudget } from '../../lib/nexus-incubation-program';
import {
  computeFullDiagnosticResult,
  listDiagnosticQuestions,
} from '../../lib/nexus-sector-diagnostic';
import { buildIncubationWorkPlan } from '../../lib/nexus-incubation-workplan';
import { fallbackAnalyze } from '../../lib/nexus-diagnostic-analyze';

test('standard program yields ~20 diagnostic questions', () => {
  const program = defaultIncubationProgram();
  program.durationMonths = 6;
  program.hoursPerMonth = 12;
  program.totalHours = 72;
  assert.equal(depthFromProgram(program), 'standard');
  const qs = listDiagnosticQuestions('food_hospitality', program);
  assert.ok(qs.length >= 18 && qs.length <= 24);
});

test('exhaustive depth includes many pillar questions', () => {
  const program = defaultIncubationProgram();
  program.diagnosticDepth = 'exhaustive';
  const qs = listDiagnosticQuestions('agriculture', program);
  assert.ok(qs.length >= 35);
});

test('full diagnostic separates strengths and weaknesses', () => {
  const program = defaultIncubationProgram();
  program.diagnosticDepth = 'standard';
  const qs = listDiagnosticQuestions('retail_shop', program);
  const answers: Record<string, string> = {};
  qs.forEach((q, i) => {
    const opt = q.options[i % 2 === 0 ? q.options.length - 1 : 0];
    answers[q.id] = opt?.id ?? 'partial';
  });
  const r = computeFullDiagnosticResult('retail_shop', qs, answers, 'pt');
  assert.ok(r.strengths.length > 0);
  assert.ok(r.weaknesses.length > 0);
  assert.ok(r.pillarScores.length >= 2);
});

test('work plan scales with program hours', () => {
  const program = defaultIncubationProgram();
  program.totalHours = 120;
  assert.ok(workItemBudget(program) >= 20);
  const qs = listDiagnosticQuestions('livestock', program);
  const answers: Record<string, string> = {};
  qs.forEach((q) => {
    answers[q.id] = 'partial';
  });
  const diag = computeFullDiagnosticResult('livestock', qs, answers, 'es');
  const plan = buildIncubationWorkPlan(program, diag, 'es');
  assert.ok(plan.items.length >= 8);
  assert.ok(plan.layers.length >= 2);
});

test('fallback analyze returns up to 12 priorities', () => {
  const program = defaultIncubationProgram();
  program.diagnosticDepth = 'deep';
  const qs = listDiagnosticQuestions('chemical_industry', program);
  const answers: Record<string, string> = {};
  qs.forEach((q) => {
    answers[q.id] = q.options[0]?.id ?? 'weak';
  });
  const payload = qs.map((q) => ({ id: q.id, question: q.prompt.es, answer: 'x', score: 30 }));
  const r = fallbackAnalyze({
    sectorId: 'chemical_industry',
    locale: 'es',
    answers: payload,
    answerIds: answers,
    program,
    finalize: true,
  });
  assert.ok(r.priorities.length <= 12);
  assert.ok(r.weaknesses.length > 0);
});
