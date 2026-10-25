import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseDroneOrganizeProposal } from '@/lib/radar/drone/parse-proposal';
import { mergeDroneIntoLayout } from '@/lib/radar/drone/merge';

test('parseDroneOrganizeProposal sanitizes spaces and injects honesty', () => {
  const p = parseDroneOrganizeProposal(
    JSON.stringify({
      summary: 'Two parcels',
      confidence: 'medium',
      siteSideM: 80,
      spaces: [
        { tempId: 'a', name: 'Norte', crop: 'milho', x: 5, y: 5, w: 40, h: 30, widthM: 32, lengthM: 24 },
        { tempId: 'b', name: 'Sul', crop: 'soja', x: 50, y: 40, w: 35, h: 40 },
      ],
      crops: [{ name: 'milho' }],
      limitations: [],
    }),
    { locale: 'pt', visionUsed: true, knownUnitIds: [] },
  );
  assert.equal(p.spaces.length, 2);
  assert.equal(p.crops.some((c) => c.name === 'soja'), true);
  assert.ok(p.limitations.some((l) => /fotogrametr|esboço|centim/i.test(l)));
  assert.equal(p.visionUsed, true);
});

test('mergeDroneIntoLayout preserves devices and commands', () => {
  const existing = {
    version: 1,
    spaces: [{ id: 'old', x: 10, y: 10, w: 20, h: 20, placed: true }],
    sensors: [{ id: 'sen1', spaceId: 'old', x: 50, y: 50 }],
    crops: [],
    devices: [{ sensorId: 'sen1', sku: 'SE01-LB', devEui: null, unitId: 'old' }],
    commands: [
      {
        id: 'cmd1',
        sensorId: 'sen1',
        devEui: null,
        unitId: 'old',
        action: 'open',
        status: 'pending',
        at: '2026-01-01T00:00:00.000Z',
      },
    ],
    structures: [],
    irrigation: [],
    siteSideM: 60,
  };

  const proposal = parseDroneOrganizeProposal(
    JSON.stringify({
      summary: 'ok',
      confidence: 'low',
      spaces: [{ tempId: 'n1', name: 'Nova', crop: 'trigo', x: 20, y: 20, w: 25, h: 25, widthM: 15, lengthM: 15 }],
      crops: [{ name: 'trigo' }],
      limitations: ['sketch'],
    }),
    { locale: 'en', visionUsed: false },
  );

  const map = new Map([['n1', 'unit_new']]);
  const merged = mergeDroneIntoLayout(existing, proposal, map, 60);
  assert.equal(merged.devices?.length, 1);
  assert.equal(merged.commands?.length, 1);
  assert.equal(merged.sensors.length, 1);
  assert.ok(merged.spaces.some((s) => s.id === 'old'));
  assert.ok(merged.spaces.some((s) => s.id === 'unit_new' && s.placed === true));
  assert.ok(merged.crops?.some((c) => c.name === 'trigo'));
});
