import test from 'node:test';
import assert from 'node:assert/strict';
import {
  pickFeaturedSession,
  sessionStatus,
  type SerializedLiveSession,
} from '../../lib/forge/live-sessions';

test('sessionStatus detects live window', () => {
  const start = new Date('2026-05-22T10:00:00Z');
  const end = new Date('2026-05-22T12:00:00Z');
  assert.equal(sessionStatus(start, end, new Date('2026-05-22T09:00:00Z')), 'upcoming');
  assert.equal(sessionStatus(start, end, new Date('2026-05-22T11:00:00Z')), 'live');
  assert.equal(sessionStatus(start, end, new Date('2026-05-22T13:00:00Z')), 'past');
});

test('pickFeaturedSession prefers live over upcoming', () => {
  const sessions: SerializedLiveSession[] = [
    {
      id: '1',
      courseId: 'c',
      title: 'Upcoming',
      startsAt: '2099-01-01T10:00:00.000Z',
      endsAt: null,
      meetingUrl: null,
      activityId: null,
      activityTitle: null,
      facilitatorNotes: null,
      sortOrder: 0,
      status: 'upcoming',
    },
    {
      id: '2',
      courseId: 'c',
      title: 'Live now',
      startsAt: '2020-01-01T10:00:00.000Z',
      endsAt: '2099-01-01T12:00:00.000Z',
      meetingUrl: null,
      activityId: null,
      activityTitle: null,
      facilitatorNotes: null,
      sortOrder: 1,
      status: 'live',
    },
  ];
  assert.equal(pickFeaturedSession(sessions)?.title, 'Live now');
});
