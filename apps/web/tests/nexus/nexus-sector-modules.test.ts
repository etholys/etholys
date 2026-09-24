import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultIncubationProgram, workItemBudget } from '../../lib/nexus-incubation-program';
import { computeFullDiagnosticResult, listDiagnosticQuestions } from '../../lib/nexus-sector-diagnostic';
import { buildIncubationWorkPlan } from '../../lib/nexus-incubation-workplan';
import {
  evaluateProtocolAlerts,
  findSeedForQuestion,
  getSectorModule,
  resolveSectorModule,
} from '../../lib/nexus-sector-modules';
import {
  generateSensorToken,
  hashSensorToken,
  ingestCompanyForSensor,
  verifySensorToken,
} from '../../lib/nexus-ops-token';

test('agriculture and horticulture resolve to parcel module', () => {
  assert.equal(getSectorModule('agriculture').moduleId, 'agriculture');
  assert.equal(getSectorModule('horticulture').unitKind, 'parcel');
  assert.equal(getSectorModule('agriculture').unitKind, 'parcel');
});

test('unknown or service sector uses generic shell', () => {
  assert.equal(getSectorModule('professional_services').moduleId, 'generic');
  assert.equal(getSectorModule('chemical_industry').unitKind, 'generic');
  assert.equal(getSectorModule(null).moduleId, 'generic');
  assert.equal(resolveSectorModule(['retail_shop', 'agriculture']).moduleId, 'agriculture');
});

test('next agro verticals have their own unit kinds', () => {
  assert.equal(getSectorModule('livestock').moduleId, 'livestock');
  assert.equal(getSectorModule('livestock').unitKind, 'herd');
  assert.equal(getSectorModule('poultry').unitKind, 'flock');
  assert.equal(getSectorModule('apiculture').unitKind, 'hive');
  assert.equal(getSectorModule('agroindustry').unitKind, 'lot');
  assert.ok(getSectorModule('livestock').entryKinds.includes('health'));
  assert.ok(getSectorModule('poultry').entryKinds.includes('egg'));
  assert.ok(getSectorModule('apiculture').entryKinds.includes('hive_inspect'));
  assert.ok(getSectorModule('agroindustry').entryKinds.includes('hygiene'));
});

test('livestock withdrawal and poultry mortality alerts', () => {
  const now = new Date('2026-09-23T12:00:00Z');
  const liv = evaluateProtocolAlerts(getSectorModule('livestock').protocols, {
    now,
    lastEntryAt: now,
    lastInputAt: new Date('2026-09-21T12:00:00Z'),
    lastInputPhiDays: 7,
    lastReadingByMetric: { temperature: 8 },
  });
  assert.ok(liv.some((a) => a.code === 'withdrawal_active'));
  assert.ok(liv.some((a) => a.code === 'metric_out'));

  const pou = evaluateProtocolAlerts(getSectorModule('poultry').protocols, {
    now,
    lastEntryAt: now,
    lastReadingByMetric: { mortality_pct: 3.5, temperature: 34 },
  });
  assert.ok(pou.some((a) => a.code === 'metric_out'));
});

test('PHI, moisture and stale-book alerts', () => {
  const proto = getSectorModule('agriculture').protocols;
  const now = new Date('2026-09-23T12:00:00Z');

  const phi = evaluateProtocolAlerts(proto, {
    now,
    lastInputAt: new Date('2026-09-20T12:00:00Z'),
    lastInputPhiDays: 7,
    lastEntryAt: now,
    lastMoisture: 40,
  });
  assert.ok(phi.some((a) => a.code === 'phi_active' && a.severity === 'critical'));

  const dry = evaluateProtocolAlerts(proto, {
    now,
    lastEntryAt: now,
    lastMoisture: 18,
  });
  assert.ok(dry.some((a) => a.code === 'moisture_low'));

  const stale = evaluateProtocolAlerts(proto, {
    now,
    lastEntryAt: new Date('2026-08-01T12:00:00Z'),
    lastMoisture: 40,
  });
  assert.ok(stale.some((a) => a.code === 'stale_book'));

  const empty = evaluateProtocolAlerts(proto, { now });
  assert.ok(empty.some((a) => a.code === 'stale_book'));
});

test('sensor token hash verifies and binds to company', () => {
  const { token, hash } = generateSensorToken();
  assert.ok(token.startsWith('nxsens_'));
  assert.equal(hash, hashSensorToken(token));
  assert.equal(verifySensorToken(token, hash), true);
  assert.equal(verifySensorToken('nxsens_nope', hash), false);

  const sensor = { companyId: 'co_farm', tokenHash: hash, isActive: true };
  assert.deepEqual(ingestCompanyForSensor(sensor, token), { ok: true, companyId: 'co_farm' });
  assert.deepEqual(ingestCompanyForSensor(sensor, 'nxsens_other'), { ok: false, reason: 'invalid' });
  assert.deepEqual(ingestCompanyForSensor({ ...sensor, isActive: false }, token), {
    ok: false,
    reason: 'invalid',
  });
  assert.deepEqual(ingestCompanyForSensor(null, token), { ok: false, reason: 'invalid' });
});

test('livestock workplan seeds herd operations', () => {
  const program = defaultIncubationProgram();
  const qs = listDiagnosticQuestions('livestock', program);
  const answers: Record<string, string> = {};
  qs.forEach((q) => {
    answers[q.id] = q.options[0]?.id ?? q.options[0]!.id;
  });
  const diag = computeFullDiagnosticResult('livestock', qs, answers, 'es');
  const plan = buildIncubationWorkPlan(program, diag, 'es');
  const kinds = new Set(plan.items.map((i) => i.kind));
  assert.ok(kinds.has('ops_unit'));
  assert.ok(kinds.has('field_book'));
  assert.ok(plan.items.some((i) => /rebaño|lote/i.test(i.title)));
});

test('agro workplan seeds operational kinds', () => {
  const program = defaultIncubationProgram();
  program.totalHours = 80;
  assert.ok(workItemBudget(program) >= 8);
  const qs = listDiagnosticQuestions('agriculture', program);
  const answers: Record<string, string> = {};
  qs.forEach((q) => {
    answers[q.id] = q.options[0]?.id ?? q.options[0]!.id;
  });
  const diag = computeFullDiagnosticResult('agriculture', qs, answers, 'pt');
  const plan = buildIncubationWorkPlan(program, diag, 'pt');
  const kinds = new Set(plan.items.map((i) => i.kind));
  assert.ok(kinds.has('ops_unit'));
  assert.ok(kinds.has('field_book'));
  assert.ok(kinds.has('sensor'));
  assert.ok(kinds.has('protocol'));
});

test('weak sector questions map to module seeds, not generic TA', () => {
  const program = defaultIncubationProgram();
  const cases: Array<{ sector: string; questionId: string; seedId: string; href: 'campo' | 'monitor' }> = [
    { sector: 'agriculture', questionId: 'sec_agr_inputs', seedId: 'agro_phi_protocol', href: 'campo' },
    { sector: 'livestock', questionId: 'sec_liv_health', seedId: 'liv_withdrawal', href: 'campo' },
    { sector: 'poultry', questionId: 'sec_pou_bio', seedId: 'pou_bio', href: 'campo' },
    { sector: 'apiculture', questionId: 'sec_api_health', seedId: 'api_varroa', href: 'campo' },
    { sector: 'agroindustry', questionId: 'sec_agi_process', seedId: 'ind_lot', href: 'campo' },
  ];
  for (const c of cases) {
    const seed = findSeedForQuestion(getSectorModule(c.sector), c.questionId);
    assert.equal(seed?.id, c.seedId, `${c.sector} ${c.questionId}`);
    const qs = listDiagnosticQuestions(c.sector, program);
    const answers: Record<string, string> = {};
    qs.forEach((q) => {
      answers[q.id] = q.options[0]?.id ?? q.options[0]!.id;
    });
    const diag = computeFullDiagnosticResult(c.sector, qs, answers, 'es');
    const plan = buildIncubationWorkPlan(program, diag, 'es');
    const sectorItems = plan.items.filter((i) => i.questionId?.startsWith('sec_') || i.href);
    assert.ok(sectorItems.some((i) => i.href === c.href));
    assert.ok(
      !plan.items.some(
        (i) => i.questionId === c.questionId && /Intervención AT|Intervenção AT/i.test(i.title)
      ),
      `${c.sector} still used generic TA for ${c.questionId}`
    );
  }
});
