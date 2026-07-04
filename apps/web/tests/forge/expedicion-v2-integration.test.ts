import test from 'node:test';
import assert from 'node:assert/strict';
import { applyV2Action } from '../../lib/forge/expedicion-v2/apply-v2-action';
import { createInitialV2State } from '../../lib/forge/expedicion-v2/player-state';
import {
  impactPointsFromBoardEvents,
  ledgerDraftsFromBoardEvents,
} from '../../lib/forge/expedicion-v2/board-ledger-sync';
import { boardEngine } from '../../lib/forge/engines/board';
import {
  createMultiplayerInitialState,
  rosterFromEnrollments,
  parseMulti,
} from '../../lib/forge/expedicion-board-multi';
import { withExpedicionV2RoomFlags } from '../../lib/forge/expedicion-v2/board-v2-mode';
import { mergeV2IntoRoomState, v2FromRoomState } from '../../lib/forge/expedicion-v2/room-v2-store';
import { computeSustainabilityScore } from '../../lib/forge/expedicion-v2/score';
import { buildCapsulasTecnicas } from '../../lib/forge/expedicion-v2/capsulas-content';
import type { GameSpecV1 } from '../../lib/forge/schemas/game-spec-v1';

const expedicionSpec: GameSpecV1 = {
  schemaVersion: 1,
  engine: 'board',
  locale: 'es',
  title: 'La Expedición Sostenible',
  learningObjectives: ['Triple impacto'],
  board: { spaces: 20, startSpace: 0, goalSpace: 19 },
  cards: [{ id: 'c1', type: 'challenge', prompt: 'Describe tu propósito en 15 palabras.' }],
  rules: { minInsights: 1, maxTurns: 30 },
};

/** Simula sprint completo V2 (individual / mesa). */
test('integration — sprint V2 pre → playing → post → finished', () => {
  let v2 = applyV2Action(createInitialV2State(), {
    action: 'complete_pre_quiz',
    answers: { q1: 'a' },
  });
  assert.equal(v2.phase, 'playing');

  v2 = applyV2Action(v2, {
    action: 'submit_micro_caso',
    microCasoId: 'mc-01',
    station: 'raices',
    answer: 'Propósito claro LOHAS',
  });
  v2 = applyV2Action(v2, { action: 'approve_micro_caso' });
  assert.equal(v2.impactPoints, 1);
  assert.equal(v2.ledger.balance, 700);

  for (const station of ['tierra', 'alquimia', 'mercado'] as const) {
    v2 = applyV2Action(v2, {
      action: 'add_postit',
      station,
      type: 'diagnostico',
      text: 'Contenido',
    });
  }
  v2 = applyV2Action(v2, {
    action: 'submit_feria_pitch',
    pitch: 'Pitch de triple impacto',
  });
  v2 = applyV2Action(v2, { action: 'award_feria_pitch' });
  assert.equal(v2.feriaAwarded, true);

  v2 = applyV2Action(v2, { action: 'end_cycle' });
  v2 = applyV2Action(v2, { action: 'end_cycle' });
  v2 = applyV2Action(v2, { action: 'end_cycle' });
  assert.equal(v2.phase, 'post_quiz');

  v2 = applyV2Action(v2, {
    action: 'complete_post_quiz',
    answers: { post1: 'Aprendí ecoeficiencia' },
  });
  assert.equal(v2.phase, 'finished');
  assert.ok(v2.finalScore != null && v2.finalScore > 0);
  assert.ok(v2.finalScoreBreakdown?.impactComponent);
});

/** Tabuleiro V2: Eco no estado do peão não muda; eventos alimentam ledger. */
test('integration — board validate_card + ledger drafts (modo V2)', () => {
  const roster = rosterFromEnrollments([
    { userId: 'u1', name: 'Ana', email: 'a@test.com' },
    { userId: 'u2', name: 'Luis', email: 'l@test.com' },
  ]);
  let raw = withExpedicionV2RoomFlags(
    createMultiplayerInitialState(roster, expedicionSpec) as unknown as Record<string, unknown>
  );
  let multi = parseMulti(raw)!;

  const { state, events } = boardEngine.applyAction(
    raw,
    { type: 'complete_card', payload: { text: 'Mi propósito sostenible LOHAS' } },
    expedicionSpec
  );
  assert.ok(events.some((e) => e.type === 'validated'));

  multi = parseMulti(state as Record<string, unknown>)!;
  assert.equal(multi.players[0]?.ecoCredits, 500);

  const drafts = ledgerDraftsFromBoardEvents(events);
  const impact = impactPointsFromBoardEvents(events);
  assert.equal(drafts[0]?.amount, 100);
  assert.equal(impact, 1);

  let v2 = v2FromRoomState(raw);
  for (const d of drafts) {
    v2 = applyV2Action(v2, {
      action: 'ledger_entry',
      description: d.description,
      entryType: d.entryType,
      amount: d.amount,
      meta: d.meta,
    });
  }
  v2 = applyV2Action(v2, { action: 'add_impact', points: impact });
  assert.equal(v2.ledger.balance, 600);
  assert.equal(v2.impactPoints, 1);
});

/** Sala equipa: v2Team persiste no state da room. */
test('integration — team room merge v2Team', () => {
  const roomState = mergeV2IntoRoomState(
    withExpedicionV2RoomFlags({ multiplayer: true }),
    applyV2Action(createInitialV2State(), { action: 'complete_pre_quiz', answers: {} })
  );
  const v2 = v2FromRoomState(roomState);
  assert.equal(v2.phase, 'playing');
  assert.equal(roomState.v2FinancialMode, true);
});

test('capsulas — texto integral libro + PPT', () => {
  const caps = buildCapsulasTecnicas();
  assert.equal(caps.length, 5);
  const raices = caps.find((c) => c.station === 'raices')!;
  assert.ok(raices.libro?.includes('LOHAS'));
  assert.ok(raices.body.includes('Libro didáctico'));
  assert.ok(raices.guion?.length);
  assert.ok(raices.accion?.length);
});

test('integration — presencial team: ledger sync chain', () => {
  let v2 = createInitialV2State();
  v2 = applyV2Action(v2, { action: 'complete_pre_quiz', answers: {} });

  const boardEvents = [
    { type: 'validated', message: 'Equipo: +100 Eco' },
    { type: 'skip', message: 'Consultoría evitada' },
  ];
  const drafts = ledgerDraftsFromBoardEvents(boardEvents);
  assert.equal(drafts.length, 2);
  for (const d of drafts) {
    v2 = applyV2Action(v2, {
      action: 'ledger_entry',
      description: d.description,
      entryType: d.entryType,
      amount: d.amount,
    });
  }
  v2 = applyV2Action(v2, { action: 'add_impact', points: impactPointsFromBoardEvents(boardEvents) });
  assert.equal(v2.ledger.balance, 550);
  assert.equal(v2.impactPoints, 1);

  const score = computeSustainabilityScore(v2.ledger, v2.constructionMap, v2.impactPoints ?? 0);
  assert.equal(score.ecoComponent, 330);
  assert.equal(score.impactComponent, 4);
});
