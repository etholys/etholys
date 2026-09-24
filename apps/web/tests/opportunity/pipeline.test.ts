import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseFundHubMeta,
  pipelineFilterMatch,
  pipelineOf,
  writeFundHubMeta,
} from '../../lib/opportunity/pipeline';

test('default pipeline is decide when notes have no marker', () => {
  assert.equal(pipelineOf(null), 'decide');
  assert.equal(pipelineOf('Convocatória: https://x.test'), 'decide');
});

test('write then parse keeps pipeline and other notes', () => {
  const notes = writeFundHubMeta('Janela: 2026', { pipelineStatus: 'prepare' });
  assert.match(notes, /Janela: 2026/);
  assert.equal(parseFundHubMeta(notes).pipelineStatus, 'prepare');
  const next = writeFundHubMeta(notes, { watchOpen: true });
  assert.equal(parseFundHubMeta(next).pipelineStatus, 'prepare');
  assert.equal(parseFundHubMeta(next).watchOpen, true);
});

test('dossier survives a later pipeline patch', () => {
  const first = writeFundHubMeta('', {
    pipelineStatus: 'decide',
    dossier: { callUrl: 'https://www.ande.org.uy/convocatorias/x', basesText: 'Elegíveis: cooperativas.' },
  });
  const second = writeFundHubMeta(first, { pipelineStatus: 'prepare' });
  const meta = parseFundHubMeta(second);
  assert.equal(meta.pipelineStatus, 'prepare');
  assert.equal(meta.dossier?.callUrl, 'https://www.ande.org.uy/convocatorias/x');
  assert.match(meta.dossier?.basesText ?? '', /cooperativas/);
});

test('closed filter groups won and lost', () => {
  assert.equal(pipelineFilterMatch('won', 'closed'), true);
  assert.equal(pipelineFilterMatch('lost', 'closed'), true);
  assert.equal(pipelineFilterMatch('prepare', 'closed'), false);
  assert.equal(pipelineFilterMatch('decide', 'decide'), true);
});
