import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildScanInbox,
  deadlineUrgency,
  daysUntilClose,
  filterInboxCandidates,
  sortCandidatesByDeadline,
} from '../../lib/opportunity/scan-inbox';
import type { ScanCandidate, ScanResultsPayload } from '../../lib/opportunity/scan-types';

function cand(partial: Partial<ScanCandidate> & { name: string }): ScanCandidate {
  return {
    tempId: partial.tempId ?? partial.name,
    name: partial.name,
    institution: partial.institution ?? 'Org',
    type: partial.type ?? 'Grant',
    callUrl: partial.callUrl ?? 'https://ande.org.uy/convocatoria/rural-2026',
    ...partial,
  };
}

function payload(
  runId: string,
  candidates: ScanCandidate[],
  flags?: Partial<Pick<ScanResultsPayload, 'savedTempIds' | 'discardedTempIds' | 'laterTempIds'>>,
): { runId: string; payload: ScanResultsPayload } {
  return {
    runId,
    payload: {
      runId,
      candidates,
      savedTempIds: flags?.savedTempIds ?? [],
      discardedTempIds: flags?.discardedTempIds ?? [],
      laterTempIds: flags?.laterTempIds ?? [],
    },
  };
}

test('new scan keeps previous pending until discarded', () => {
  const inbox = buildScanInbox([
    payload('run-new', [cand({ tempId: 'n1', name: 'Fundo Novo', closesAt: '2026-11-01' })]),
    payload('run-old', [cand({ tempId: 'o1', name: 'Fundo Antigo', closesAt: '2026-10-01' })]),
  ]);
  assert.equal(inbox.pending.length, 2);
  assert.deepEqual(
    inbox.pending.map((c) => c.name),
    ['Fundo Antigo', 'Fundo Novo'],
  );
  assert.equal(inbox.pending[0]?.runId, 'run-old');
});

test('duplicate across scans stays once; newer run wins', () => {
  const inbox = buildScanInbox([
    payload('run-new', [
      cand({ tempId: 'n1', name: 'BID Lab Rural', institution: 'BID Lab', description: 'novo' }),
    ]),
    payload('run-old', [
      cand({ tempId: 'o1', name: 'BID Lab Rural', institution: 'BID Lab', description: 'velho' }),
    ]),
  ]);
  assert.equal(inbox.pending.length, 1);
  assert.equal(inbox.pending[0]?.runId, 'run-new');
  assert.equal(inbox.pending[0]?.description, 'novo');
});

test('discarded or saved identity does not return on later scans', () => {
  const inbox = buildScanInbox([
    payload('run-new', [cand({ tempId: 'n1', name: 'Mesmo Fundo' })]),
    payload('run-old', [cand({ tempId: 'o1', name: 'Mesmo Fundo' })], { discardedTempIds: ['o1'] }),
  ]);
  assert.equal(inbox.pending.length, 0);
});

test('later stays in later tab and is not pending', () => {
  const inbox = buildScanInbox([
    payload('run-1', [cand({ tempId: 'a', name: 'Depois' })], { laterTempIds: ['a'] }),
  ]);
  assert.equal(inbox.pending.length, 0);
  assert.equal(inbox.later.length, 1);
  assert.equal(inbox.later[0]?.runId, 'run-1');
});

test('sorts soonest open deadline first; undated last; overdue after open', () => {
  const now = new Date(2026, 8, 23, 12, 0, 0, 0).getTime();
  const sorted = sortCandidatesByDeadline(
    [
      cand({ name: 'Sem data' }),
      cand({ name: 'Longe', closesAt: '2026-12-01' }),
      cand({ name: 'Vencido', closesAt: '2026-09-01' }),
      cand({ name: 'Amanha', closesAt: '2026-09-24' }),
    ],
    now,
  );
  assert.deepEqual(
    sorted.map((c) => c.name),
    ['Amanha', 'Longe', 'Vencido', 'Sem data'],
  );
});

test('urgency buckets and due-soon filter', () => {
  const now = new Date(2026, 8, 23, 12, 0, 0, 0).getTime();
  assert.equal(daysUntilClose(cand({ name: 'x', closesAt: '2026-09-23' }), now), 0);
  assert.equal(deadlineUrgency(0), 'today');
  assert.equal(deadlineUrgency(3), 'soon');
  assert.equal(deadlineUrgency(10), 'week');
  assert.equal(deadlineUrgency(-2), 'overdue');
  assert.equal(deadlineUrgency(null), 'none');

  const filtered = filterInboxCandidates(
    [
      cand({ name: 'Rural BID', type: 'Grant', closesAt: '2026-09-30' }),
      cand({ name: 'Credito X', type: 'Credit', closesAt: '2026-12-01' }),
    ],
    { query: 'rural', dueSoon: true },
    new Date(2026, 8, 23, 12, 0, 0, 0).getTime(),
  );
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0]?.name, 'Rural BID');
});
