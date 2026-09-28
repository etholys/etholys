import test from 'node:test';
import assert from 'node:assert/strict';
import { draftPortraitFromInterview } from '../../lib/business-dossier';
import { auroraMethodStage, collectAttendedBusinesses } from '../../lib/aurora-portfolio';

test('interview draft keeps stuck and works as gap and potential', () => {
  const d = draftPortraitFromInterview(
    {
      do: 'assistência a fundos',
      money: 'editais',
      deliver: 'propostas',
      stuck: 'evidência desordenada',
      works: 'rede de confiança',
    },
    'pt'
  );
  assert.match(d.portraitText, /assistência/);
  assert.match(d.hypothesis, /evidência desordenada/);
  assert.equal(d.gaps[0]?.text, 'evidência desordenada');
  assert.equal(d.potentials[0]?.text, 'rede de confiança');
});

test('method stage follows conversation → portrait → bets → weekly rhythm', () => {
  const now = new Date('2026-09-27T12:00:00Z');
  assert.equal(
    auroraMethodStage({ hasPortrait: false, hypothesisAccepted: false, openBetCount: 0, lastRhythmAt: null, now }),
    'talk'
  );
  assert.equal(
    auroraMethodStage({ hasPortrait: true, hypothesisAccepted: false, openBetCount: 0, lastRhythmAt: null, now }),
    'portrait'
  );
  assert.equal(
    auroraMethodStage({ hasPortrait: true, hypothesisAccepted: true, openBetCount: 1, lastRhythmAt: null, now }),
    'bets'
  );
  assert.equal(
    auroraMethodStage({ hasPortrait: true, hypothesisAccepted: true, openBetCount: 2, lastRhythmAt: null, now }),
    'rhythm'
  );
  assert.equal(
    auroraMethodStage({
      hasPortrait: true,
      hypothesisAccepted: true,
      openBetCount: 3,
      lastRhythmAt: '2026-09-26T12:00:00Z',
      now,
    }),
    'steady'
  );
  assert.equal(
    auroraMethodStage({
      hasPortrait: true,
      hypothesisAccepted: true,
      openBetCount: 3,
      lastRhythmAt: '2026-09-10T12:00:00Z',
      now,
    }),
    'rhythm'
  );
});

test('portfolio keeps attended firms and drops operator/sponsor', () => {
  const rows = collectAttendedBusinesses([
    {
      id: 'eng-old',
      title: 'Programa A',
      updatedAt: new Date('2026-01-01'),
      members: [
        { companyId: 'op', memberRole: 'operator', company: { name: 'Incubadora', shortName: 'Inc' } },
        { companyId: 'sp', memberRole: 'sponsor', company: { name: 'Fundo', shortName: 'Fundo' } },
        { companyId: 'm1', memberRole: 'client', company: { name: 'Horta', shortName: 'Horta' } },
      ],
    },
    {
      id: 'eng-new',
      title: 'Programa B',
      updatedAt: new Date('2026-06-01'),
      members: [
        { companyId: 'm1', memberRole: 'principal', company: { name: 'Horta', shortName: 'Horta' } },
        { companyId: 'm2', memberRole: 'affiliate', company: { name: 'Queijo', shortName: 'Queijo' } },
      ],
    },
  ]);
  assert.deepEqual(
    rows.map((r) => ({ id: r.companyId, eng: r.engagementId })),
    [
      { id: 'm1', eng: 'eng-new' },
      { id: 'm2', eng: 'eng-new' },
    ]
  );
  assert.equal(rows.find((r) => r.companyId === 'op'), undefined);
  assert.equal(rows.find((r) => r.companyId === 'sp'), undefined);
});
