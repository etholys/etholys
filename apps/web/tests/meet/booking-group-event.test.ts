import test from 'node:test';
import assert from 'node:assert/strict';
import {
  groupEventPublicPath,
  isValidGroupEventYmd,
  normalizeGroupCapacity,
  normalizeGroupEventHours,
} from '../../lib/meet/booking-group-event';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');

test('group event ymd, hours and capacity helpers', () => {
  assert.equal(isValidGroupEventYmd('2026-10-26'), true);
  assert.equal(isValidGroupEventYmd('2026-02-30'), false);
  assert.deepEqual(normalizeGroupEventHours(14 * 60, 16 * 60), { startMin: 840, endMin: 960 });
  assert.equal(normalizeGroupEventHours(10 * 60, 10 * 60 + 10), null);
  assert.equal(normalizeGroupCapacity(null), null);
  assert.equal(normalizeGroupCapacity(25), 25);
  assert.equal(normalizeGroupCapacity(0), null);
  assert.equal(normalizeGroupCapacity(20_000), null);
  assert.equal(groupEventPublicPath('xyz'), '/a/e/xyz');
});

test('group event guest UI is a registration form, not a slot picker', () => {
  const guest = readFileSync(join(root, 'components/meet/ChorusPublicGroupEvent.tsx'), 'utf8');
  const page = readFileSync(join(root, 'app/a/e/[code]/page.tsx'), 'utf8');
  const route = readFileSync(join(root, 'app/api/meet/public/agenda/e/[code]/route.ts'), 'utf8');
  assert.match(page, /ChorusPublicGroupEvent/);
  assert.match(route, /createGroupEventRegistration/);
  assert.match(guest, /name/);
  assert.match(guest, /email/);
  assert.match(guest, /phone/);
  assert.match(guest, /note/);
  assert.doesNotMatch(guest, /slots\.map|Pick a start time|Escolha o horário/);
  assert.doesNotMatch(guest, /rodada|ronda de negocios|business round/i);
});

test('organizer create flow offers slots vs group without rodada branding', () => {
  const owner = readFileSync(join(root, 'components/meet/ChorusAgendaOrganizer.tsx'), 'utf8');
  assert.match(owner, /activityKind === 'slots'/);
  assert.match(owner, /activityKind === 'group'/);
  assert.match(owner, /\/api\/meet\/agenda\/group-events/);
  assert.match(owner, /Inscritos|Registrants/);
  assert.doesNotMatch(owner, /Rodada de negócio|Ronda de negocios|Business round/i);
  assert.doesNotMatch(owner, /Dia de atendimento|Día de atención|Office hours day/);
});
