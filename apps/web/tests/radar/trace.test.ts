import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canAdvanceStage,
  generateLotCode,
  generatePublicToken,
  nextStage,
  publicLotSnapshot,
  sharePath,
} from '../../lib/radar/trace';

test('stages advance one step at a time', () => {
  assert.equal(nextStage('harvest'), 'transform');
  assert.equal(nextStage('transform'), 'transport');
  assert.equal(nextStage('transport'), 'sale');
  assert.equal(nextStage('sale'), null);
  assert.equal(canAdvanceStage('harvest', 'harvest'), true);
  assert.equal(canAdvanceStage('harvest', 'transform'), true);
  assert.equal(canAdvanceStage('harvest', 'transport'), false);
  assert.equal(canAdvanceStage('transform', 'harvest'), false);
});

test('public snapshot hides internal ids and keeps the chain', () => {
  const snap = publicLotSnapshot({
    code: 'L260928-ABCD',
    crop: 'milho',
    qty: 1200,
    unitLabel: 'kg',
    currentStage: 'transport',
    status: 'open',
    createdAt: '2026-09-28T12:00:00.000Z',
    events: [
      {
        stage: 'harvest',
        occurredAt: '2026-09-28T12:00:00.000Z',
        payloadJson: { note: 'Parcela norte', secret: 'nope' },
        channel: 'app',
      },
      {
        stage: 'transform',
        occurredAt: '2026-09-28T15:00:00.000Z',
        payloadJson: { note: 'Secagem' },
        channel: 'app',
      },
      {
        stage: 'transport',
        occurredAt: '2026-09-28T18:00:00.000Z',
        payloadJson: { carrier: 'Camión 12', destination: 'Mercado' },
        channel: 'whatsapp',
      },
    ],
  });
  assert.equal(snap.code, 'L260928-ABCD');
  assert.equal(snap.currentStage, 'transport');
  assert.equal(snap.stages.filter((s) => s.done).length, 3);
  assert.equal(snap.timeline.length, 3);
  assert.equal(snap.timeline[2].carrier, 'Camión 12');
  assert.ok(!JSON.stringify(snap).includes('secret'));
  assert.ok(!JSON.stringify(snap).includes('companyId'));
});

test('lot code and public token are opaque enough', () => {
  const code = generateLotCode(new Date('2026-09-28T12:00:00.000Z'));
  assert.match(code, /^L260928-[A-F0-9]{4}$/);
  const token = generatePublicToken();
  assert.ok(token.length >= 20);
  assert.equal(sharePath(token), `/radar/lote/${encodeURIComponent(token)}`);
});
