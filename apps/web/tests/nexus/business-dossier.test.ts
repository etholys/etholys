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
import {
  applyDiagTurn,
  confirmDiagBlock,
  diagProgress,
  emptyAuroraDiagnostic,
  normalizeDiagPending,
  startDiagBlock,
} from '../../lib/aurora-diagnostic';
import {
  auroraAttention,
  auroraNextAction,
  auroraPortfolioCounts,
  auroraWeekBriefing,
  auroraWeekBuckets,
  groupAuroraByProgram,
  type AuroraPortfolioItem,
} from '../../lib/aurora-week';

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

test('AURORA release patch clears technician and keeps POLARIS thread', () => {
  const merged = mergeInterviewJson(
    {
      __auroraTech: { userId: 'u1', name: 'Ana', claimedAt: '2026-09-28' },
      __polarisThread: [{ role: 'assistant', text: 'hola' }],
    },
    auroraInterviewPatch({ tech: null }),
  );
  assert.equal(merged.__auroraTech, null);
  assert.equal(readAuroraTech(merged), null);
  assert.equal((merged.__polarisThread as { text: string }[])[0].text, 'hola');
});

function item(partial: Partial<AuroraPortfolioItem> & Pick<AuroraPortfolioItem, 'companyId' | 'name' | 'stage'>): AuroraPortfolioItem {
  return {
    shortName: partial.name,
    engagementId: 'eng-a',
    engagementTitle: 'Programa A',
    hasPortrait: partial.stage !== 'talk',
    hypothesisAccepted: partial.stage !== 'talk' && partial.stage !== 'portrait',
    hypothesis: '',
    openBetCount: partial.stage === 'bets' ? 1 : partial.stage === 'talk' || partial.stage === 'portrait' ? 0 : 2,
    betTitles: [],
    lastRhythmAt: null,
    lastRhythmHappened: '',
    lastRhythmBlocked: '',
    lastRhythmNext: '',
    portraitPreview: '',
    technicianName: '',
    technicianUserId: '',
    mine: false,
    dueBetTitles: [],
    diagnosticDone: 0,
    diagnosticTotal: 6,
    diagnosticComplete: false,
    diagnosticAvg: null,
    ...partial,
  };
}

test('AURORA week buckets split the technician round from blocked and unclaimed', () => {
  const rows = [
    item({ companyId: '1', name: 'Horta', stage: 'rhythm', mine: true, technicianUserId: 'u1', technicianName: 'Ana' }),
    item({
      companyId: '2',
      name: 'Queijo',
      stage: 'steady',
      mine: true,
      technicianUserId: 'u1',
      lastRhythmBlocked: 'falta câmara fria',
    }),
    item({ companyId: '3', name: 'Mel', stage: 'talk' }),
  ];
  const buckets = auroraWeekBuckets(rows);
  assert.deepEqual(buckets.round.map((r) => r.companyId), ['1']);
  assert.deepEqual(buckets.blocked.map((r) => r.companyId), ['2']);
  assert.deepEqual(buckets.unclaimed.map((r) => r.companyId), ['3']);
  assert.equal(auroraAttention(rows[2]!), 'unclaimed');
  assert.equal(auroraAttention(rows[1]!), 'blocked');
  assert.match(auroraNextAction(rows[1]!, 'pt'), /câmara fria/);
  const counts = auroraPortfolioCounts(rows);
  assert.equal(counts.mine, 2);
  assert.equal(counts.unclaimed, 1);
  assert.equal(counts.blocked, 1);
  assert.equal(counts.programs, 1);
  const briefing = auroraWeekBriefing(rows, 'pt');
  assert.ok(briefing.some((line) => /ronda/i.test(line)));
  assert.ok(briefing.some((line) => /Queijo/.test(line) || /câmara/.test(line)));
});

test('AURORA groups the portfolio by AT program', () => {
  const groups = groupAuroraByProgram([
    item({ companyId: '1', name: 'Horta', stage: 'talk', engagementId: 'a', engagementTitle: 'Coorte 1' }),
    item({ companyId: '2', name: 'Queijo', stage: 'steady', engagementId: 'a', engagementTitle: 'Coorte 1', technicianUserId: 'u' }),
    item({ companyId: '3', name: 'Mel', stage: 'rhythm', engagementId: 'b', engagementTitle: 'Coorte 2' }),
  ]);
  assert.equal(groups[0]?.title, 'Coorte 1');
  assert.equal(groups[0]?.items.length, 2);
  assert.equal(groups[0]?.unclaimed, 1);
  assert.equal(groups.find((g) => g.engagementId === 'b')?.needsAttention, 1);
});

test('AURORA diagnostic confirms a block and tracks progress without quiz scores', () => {
  let state = emptyAuroraDiagnostic();
  state = startDiagBlock(state, 'finance', 'pt');
  assert.equal(state.activeBlockId, 'finance');
  assert.equal(state.blocks.finance.status, 'active');
  assert.match(state.blocks.finance.messages[0]!.text, /dinheiro|mês/i);

  state = applyDiagTurn(state, 'finance', 'Anotam no caderno e misturam com a conta pessoal.', {
    reply: 'E o custo de cada venda — sabem ou é a olho?',
    ready: false,
    level: null,
    situation: '',
    gap: '',
    potential: '',
  });
  assert.equal(state.blocks.finance.messages.length, 3);

  state = applyDiagTurn(state, 'finance', 'Custo é a olho. Fluxo de caixa não existe.', {
    reply: 'Proponho nível 2: informal, na cabeça e no caderno.',
    ready: true,
    level: 2,
    situation: 'Caderno informal, conta misturada com a pessoal, custo a olho, sem fluxo de caixa.',
    gap: 'Não há fluxo de caixa nem custo unitário.',
    potential: 'Já registam algo no caderno — dá para separar contas.',
  });
  const pending = normalizeDiagPending(state.blocks.finance.pending, 'pt');
  assert.equal(pending.ready, true);
  assert.equal(pending.level, 2);

  state = confirmDiagBlock(state, 'finance', {
    level: 2,
    situation: pending.situation,
    gap: pending.gap,
    potential: pending.potential,
  });
  const progress = diagProgress(state);
  assert.equal(progress.done, 1);
  assert.equal(progress.complete, false);
  assert.equal(progress.gaps[0], 'Não há fluxo de caixa nem custo unitário.');
  assert.equal(looksLikeCatalogScore(pending.situation), false);
});

