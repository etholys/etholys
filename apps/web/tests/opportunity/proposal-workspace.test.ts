import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildEditalSummaryFromSeed,
  findReusableDraft,
  seedDocumentMarkdown,
  sectionsFromMarkdown,
  shouldSkipProposalIntake,
  type ProposalDraftIndex,
  type ProposalFundSeed,
} from '../../lib/opportunity/proposal-workspace';
import { normalizeFundhubMode, buildFundhubProposalSystemPrompt } from '../../lib/agents/fundhub-proposal-prompt';

const richFund: ProposalFundSeed = {
  id: 'fund_horizonte_1',
  name: 'Fondo Verde Regional',
  institution: 'BID',
  description: 'Financia restauração de corredores ecológicos.',
  linkOficial: 'https://www.iadb.org/edital',
  whoCanApply: 'ONG com 2 anos de operação',
  eligibility: 'Contrato local no Cone Sul',
  deadline: '2026-12-01',
  countries: 'UY, AR, PY',
  amount: 250000,
  currency: 'USD',
};

test('skip intake when fundId is a real saved fund', () => {
  assert.equal(shouldSkipProposalIntake({ fundId: 'clxyz123' }), true);
});

test('skip intake when candidate has official link and name', () => {
  assert.equal(
    shouldSkipProposalIntake({
      candidate: { name: 'Fondo Verde', linkOficial: 'https://www.iadb.org', description: '' },
    }),
    true,
  );
});

test('skip intake when candidate has description', () => {
  assert.equal(
    shouldSkipProposalIntake({
      candidate: { name: 'Fondo Verde', description: 'Grant for restoration' },
    }),
    true,
  );
});

test('do not skip intake for empty adhoc or nameless candidate', () => {
  assert.equal(shouldSkipProposalIntake({ fundId: 'adhoc-1' }), false);
  assert.equal(shouldSkipProposalIntake({ candidate: { name: '', description: 'x' } }), false);
  assert.equal(shouldSkipProposalIntake({ fund: { id: 'adhoc-9', name: 'Avulsa' } }), false);
  assert.equal(shouldSkipProposalIntake({}), false);
});

test('edital summary includes gathered fund fields', () => {
  const summary = buildEditalSummaryFromSeed(richFund);
  assert.match(summary, /Descrição/);
  assert.match(summary, /restauração/);
  assert.match(summary, /Quem pode candidatar/);
  assert.match(summary, /Elegibilidade/);
  assert.match(summary, /250/);
});

test('reuse only draft proposals for the same fund', () => {
  const drafts: ProposalDraftIndex[] = [
    {
      workspaceId: 'w1',
      fundId: 'fund_horizonte_1',
      fundName: 'Fondo Verde Regional',
      fundInstitution: 'BID',
      editalLink: '',
      editalSummary: '',
      createdAt: '2026-01-01',
      updatedAt: '2026-01-02',
      status: 'submitted',
    },
    {
      workspaceId: 'w2',
      fundId: 'fund_horizonte_1',
      fundName: 'Fondo Verde Regional',
      fundInstitution: 'BID',
      editalLink: '',
      editalSummary: '',
      createdAt: '2026-01-03',
      updatedAt: '2026-01-04',
      status: 'draft',
    },
  ];
  assert.equal(findReusableDraft(drafts, 'fund_horizonte_1')?.workspaceId, 'w2');
  assert.equal(findReusableDraft(drafts, 'adhoc-1'), undefined);
});

test('seed document has ideia geral and rascunho', () => {
  const md = seedDocumentMarkdown(richFund, 'Ideia: corredor nativo com escolas rurais.');
  assert.match(md, /^# Fondo Verde Regional/m);
  assert.match(md, /## Ideia geral/);
  assert.match(md, /escolas rurais/);
  assert.match(md, /## Rascunho/);
});

test('sectionsFromMarkdown splits headings', () => {
  const sections = sectionsFromMarkdown('# Titulo\n\n## Ideia geral\n\nTexto A\n\n## Rascunho\n\nTexto B');
  assert.equal(sections.some((s) => s.title === 'Ideia geral' && s.content.includes('Texto A')), true);
  assert.equal(sections.some((s) => s.title === 'Rascunho' && s.content.includes('Texto B')), true);
});

test('normalizeFundhubMode accepts brainstorm', () => {
  assert.equal(normalizeFundhubMode('brainstorm'), 'brainstorm');
  assert.equal(normalizeFundhubMode('structure'), 'structure');
  assert.equal(normalizeFundhubMode('nope'), 'chat');
});

test('brainstorm prompt asks for chuva de ideias and forbids FUNDHUB leftovers', () => {
  const sys = buildFundhubProposalSystemPrompt('brainstorm');
  assert.match(sys, /chuva de ideias/i);
  assert.match(sys, /FundHub/);
  assert.match(sys, /Não menciones nomes internos de produto/);
});
