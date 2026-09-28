import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAgricultureBoard, isRadarParcel } from '../../lib/radar/agriculture';

const now = new Date('2026-09-27T12:00:00.000Z');

test('a parcel with low moisture raises one moisture alert', () => {
  const board = buildAgricultureBoard({
    now,
    units: [{ id: 'p1', name: 'Norte', areaHa: 2, crop: 'milho', kind: 'parcel' }],
    entries: [],
    readings: [
      { unitId: 'p1', metric: 'soil_moisture', value: 18, recordedAt: new Date('2026-09-27T08:00:00.000Z') },
    ],
  });
  assert.equal(board.parcels.length, 1);
  assert.equal(board.parcels[0].moisture, 18);
  assert.ok(board.parcels[0].alerts.some((a) => a.code === 'moisture_low'));
  assert.equal(board.parcels[0].alerts.filter((a) => a.code === 'moisture_low').length, 1);
});

test('PHI stays open inside the waiting window', () => {
  const board = buildAgricultureBoard({
    now,
    units: [{ id: 'p1', name: 'Norte', areaHa: null, crop: null, kind: 'parcel' }],
    entries: [
      {
        unitId: 'p1',
        kind: 'input',
        occurredAt: new Date('2026-09-25T12:00:00.000Z'),
        payloadJson: { product: 'cobre', phiDays: 7 },
      },
    ],
    readings: [],
  });
  assert.ok(board.parcels[0].alerts.some((a) => a.code === 'phi_active' && a.severity === 'critical'));
});

test('herds are not agriculture parcels and an empty farm asks for the first parcel', () => {
  assert.equal(isRadarParcel({ kind: 'herd' }), false);
  const board = buildAgricultureBoard({
    now,
    units: [{ id: 'h1', name: 'Lote A', areaHa: null, crop: null, kind: 'herd' }],
    entries: [],
    readings: [],
  });
  assert.equal(board.parcels.length, 0);
  assert.equal(board.alerts[0]?.code, 'no_parcels');
});

test('latest irrigation millimetres win over an older reading', () => {
  const board = buildAgricultureBoard({
    now,
    units: [{ id: 'p1', name: 'Norte', areaHa: 1, crop: 'feijão', kind: 'parcel' }],
    entries: [
      {
        unitId: 'p1',
        kind: 'irrigation',
        occurredAt: new Date('2026-09-27T09:00:00.000Z'),
        payloadJson: { mm: 12 },
      },
    ],
    readings: [
      { unitId: 'p1', metric: 'irrigation_mm', value: 4, recordedAt: new Date('2026-09-20T09:00:00.000Z') },
      { unitId: 'p1', metric: 'irrigation_mm', value: 12, recordedAt: new Date('2026-09-27T09:00:00.000Z') },
    ],
  });
  assert.equal(board.parcels[0].irrigationMm, 12);
  assert.equal(board.parcels[0].alerts.some((a) => a.code === 'stale_book'), false);
});
