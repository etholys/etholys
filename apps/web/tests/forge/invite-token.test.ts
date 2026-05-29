import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildForgeInviteUrl,
  generateForgeInviteToken,
  forgeInviteExpiresAt,
  maskEmail,
} from '../../lib/forge/invite-token';

test('generates url-safe tokens', () => {
  const t = generateForgeInviteToken();
  assert.ok(t.length > 20);
  assert.ok(!/[+/=]/.test(t));
});

test('builds invite url', () => {
  const url = buildForgeInviteUrl('abc123', 'http://localhost:3000');
  assert.equal(url, 'http://localhost:3000/hub/forge/activar?token=abc123');
});

test('expires in future', () => {
  const exp = forgeInviteExpiresAt();
  assert.ok(exp.getTime() > Date.now());
});

test('masks email', () => {
  assert.equal(maskEmail('tiago@example.com'), 't***@example.com');
});
