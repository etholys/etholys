import test from 'node:test';
import assert from 'node:assert/strict';
import { publicAgendaViewer } from '../../lib/meet/agenda-viewer';
import { collectHolidayDays } from '../../lib/meet/holidays';
import { buildOpenSlots } from '../../lib/meet/booking-slots';
import { isValidTimeZone, meetWallTimeToUtc } from '../../lib/meet/timezone';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');

test('owner of the public agenda is not treated as a guest', () => {
  const page = { ownerId: 'user-1', companyId: 'co-1' };
  assert.equal(publicAgendaViewer(page, { userId: 'user-1', companyIds: ['co-1'] }), 'owner');
  assert.equal(publicAgendaViewer(page, { userId: 'user-2', companyIds: ['co-1'] }), 'guest');
  assert.equal(publicAgendaViewer(page, null), 'guest');
  assert.equal(publicAgendaViewer(page, { userId: 'user-1', companyIds: ['other'] }), 'guest');
});

test('Brazil, Nicaragua and Spain public holidays are stored as calendar dates', () => {
  const days = collectHolidayDays(['BR', 'NI', 'ES'], 2026, 2026, 'pt');
  assert.ok(days.some((day) => day.ymd === '2026-01-01'));
  assert.ok(days.some((day) => day.ymd === '2026-01-06'));
  const labels = days.find((day) => day.ymd === '2026-01-01')?.label || '';
  assert.match(labels, /Ano Novo|Año Nuevo|New Year/i);
});

test('a stored holiday range removes public slots that day', () => {
  const slots = buildOpenSlots({
    timeZone: 'Europe/Madrid',
    slotMinutes: 60,
    windows: [{ weekday: 4, startMin: 9 * 60, endMin: 12 * 60 }],
    days: 1,
    now: new Date('2025-12-31T12:00:00.000Z'),
    fromYmd: '2026-01-01',
    busy: [
      {
        startsAt: meetWallTimeToUtc('2026-01-01T00:00', 'Europe/Madrid'),
        endsAt: meetWallTimeToUtc('2026-01-02T00:00', 'Europe/Madrid'),
      },
    ],
  });
  assert.equal(slots.length, 0);
});

test('timezone can move off Sao Paulo', () => {
  assert.equal(isValidTimeZone('America/Managua'), true);
  assert.equal(isValidTimeZone('Europe/Lisbon'), true);
  assert.equal(isValidTimeZone('Not/AZone'), false);
  const managua = meetWallTimeToUtc('2026-10-17T09:00', 'America/Managua');
  const saoPaulo = meetWallTimeToUtc('2026-10-17T09:00', 'America/Sao_Paulo');
  assert.notEqual(managua.toISOString(), saoPaulo.toISOString());
});

test('agenda surfaces force light form colors', () => {
  const css = readFileSync(join(root, 'app/globals.css'), 'utf8');
  assert.match(css, /\.etholys-meet-light input[\s\S]*background-color:\s*#ffffff !important/);
  assert.match(css, /\.etholys-meet-light input:disabled[\s\S]*color:\s*#1e293b !important/);
  const owner = readFileSync(join(root, 'components/meet/ChorusAgendaOrganizer.tsx'), 'utf8');
  const guest = readFileSync(join(root, 'components/meet/ChorusPublicAgenda.tsx'), 'utf8');
  const openDayGuest = readFileSync(join(root, 'components/meet/ChorusPublicOpenDay.tsx'), 'utf8');
  assert.match(owner, /etholys-meet/);
  assert.match(owner, /PanelLeftClose/);
  assert.match(owner, /ChorusAgendaCalendar/);
  assert.match(owner, /\/hub\/calendar\?view=agenda/);
  assert.match(owner, /etholys-system etholys-meet relative/);
  assert.match(owner, /role="dialog"/);
  assert.match(owner, /etholys-meet-light/);
  assert.match(owner, /Dia de atendimento/);
  assert.match(owner, /\/api\/meet\/agenda\/open-days/);
  assert.match(guest, /viewer === 'owner'/);
  assert.match(guest, /etholys-meet-light/);
  assert.match(openDayGuest, /\/api\/meet\/public\/agenda\/d\//);
  assert.match(openDayGuest, /etholys-meet-light/);
  assert.doesNotMatch(`${owner}\n${guest}\n${openDayGuest}`, /jitsi|jibri|jigasi/i);
});

test('clicking an agenda hour opens the shared block dialog', () => {
  const calendar = readFileSync(join(root, 'components/meet/ChorusAgendaCalendar.tsx'), 'utf8');
  const owner = readFileSync(join(root, 'components/meet/ChorusAgendaOrganizer.tsx'), 'utf8');
  const route = readFileSync(join(root, 'app/api/meet/agenda/route.ts'), 'utf8');
  assert.match(calendar, /data-slot/);
  assert.match(calendar, /commitRef\.current\(startWall, endWall\)/);
  assert.match(calendar, /onPointerDown=\{onGridPointerDown\}/);
  assert.match(owner, /setBlockDialogOpen\(true\)/);
  assert.match(owner, /Motivo \(opcional\)/);
  assert.match(owner, /type="datetime-local"/);
  assert.match(owner, /Cancelar/);
  assert.match(route, /label: body\.label/);
  assert.doesNotMatch(`${calendar}\n${owner}`, /jitsi|jibri|jigasi/i);
});
