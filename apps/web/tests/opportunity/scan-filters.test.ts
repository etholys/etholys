import test from 'node:test';
import assert from 'node:assert/strict';
import {
  coerceOpenAvailability,
  dropDuplicateFunds,
  isLikelyDuplicateFund,
  isOpenNowCandidate,
  normalizeFundIdentity,
} from '../../lib/opportunity/scan-filters';

test('normalize strips accents and demo suffix noise', () => {
  assert.equal(
    normalizeFundIdentity('Convocatoria Innovación Rural 2026 (demo)'),
    'convocatoria innovacion rural 2026 demo',
  );
});

test('duplicate matches same name with longer institution', () => {
  assert.equal(
    isLikelyDuplicateFund(
      {
        name: 'BID Lab — Innovación agroclimática 2026',
        institution: 'BID Lab (Banco Interamericano de Desarrollo)',
      },
      [{ name: 'BID Lab — Innovación agroclimática 2026', institution: 'BID Lab' }],
    ),
    true,
  );
});

test('duplicate matches catalog name with (demo) suffix', () => {
  assert.equal(
    isLikelyDuplicateFund(
      { name: 'Convocatoria Innovación Rural 2026', institution: 'Agencia Demo' },
      [{ name: 'Convocatoria Innovación Rural 2026 (demo)', institution: 'Agencia Demo de Cooperación' }],
    ),
    true,
  );
});

test('dropDuplicateFunds removes catalog clones', () => {
  const kept = dropDuplicateFunds(
    [
      { name: 'BID Lab — Innovación agroclimática 2026', institution: 'BID Lab (BID)' },
      { name: 'ANDE — Programa de desarrollo rural 2026', institution: 'ANDE' },
    ],
    [{ name: 'BID Lab — Innovación agroclimática 2026', institution: 'BID Lab' }],
  );
  assert.equal(kept.length, 1);
  assert.equal(kept[0]?.name, 'ANDE — Programa de desarrollo rural 2026');
});

test('missing availability becomes open_now; closed stays closed', () => {
  assert.equal(coerceOpenAvailability(undefined), 'open_now');
  assert.equal(coerceOpenAvailability('rolling'), 'rolling');
  assert.equal(coerceOpenAvailability('closed'), 'closed');
  assert.equal(isOpenNowCandidate({}), true);
  assert.equal(isOpenNowCandidate({ availabilityStatus: 'seasonal' }), false);
});
