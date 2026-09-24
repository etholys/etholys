import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultIncubationProgram, depthFromProgram, workItemBudget } from '../../lib/nexus-incubation-program';
import {
  computeFullDiagnosticResult,
  listDiagnosticQuestions,
  sectionLabel,
  toggleQuestionAnswer,
} from '../../lib/nexus-sector-diagnostic';
import { getSectorDiagnosticPack } from '../../lib/nexus-diagnostic-layers';
import { buildIncubationWorkPlan } from '../../lib/nexus-incubation-workplan';
import { fallbackAnalyze } from '../../lib/nexus-diagnostic-analyze';
import { normalizeEconomicSectorId, getEconomicSector } from '../../lib/nexus-economic-sectors';

test('apiculture sector exists in catalog', () => {
  assert.equal(normalizeEconomicSectorId('apicultura'), 'apiculture');
  assert.equal(normalizeEconomicSectorId('miel'), 'apiculture');
  assert.ok(getEconomicSector('apiculture'));
});

test('diagnostic has ordered layers with coherent blocker options', () => {
  const qs = listDiagnosticQuestions('apiculture', null);
  assert.equal(qs[0]?.section, 'core');
  assert.ok(qs.some((q) => q.section === 'level'));
  assert.ok(qs.some((q) => q.section === 'commercial'));
  assert.ok(qs.some((q) => q.section === 'sector'));
  assert.ok(qs.some((q) => q.section === 'production'));
  assert.equal(sectionLabel('commercial', 'es'), '3 · Comercialización');

  const blocker = qs.find((q) => q.id === 'core_blockers');
  assert.ok(blocker?.multi);
  assert.ok(blocker!.options.some((o) => /capital|caja/i.test(o.label.es)));
  assert.ok(!blocker!.options.some((o) => /muy débil/i.test(o.label.es)));
});

test('standard diagnosis asks offer and 360 management, then scores quads', () => {
  const program = defaultIncubationProgram();
  const qs = listDiagnosticQuestions('agriculture', program);
  assert.ok(qs.some((q) => q.id === 'core_offer'));
  assert.ok(qs.some((q) => q.id === 'lvl_accounting'));
  assert.ok(qs.some((q) => q.id === 'lvl_people'));
  assert.ok(qs.some((q) => q.id === 'prod_layer'));
  const answers: Record<string, string> = {};
  qs.forEach((q) => {
    answers[q.id] = q.id === 'core_offer' ? 'product' : q.options[0]?.id || '';
  });
  const r = computeFullDiagnosticResult('agriculture', qs, answers, 'es');
  assert.equal(r.offerKind, 'product');
  assert.equal(r.quads.length, 4);
  assert.ok(r.quads.every((q) => q.answered > 0 || q.id === 'commercial' || q.score >= 0));
  assert.ok(r.quads.some((q) => q.id === 'structuring'));
  assert.ok(r.quads.some((q) => q.id === 'management'));
  assert.ok(r.quads.some((q) => q.id === 'production'));
  assert.ok(r.quads.some((q) => q.id === 'commercial'));
});

test('apiculture pack asks about hives not land tenure', () => {
  const pack = getSectorDiagnosticPack('apiculture');
  const text = pack.map((q) => q.prompt.es).join(' ');
  assert.match(text, /colmena|miel|varroa|flora/i);
  assert.doesNotMatch(text, /hectárea|siembra/i);
});

test('core_blockers multi-select scores the worst selected blocker', () => {
  const qs = listDiagnosticQuestions('retail_shop', null);
  const blocker = qs.find((q) => q.id === 'core_blockers')!;
  let raw = toggleQuestionAnswer(blocker, undefined, 'market');
  raw = toggleQuestionAnswer(blocker, raw, 'team');
  assert.equal(raw, 'market,team');
  assert.equal(toggleQuestionAnswer(blocker, raw, 'none'), 'none');
  const r = computeFullDiagnosticResult('retail_shop', [blocker], { core_blockers: 'market,team' }, 'es');
  assert.equal(r.overall, 36);
});

test('standard program yields layered question count', () => {
  const program = defaultIncubationProgram();
  program.durationMonths = 6;
  program.hoursPerMonth = 12;
  program.totalHours = 72;
  assert.equal(depthFromProgram(program), 'standard');
  const qs = listDiagnosticQuestions('food_hospitality', program);
  assert.ok(qs.length >= 16 && qs.length <= 24);
  assert.ok(qs.every((q) => q.options.length >= 3));
});

test('exhaustive agriculture adds matrix on top of layers', () => {
  const program = defaultIncubationProgram();
  program.diagnosticDepth = 'exhaustive';
  const qs = listDiagnosticQuestions('agriculture', program);
  assert.ok(qs.length >= 30);
  assert.ok(qs.some((q) => q.id === 'core_blockers'));
  assert.ok(qs.some((q) => q.id.startsWith('AGR-')));
});

test('full diagnostic separates strengths and weaknesses', () => {
  const program = defaultIncubationProgram();
  program.diagnosticDepth = 'standard';
  const qs = listDiagnosticQuestions('retail_shop', program);
  const answers: Record<string, string> = {};
  qs.forEach((q, i) => {
    const opt = q.options[i % 2 === 0 ? q.options.length - 1 : 0];
    answers[q.id] = opt?.id ?? q.options[0]!.id;
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
    answers[q.id] = q.options[1]?.id ?? q.options[0]!.id;
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
