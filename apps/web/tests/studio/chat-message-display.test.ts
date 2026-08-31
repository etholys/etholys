import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseStudioChatMessageContent } from '../../lib/studio/chat-message-display';

describe('chat-message-display', () => {
  it('splits legacy attachment and scope suffixes', () => {
    const raw =
      'Reescribe la intro\n\n[2 anexo(s): doc.pdf, img.png]\n\n[Ámbito: P.1 · Título]';
    const parsed = parseStudioChatMessageContent(raw);
    assert.equal(parsed.text, 'Reescribe la intro');
    assert.deepEqual(parsed.attachmentNames, ['doc.pdf', 'img.png']);
    assert.match(parsed.scopeLabel || '', /P\.1/);
  });
});
