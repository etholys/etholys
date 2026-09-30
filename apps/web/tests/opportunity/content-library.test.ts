import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  emptyContentLibrary,
  newSnippet,
  parseContentLibrary,
} from '../../lib/opportunity/content-library';

describe('content-library', () => {
  it('parses and truncates snippets', () => {
    const lib = parseContentLibrary({
      snippets: [
        { id: '1', title: 'Missão', body: 'Somos uma OSC rural.', kind: 'mission' },
        { id: '2', title: '', body: 'skip', kind: 'win' },
        { title: 'Win', body: 'Projeto X', kind: 'bogus' },
      ],
      voiceNotes: 'Tom formal',
    });
    assert.equal(lib.snippets.length, 2);
    assert.equal(lib.snippets[0].kind, 'mission');
    assert.equal(lib.snippets[1].kind, 'other');
    assert.equal(lib.voiceNotes, 'Tom formal');
  });

  it('newSnippet creates id and timestamps', () => {
    const s = newSnippet('Capacidade', 'Equipa de 12', 'capacity');
    assert.ok(s.id.startsWith('c_'));
    assert.equal(s.kind, 'capacity');
    assert.ok(s.updatedAt);
  });

  it('empty library', () => {
    assert.deepEqual(emptyContentLibrary(), { snippets: [] });
  });
});
