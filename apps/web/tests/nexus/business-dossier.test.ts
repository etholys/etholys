import test from 'node:test';
import assert from 'node:assert/strict';
import { draftPortraitFromInterview, mergeInterviewJson } from '../../lib/business-dossier';
import { auroraMethodStage, collectAttendedBusinesses } from '../../lib/aurora-portfolio';
import {
  auroraInterviewPatch,
  looksLikeCatalogScore,
  normalizeAuroraDraft,
  readAuroraTech,
  selectAuroraBets,
} from '../../lib/aurora-interview';

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

test('AURORA interview patch keeps POLARIS thread keys', () => {
  const merged = mergeInterviewJson(
    { __polarisThread: [{ role: 'assistant', text: 'hola' }], do: 'horta' },
    auroraInterviewPatch({
      tech: { userId: 'u1', name: 'Ana', claimedAt: '2026-09-28' },
      messages: [{ role: 'user', text: 'venden queijo' }],
    }),
  );
  assert.equal((merged.__polarisThread as { text: string }[])[0].text, 'hola');
  assert.equal(merged.do, 'horta');
  assert.equal(readAuroraTech(merged)?.name, 'Ana');
});

test('AURORA draft is not ready without portrait and hypothesis', () => {
  const d = normalizeAuroraDraft({ ready: true, reply: 'ok', portraitText: 'curto', hypothesis: 'x' }, 'pt');
  assert.equal(d.ready, false);
  const ok = normalizeAuroraDraft(
    {
      ready: true,
      reply: 'próxima pergunta',
      portraitText: 'Faz queijo de ovelha para restaurantes da costa. O dinheiro entra nas feiras de sábado.',
      hypothesis: 'O travão é a entrega irregular; o puxão é a rede de restaurantes.',
      gaps: [{ text: 'entrega irregular', evidence: 'conversa' }],
      bets: [{ title: 'Fixar dia de entrega', why: 'perderam dois restaurantes', indicator: 'entregas na sexta' }],
    },
    'pt',
  );
  assert.equal(ok.ready, true);
  assert.equal(ok.gaps[0]?.text, 'entrega irregular');
  assert.equal(ok.bets.length, 1);
});

test('catalog scores are rejected in AURORA drafts', () => {
  assert.equal(looksLikeCatalogScore('Diagnóstico NEXUS: 61/100'), true);
  assert.equal(looksLikeCatalogScore('Faz queijo de ovelha'), false);
});

test('AURORA keeps at most four open bets without repeating titles', () => {
  const picks = selectAuroraBets(
    ['Fixar dia de entrega'],
    [
      { title: 'Fixar dia de entrega', why: '', indicator: '' },
      { title: 'Caderno de encomendas', why: 'perdem pedidos', indicator: 'pedidos escritos' },
      { title: 'Visitar dois restaurantes', why: 'puxão', indicator: 'reuniões' },
    ],
    3,
  );
  assert.equal(picks.length, 1);
  assert.equal(picks[0]?.title, 'Caderno de encomendas');
});
