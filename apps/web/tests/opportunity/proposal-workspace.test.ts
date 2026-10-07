import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildEditalSummaryFromSeed,
  findReusableDraft,
  appendWriteSections,
  formatProposalFileContext,
  hydrateProposalAttachedFiles,
  persistableProposalFiles,
  mergeDraftIntoMarkdown,
  resolveCanvasEditTarget,
  seedDocumentMarkdown,
  seedUnderstandMarkdown,
  sectionsFromMarkdown,
  shouldSkipProposalIntake,
  type ProposalDraftIndex,
  type ProposalFundSeed,
} from '../../lib/opportunity/proposal-workspace';
import {
  normalizeFundhubMode,
  normalizeFundhubLocale,
  buildFundhubProposalSystemPrompt,
  buildFundhubProposalUserPrompt,
  looksLikeRevisionRequest,
  sanitizeFundhubChatHistory,
} from '../../lib/agents/fundhub-proposal-prompt';

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
  const md = seedDocumentMarkdown(richFund, 'Ideia: corredor nativo com escolas rurais.', 'pt');
  assert.match(md, /^# Fondo Verde Regional/m);
  assert.match(md, /## Ideia geral/);
  assert.match(md, /escolas rurais/);
  assert.match(md, /## Rascunho/);
  assert.match(md, /## Elegibilidade e requisitos/);
});

test('seed document cites official bases when present', () => {
  const md = seedDocumentMarkdown({
    ...richFund,
    basesText: '### Bases\nSó cooperativas rurais do Uruguai.',
  }, undefined, 'pt');
  assert.match(md, /## Bases oficiais/);
  assert.match(md, /cooperativas rurais/);
});

test('sectionsFromMarkdown splits headings', () => {
  const sections = sectionsFromMarkdown('# Titulo\n\n## Ideia geral\n\nTexto A\n\n## Rascunho\n\nTexto B');
  assert.equal(sections.some((s) => s.title === 'Ideia geral' && s.content.includes('Texto A')), true);
  assert.equal(sections.some((s) => s.title === 'Rascunho' && s.content.includes('Texto B')), true);
});

test('normalizeFundhubMode accepts understand and brainstorm', () => {
  assert.equal(normalizeFundhubMode('understand'), 'understand');
  assert.equal(normalizeFundhubMode('brainstorm'), 'brainstorm');
  assert.equal(normalizeFundhubMode('structure'), 'structure');
  assert.equal(normalizeFundhubMode('nope'), 'chat');
});

test('understand prompt is first and forbids brainstorm plus fake login', () => {
  const sys = buildFundhubProposalSystemPrompt('understand', 'es');
  assert.match(sys, /entender o edital/i);
  assert.match(sys, /chuva de ideias/i);
  assert.match(sys, /login/i);
  assert.match(sys, /FundHub/);
  assert.match(sys, /español/);
  assert.match(sys, /IDIOMA OBLIGATORIO|IDIOMA OBRIGATÓRIO|MANDATORY LANGUAGE/);
});

test('hub locale drives the reply language', () => {
  assert.equal(normalizeFundhubLocale('en'), 'en');
  assert.equal(normalizeFundhubLocale('xx'), 'es');
  const en = buildFundhubProposalSystemPrompt('chat', 'en');
  assert.match(en, /English/);
  const pt = buildFundhubProposalSystemPrompt('chat', 'pt');
  assert.match(pt, /português/);
});

test('brainstorm prompt asks for chuva de ideias and forbids FUNDHUB leftovers', () => {
  const sys = buildFundhubProposalSystemPrompt('brainstorm');
  assert.match(sys, /chuva de ideias/i);
  assert.match(sys, /FundHub/);
  assert.match(sys, /Não menciones nomes internos de produto/);
});

test('understand seed has leitura, write appends rascunho', () => {
  const md = seedUnderstandMarkdown(richFund, 'GO 123 aceita ONG australianas.', 'pt');
  assert.match(md, /## Leitura do edital/);
  assert.match(md, /ONG australianas/);
  assert.equal(/^##\s+Ideia geral/im.test(md), false);
  const next = appendWriteSections(md, 'pt');
  assert.match(next, /## Ideia geral/);
  assert.match(next, /## Rascunho/);
});

test('mergeDraftIntoMarkdown replaces matching headings and appends new ones', () => {
  const base = '# Fondo\n\n## Contexto\n\nViejo.\n\n## Presupuesto\n\nTBD.\n';
  const next = mergeDraftIntoMarkdown(
    base,
    '## Contexto\n\nNuevo párrafo.\n\n## Duración\n\n18 meses.\n',
  );
  assert.match(next, /## Contexto/);
  assert.match(next, /Nuevo párrafo/);
  assert.equal(next.includes('Viejo.'), false);
  assert.match(next, /## Presupuesto/);
  assert.match(next, /## Duración/);
  assert.match(next, /18 meses/);
});

test('canvas edit target and fuzzy c) merge keep the living draft', () => {
  const doc =
    '# PPD\n\n## c) Objetivo y actividades de la organización\n\nTexto viejo Rural Commerce.\n\n## D. Clasificación\n\nAlgo.\n';
  const target = resolveCanvasEditTarget(doc, 'mejorar el punto c — es sobre Frutalcoop');
  assert.ok(target);
  assert.match(target!.title, /c\)/i);
  assert.match(target!.content, /Rural Commerce/);
  const merged = mergeDraftIntoMarkdown(
    doc,
    '## c) Objetivo\n\nFrutalcoop acopia frutas de Los Santos.\n',
  );
  assert.match(merged, /## c\) Objetivo y actividades/);
  assert.match(merged, /Frutalcoop/);
  assert.equal(merged.includes('Rural Commerce'), false);
  assert.match(merged, /## D\. Clasificación/);
  const sys = buildFundhubProposalSystemPrompt('draft_section', 'es');
  assert.match(sys, /canvas — como ChatGPT\/Gemini/i);
});

test('understand seed follows Spanish hub locale', () => {
  const md = seedUnderstandMarkdown(richFund, 'GO 123 admite ONG australianas.', 'es');
  assert.match(md, /## Lectura de la convocatoria/);
  const next = appendWriteSections(md, 'es');
  assert.match(next, /## Idea general/);
  assert.match(next, /## Borrador/);
});

test('proposal file roles stay labeled and turn files are not persisted', () => {
  const unlabeled = hydrateProposalAttachedFiles([{ name: 'edital.pdf', size: 10, type: 'application/pdf' }]);
  assert.equal(unlabeled[0]?.role, 'bases');
  const labeled = hydrateProposalAttachedFiles([
    { name: 'cv.pdf', size: 2, type: 'application/pdf', role: 'reference', textExcerpt: 'ONG fundada en 2010' },
    { name: 'campo.png', size: 3, type: 'image/png', role: 'turn', dataBase64: 'xxxx' },
  ]);
  const ctx = formatProposalFileContext([
    { name: 'bases.pdf', role: 'bases', textExcerpt: 'Sección A obligatoria' },
    ...labeled,
  ]);
  assert.match(ctx, /BASES DO EDITAL/);
  assert.match(ctx, /REFERÊNCIA DA PROPOSTA/);
  assert.match(ctx, /DESTA MENSAGEM/);
  assert.match(ctx, /Sección A/);
  assert.match(ctx, /ONG fundada/);
  const stored = persistableProposalFiles([
    { name: 'a.pdf', size: 1, type: 'application/pdf', uploadedAt: '', role: 'bases', dataBase64: 'abc' },
    { name: 'b.png', size: 1, type: 'image/png', uploadedAt: '', role: 'turn', dataBase64: 'def' },
  ]);
  assert.equal(stored.length, 1);
  assert.equal(stored[0]?.name, 'a.pdf');
  assert.equal(stored[0]?.dataBase64, undefined);
});

test('chat prompt distinguishes file roles', () => {
  const sys = buildFundhubProposalSystemPrompt('chat', 'es');
  assert.match(sys, /BASES/);
  assert.match(sys, /REFERÊNCIA/);
  assert.match(sys, /DESTA MENSAGEM/);
});

test('chat history sanitize and revision intent keep prior draft', () => {
  const cleaned = sanitizeFundhubChatHistory([
    { role: 'user', content: '✎ c) objetivo' },
    {
      role: 'assistant',
      content: 'Escrito en el documento.\n\n## c) Objetivo\n\nFrutalcoop acopia frutas.',
    },
    { role: 'user', content: 'mejorar la respuesta anterior' },
  ]);
  assert.equal(cleaned.length, 3);
  assert.equal(cleaned[0]?.content, 'c) objetivo');
  assert.match(cleaned[1]?.content || '', /^## c\) Objetivo/);
  assert.equal(looksLikeRevisionRequest('mejorar la respuesta anterior'), true);
  assert.equal(looksLikeRevisionRequest('reescreve o ponto c'), true);
  assert.equal(looksLikeRevisionRequest('¿cuál es el plazo?'), false);
  const sys = buildFundhubProposalSystemPrompt('draft_section', 'es');
  assert.match(sys, /CONTINUIDADE DO CHAT/);
  assert.match(sys, /Não inventes factos/);
});

test('draft_section prioritizes user-named applicant over Hub tenant', () => {
  const sys = buildFundhubProposalSystemPrompt('draft_section', 'es');
  assert.match(sys, /ORGANIZAÇÃO POSTULANTE/i);
  assert.match(sys, /PROIBIDO preencher C, D, E/);
  assert.match(sys, /empresa do Hub/);
  const user = buildFundhubProposalUserPrompt(
    'draft_section',
    {
      locale: 'es',
      orgProfile: 'Nome: Rural Commerce LLC\nPaís: US',
      documentMarkdown: '## c) Objetivo\n\nTexto viejo sobre Rural Commerce.',
    },
    'c) Sírvase describir… la organización proponente:\nLa cooperativa Frutalcoop R.L. …\npero es sobre frutalcoop... que es la organización postulante',
  );
  assert.match(user, /Rural Commerce LLC/);
  assert.match(user, /NÃO assumas que é a organização postulante/);
  assert.match(user, /Frutalcoop/);
  assert.match(user, /Não uses a empresa do Hub como postulante/);
  assert.match(user, /Não redijas secções não pedidas/);
});
