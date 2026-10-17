import assert from 'node:assert/strict';
import test from 'node:test';
import { calendarEventVisible } from '../lib/calendar/visibility';
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
