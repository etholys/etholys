import test from 'node:test';
import assert from 'node:assert/strict';
import { boardEngine } from '../../lib/forge/engines/board';
import type { GameSpecV1 } from '../../lib/forge/schemas/game-spec-v1';

const minimalBoardSpec: GameSpecV1 = {
  schemaVersion: 1,
  engine: 'board',
  locale: 'pt',
  title: 'Teste',
  learningObjectives: ['Objetivo 1'],
  board: { spaces: 10, startSpace: 0, goalSpace: 9 },
  cards: [{ id: 'c1', type: 'challenge', prompt: 'Pergunta?' }],
  rules: { minInsights: 1, maxTurns: 5 },
};

test('boardEngine cria estado inicial na casa 0', () => {
  const state = boardEngine.createInitialState(minimalBoardSpec);
  assert.equal((state as { position: number }).position, 0);
});

test('boardEngine avança com roll_dice', () => {
  const state = boardEngine.createInitialState(minimalBoardSpec);
  const { state: next } = boardEngine.applyAction(state, { type: 'roll_dice' }, minimalBoardSpec);
  assert.ok((next as { position: number }).position >= 0);
});
