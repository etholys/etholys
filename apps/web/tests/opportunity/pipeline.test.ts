import test from 'node:test';
import assert from 'node:assert/strict';
import {
  drawerFilterMatch,
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

test('origin and donor survive a later pipeline patch', () => {
  const first = writeFundHubMeta('', {
    pipelineStatus: 'decide',
    origin: { runId: 'run1', scanFocus: 'open_now', savedAt: '2026-09-26T12:00:00.000Z' },
    donor: { contacts: 'calls@iadb.org', typicalWindow: 'mar–mai' },
  });
  const second = writeFundHubMeta(first, { pipelineStatus: 'prepare' });
  const meta = parseFundHubMeta(second);
  assert.equal(meta.origin?.runId, 'run1');
  assert.equal(meta.origin?.scanFocus, 'open_now');
  assert.equal(meta.donor?.contacts, 'calls@iadb.org');
  assert.equal(meta.pipelineStatus, 'prepare');
});

test('drawers split this window, watch and no-call', () => {
  assert.equal(drawerFilterMatch({ deadline: '2026-10-01', pipelineStatus: 'prepare' }, 'work'), true);
  assert.equal(drawerFilterMatch({ deadline: null, pipelineStatus: 'decide' }, 'work'), false);
  assert.equal(drawerFilterMatch({ deadline: '2026-10-01', pipelineStatus: 'won' }, 'work'), false);
  assert.equal(drawerFilterMatch({ watchOpen: true }, 'watch'), true);
  assert.equal(drawerFilterMatch({ watchOpen: false, deadline: null }, 'repo'), true);
  assert.equal(drawerFilterMatch({ deadline: '2026-10-01' }, 'repo'), false);
});

test('closed filter groups won and lost', () => {
  assert.equal(pipelineFilterMatch('won', 'closed'), true);
  assert.equal(pipelineFilterMatch('lost', 'closed'), true);
  assert.equal(pipelineFilterMatch('prepare', 'closed'), false);
  assert.equal(pipelineFilterMatch('decide', 'decide'), true);
});
