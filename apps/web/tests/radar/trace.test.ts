import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canAdvanceStage,
  clampTraceCoord,
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

test('check-in coords clamp rejects junk', () => {
  assert.equal(clampTraceCoord(Number.NaN, 0), null);
  assert.equal(clampTraceCoord(100, 0), null);
  assert.deepEqual(clampTraceCoord(-15.7801, -47.9292), { lat: -15.7801, lng: -47.9292 });
});

test('public snapshot keeps check-in geo and photo, hides secrets', () => {
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
        payloadJson: {
          note: 'Parcela norte',
          secret: 'nope',
          lat: -15.78,
          lng: -47.93,
          photoUrl: 'https://cdn.example/p1.jpg',
          checkedInAt: '2026-09-28T12:00:00.000Z',
          checkIn: true,
        },
        channel: 'app',
      },
      {
        stage: 'transform',
        occurredAt: '2026-09-28T15:00:00.000Z',
        payloadJson: { note: 'Secagem', lat: -15.79, lng: -47.94 },
        channel: 'app',
      },
      {
        stage: 'transport',
        occurredAt: '2026-09-28T18:00:00.000Z',
        payloadJson: { carrier: 'Camión 12', destination: 'Mercado', lat: -15.8, lng: -47.9 },
        channel: 'whatsapp',
      },
    ],
  });
  assert.equal(snap.code, 'L260928-ABCD');
  assert.equal(snap.currentStage, 'transport');
  assert.equal(snap.stages.filter((s) => s.done).length, 3);
  assert.equal(snap.timeline.length, 3);
  assert.equal(snap.timeline[0].hasGeo, true);
  assert.equal(snap.timeline[0].hasPhoto, true);
  assert.equal(snap.timeline[0].photoUrl, 'https://cdn.example/p1.jpg');
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
