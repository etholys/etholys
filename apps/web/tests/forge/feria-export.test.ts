import test from 'node:test';
import assert from 'node:assert/strict';
import { buildFeriaSessionCsv } from '../../lib/forge/feria-export';

test('buildFeriaSessionCsv exports header and rows', () => {
  const csv = buildFeriaSessionCsv([
    {
      roomCode: 'ABC123',
      sessionTitle: 'Feira teste',
      teamNumber: 1,
      teamName: 'Equipo 1',
      name: 'Ana',
      email: 'ana@test.com',
      accessCode: 'XYZ789',
      ageRange: '25-34',
      gender: 'female',
      locale: 'pt',
      registeredAt: '2026-07-04T12:00:00.000Z',
    },
  ]);
  assert.match(csv, /^room_code,session_title/);
  assert.match(csv, /ABC123/);
  assert.match(csv, /ana@test\.com/);
});
