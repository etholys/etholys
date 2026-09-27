import test from 'node:test';
import assert from 'node:assert/strict';
import {
  alertFingerprint,
  extractInboundMessages,
  normalizeWhatsappPhone,
  parseInboundWhatsapp,
} from '../../lib/nexus-whatsapp';

test('normalizes WhatsApp phones to E.164', () => {
  assert.equal(normalizeWhatsappPhone('+55 (11) 99999-0000'), '+5511999990000');
  assert.equal(normalizeWhatsappPhone('5511999990000'), '+5511999990000');
  assert.equal(normalizeWhatsappPhone('123'), null);
});

test('parses production messages into field entries', () => {
  const irr = parseInboundWhatsapp('15 mm irrigação');
  assert.equal(irr.type, 'entry');
  if (irr.type === 'entry') {
    assert.equal(irr.kind, 'irrigation');
    assert.equal(irr.metric, 'irrigation_mm');
    assert.equal(irr.value, 15);
  }

  const eggs = parseInboundWhatsapp('120 ovos hoje');
  assert.equal(eggs.type, 'entry');
  if (eggs.type === 'entry') {
    assert.equal(eggs.kind, 'egg');
    assert.equal(eggs.value, 120);
  }

  const free = parseInboundWhatsapp('vi lagarta no milho');
  assert.equal(free.type, 'entry');
  if (free.type === 'entry') {
    assert.equal(free.kind, 'observation');
    assert.match(free.note, /lagarta/);
  }
});

test('parses command confirmation', () => {
  assert.equal(parseInboundWhatsapp('SIM').type, 'ack');
  assert.equal(parseInboundWhatsapp('sí').type, 'ack');
  assert.equal(parseInboundWhatsapp('não').type, 'reject');
});

test('extracts Cloud API inbound messages', () => {
  const msgs = extractInboundMessages({
    entry: [
      {
        changes: [
          {
            value: {
              contacts: [{ profile: { name: 'João' } }],
              messages: [{ from: '5511999990000', text: { body: '20 mm irrigacao' } }],
            },
          },
        ],
      },
    ],
  });
  assert.equal(msgs.length, 1);
  assert.equal(msgs[0].phone, '5511999990000');
  assert.equal(msgs[0].text, '20 mm irrigacao');
});

test('alert fingerprint is stable', () => {
  const a = alertFingerprint([
    { id: 'b', title: 'seco' },
    { id: 'a', title: 'quente' },
  ]);
  const b = alertFingerprint([
    { id: 'a', title: 'quente' },
    { id: 'b', title: 'seco' },
  ]);
  assert.equal(a, b);
});
