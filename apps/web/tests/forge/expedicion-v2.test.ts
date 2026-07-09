import test from 'node:test';
import assert from 'node:assert/strict';
import { applyV2Action } from '../../lib/forge/expedicion-v2/apply-v2-action';
import { createInitialV2State } from '../../lib/forge/expedicion-v2/player-state';
import { ledgerDraftsFromBoardEvents } from '../../lib/forge/expedicion-v2/board-ledger-sync';
import { computeSustainabilityScore } from '../../lib/forge/expedicion-v2/score';
import {
  applyActionEventCard,
  applyCrisisEventCard,
} from '../../lib/forge/expedicion-v2/event-card-effects';
import { getActionCards, getCrisisCards } from '../../lib/forge/expedicion-v2/content';
import { usesV2Ledger, adjustEcoCredits, isExpedicionV2Spec } from '../../lib/forge/expedicion-v2/board-v2-mode';
import { impactPointsFromBoardEvents } from '../../lib/forge/expedicion-v2/board-ledger-sync';

test('createInitialV2State — starts in lobby', () => {
  assert.equal(createInitialV2State().phase, 'lobby');
});

test('applyV2Action — open_pre_quiz from lobby', () => {
  const v2 = applyV2Action(createInitialV2State(), { action: 'open_pre_quiz' });
  assert.equal(v2.phase, 'pre_quiz');
});

test('applyV2Action — pre quiz → playing', () => {
  let v2 = applyV2Action(createInitialV2State(), { action: 'open_pre_quiz' });
  v2 = applyV2Action(v2, {
    action: 'complete_pre_quiz',
    answers: { q1: 'test' },
  });
  assert.equal(v2.phase, 'playing');
  assert.ok(v2.preQuizCompletedAt);
});

test('applyV2Action — consultancy deducts Eco', () => {
  let v2 = applyV2Action(createInitialV2State(), { action: 'complete_pre_quiz', answers: {} });
  v2 = applyV2Action(v2, { action: 'consultancy', optionId: 'ia_capsula' });
  assert.equal(v2.ledger.balance, 450);
});

test('applyV2Action — end_cycle opens post_quiz after 3 cycles', () => {
  let v2 = applyV2Action(createInitialV2State(), { action: 'complete_pre_quiz', answers: {} });
  v2 = applyV2Action(v2, { action: 'end_cycle' });
  assert.equal(v2.cyclesCompleted, 1);
  assert.equal(v2.phase, 'playing');
  v2 = applyV2Action(v2, { action: 'end_cycle' });
  v2 = applyV2Action(v2, { action: 'end_cycle' });
  assert.equal(v2.cyclesCompleted, 3);
  assert.equal(v2.phase, 'post_quiz');
});

test('ledgerDraftsFromBoardEvents — validated +100', () => {
  const drafts = ledgerDraftsFromBoardEvents([{ type: 'validated', message: 'ok' }]);
  assert.equal(drafts.length, 1);
  assert.equal(drafts[0]?.amount, 100);
  assert.equal(drafts[0]?.entryType, 'E');
});

test('computeSustainabilityScore — PPT formula', () => {
  let v2 = createInitialV2State();
  v2 = applyV2Action(v2, {
    action: 'add_postit',
    station: 'raices',
    type: 'diagnostico',
    text: 'Hola',
  });
  const score = computeSustainabilityScore(v2.ledger, v2.constructionMap, 3);
  assert.equal(score.ecoComponent, 300);
  assert.equal(score.impactComponent, 12);
  assert.equal(score.total, 312);
  assert.equal(score.postItCount, 1);
});

test('add_impact and approve micro-caso increment impact', () => {
  let v2 = applyV2Action(createInitialV2State(), { action: 'complete_pre_quiz', answers: {} });
  v2 = applyV2Action(v2, { action: 'add_impact', points: 2 });
  assert.equal(v2.impactPoints, 2);
  v2 = applyV2Action(v2, {
    action: 'submit_micro_caso',
    microCasoId: 'mc-01',
    station: 'tierra',
    answer: 'R',
  });
  v2 = applyV2Action(v2, { action: 'approve_micro_caso' });
  assert.equal(v2.impactPoints, 3);
});

test('impactPointsFromBoardEvents — validated +1', () => {
  assert.equal(impactPointsFromBoardEvents([{ type: 'validated' }, { type: 'bonus' }]), 1);
});

test('isExpedicionV2Spec detects 20-space board', () => {
  assert.equal(
    isExpedicionV2Spec({
      schemaVersion: 1,
      engine: 'board',
      locale: 'es',
      title: 'La Expedición Sostenible',
      learningObjectives: ['x'],
      board: { spaces: 20 },
    }),
    true
  );
});

test('applyActionEventCard — action-5 adds 100 Eco', () => {
  let v2 = createInitialV2State();
  v2 = applyV2Action(v2, { action: 'complete_pre_quiz', answers: {} });
  const card = getActionCards().find((c) => c.id === 'action-5')!;
  const { v2: next } = applyActionEventCard(v2, card);
  assert.equal(next.ledger.balance, 600);
});

test('applyCrisisEventCard — pay fine', () => {
  let v2 = createInitialV2State();
  v2 = applyV2Action(v2, { action: 'complete_pre_quiz', answers: {} });
  const card = getCrisisCards().find((c) => c.id === 'crisis-1')!;
  const { v2: next } = applyCrisisEventCard(v2, card, 'pay_fine');
  assert.equal(next.ledger.balance, 300);
});

test('submit and approve micro-caso', () => {
  let v2 = applyV2Action(createInitialV2State(), { action: 'complete_pre_quiz', answers: {} });
  v2 = applyV2Action(v2, {
    action: 'submit_micro_caso',
    microCasoId: 'mc-01',
    station: 'tierra',
    answer: 'Mi respuesta',
  });
  assert.ok(v2.pendingMicroCaso);
  v2 = applyV2Action(v2, { action: 'approve_micro_caso' });
  assert.equal(v2.pendingMicroCaso, null);
  assert.equal(v2.ledger.balance, 700);
});

test('consultancy companero adds team peer credit', () => {
  let v2 = applyV2Action(createInitialV2State(), { action: 'complete_pre_quiz', answers: {} });
  v2 = applyV2Action(v2, {
    action: 'consultancy',
    optionId: 'companero',
    peerUserId: 'user-b',
  });
  assert.equal(v2.ledger.balance, 400);
  assert.equal(v2.peerCredits?.['user-b'], 100);
});

test('feria pitch submit and award +300 Eco', () => {
  let v2 = applyV2Action(createInitialV2State(), { action: 'complete_pre_quiz', answers: {} });
  for (const station of ['raices', 'tierra', 'alquimia'] as const) {
    v2 = applyV2Action(v2, {
      action: 'add_postit',
      station,
      type: 'diagnostico',
      text: 'Contenido',
    });
  }
  v2 = applyV2Action(v2, {
    action: 'submit_feria_pitch',
    pitch: 'Nuestro pitch de impacto',
  });
  assert.ok(v2.pendingFeriaPitch);
  v2 = applyV2Action(v2, { action: 'award_feria_pitch' });
  assert.equal(v2.feriaAwarded, true);
  assert.equal(v2.ledger.balance, 800);
});

test('board v2 mode skips ecoCredits mutation', () => {
  assert.equal(usesV2Ledger({ v2Team: {} }), true);
  assert.equal(usesV2Ledger({ v2FinancialMode: true }), true);
  assert.equal(usesV2Ledger({}), false);
  assert.equal(adjustEcoCredits(500, -100, true), 500);
  assert.equal(adjustEcoCredits(500, -100, false), 400);
});
