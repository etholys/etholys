import assert from 'node:assert/strict';
import test from 'node:test';
import { SOURCE_COLORS } from '../lib/calendar/types';
import { calendarEventVisible } from '../lib/calendar/visibility';
import { parseCalendarWrite } from '../lib/calendar/payload';
import {
  ECALENDAR_TOKENS,
  chipForeground,
  contrastRatio,
  eventMatchesQuery,
  rangeFor,
} from '../lib/calendar/view';
import type { CalendarFeedEvent } from '../lib/calendar/types';

function ev(partial: Partial<CalendarFeedEvent>): CalendarFeedEvent {
  return {
    id: 'task:1',
    title: 'Tarefa',
    startsAt: '2026-10-17T00:00:00.000Z',
    endsAt: null,
    allDay: true,
    calendarId: 'etask',
    source: 'etask',
    color: '#0d9488',
    href: '/hub/work',
    projectId: 'p1',
    editable: false,
    ...partial,
  };
}

test('tarefa de projeto exige eTask e o projeto', () => {
  const event = ev({});
  assert.equal(calendarEventVisible(event, new Set(['etask', 'project:p1'])), true);
  assert.equal(calendarEventVisible(event, new Set(['etask'])), false);
  assert.equal(calendarEventVisible(event, new Set(['project:p1'])), false);
});

test('evento pessoal só depende do calendário próprio', () => {
  const event = ev({ calendarId: 'personal', source: 'personal', projectId: null });
  assert.equal(calendarEventVisible(event, new Set(['personal'])), true);
});

test('pesquisa filtra título e notas', () => {
  const event = ev({ title: 'Reunião Chorus', description: 'pauta do conselho' });
  assert.equal(eventMatchesQuery(event, 'chorus'), true);
  assert.equal(eventMatchesQuery(event, 'conselho'), true);
  assert.equal(eventMatchesQuery(event, 'fundhub'), false);
  assert.equal(eventMatchesQuery(event, '  '), true);
});

test('mês cobre 42 dias e a semana 7', () => {
  const month = rangeFor('month', new Date(2026, 9, 17));
  const week = rangeFor('week', new Date(2026, 9, 17));
  assert.equal((month.to.getTime() - month.from.getTime()) / 86400000, 42);
  assert.equal((week.to.getTime() - week.from.getTime()) / 86400000, 7);
  assert.equal(week.from.getDay(), 1);
});

test('tokens de contraste do eCalendar passam AA', () => {
  for (const mode of ['light', 'dark'] as const) {
    const token = ECALENDAR_TOKENS[mode];
    assert.ok(contrastRatio(token.ink, token.bg) >= 4.5, `${mode} ink`);
    assert.ok(contrastRatio(token.muted, token.bg) >= 4.5, `${mode} muted`);
    assert.ok(contrastRatio(token.faint, token.bg) >= 4.5, `${mode} faint`);
    assert.ok(contrastRatio(token.onPrimary, token.primary) >= 4.5, `${mode} primary`);
  }
});

test('chips das origens têm texto legível', () => {
  for (const color of Object.values(SOURCE_COLORS)) {
    const fg = chipForeground(color);
    assert.ok(contrastRatio(fg, color) >= 4.5, color);
  }
  assert.equal(chipForeground('#ffffff'), '#0f172a');
  assert.equal(chipForeground('#0b1520'), '#ffffff');
});

test('gravação rejeita fim antes do início e aceita notas', () => {
  const bad = parseCalendarWrite({
    companyId: 'c1',
    title: 'A',
    startsAt: '2026-10-17T12:00:00.000Z',
    endsAt: '2026-10-17T11:00:00.000Z',
  });
  assert.equal(bad.ok, false);
  const ok = parseCalendarWrite(
    { companyId: 'c1', title: '  Visita  ', description: 'campo', startsAt: '2026-10-17T12:00:00.000Z', allDay: true },
    { companyRequired: true },
  );
  assert.equal(ok.ok, true);
  if (ok.ok) {
    assert.equal(ok.data.title, 'Visita');
    assert.equal(ok.data.description, 'campo');
    assert.equal(ok.companyId, 'c1');
  }
});
