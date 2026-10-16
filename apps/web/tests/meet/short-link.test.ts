import test from 'node:test';
import assert from 'node:assert/strict';
import {
  meetSessionIdFromShortCode,
  meetShortCode,
  resolveMeetSessionKey,
} from '../../lib/meet/short-link.ts';

const IDS = [
  'cm1abc2def3ghi4jkl5mnopqr',
  'clh0examplecuid0000000001',
  'c' + 'abcdefghijklmnopqrstuvwx',
];

test('short code roundtrips cuid and stays shorter than the old join URL', () => {
  for (const id of IDS) {
    const code = meetShortCode(id);
    assert.equal(meetSessionIdFromShortCode(code), id);
    assert.ok(code.length < id.length + 8, code);
    const path = `/m/${code}`;
    assert.equal(path, `/m/${meetShortCode(id)}`);
    assert.ok(!path.includes('companyId'));
    assert.ok(path.length < `/meet/join/${id}?companyId=cmcompanyid00000000000001`.length);
  }
});

test('raw session id still resolves', () => {
  const id = 'cm1abc2def3ghi4jkl5mnopqr';
  assert.equal(resolveMeetSessionKey(id), id);
  assert.equal(resolveMeetSessionKey(meetShortCode(id)), id);
});

test('garbage does not decode', () => {
  assert.equal(meetSessionIdFromShortCode('nope'), null);
  assert.equal(meetSessionIdFromShortCode('P' + '!!!!'), null);
});
