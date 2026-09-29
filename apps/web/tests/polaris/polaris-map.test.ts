import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeInterviewJson } from '../../lib/business-dossier';
import {
  POLARIS_SUGGESTIONS_KEY,
  POLARIS_THREAD_KEY,
  normalizePolarisDraft,
  parsePolarisModelJson,
  polarisInterviewPatch,
  polarisOpening,
  polarisSystemPrompt,
  readPolarisSuggestions,
  readPolarisThread,
  selectNewBets,
  isCatalogPortrait,
} from '../../lib/polaris-map';

test('polaris draft clamps gaps, potentials and bets and drops catalog scores', () => {
  const draft = normalizePolarisDraft(
    {
      reply: 'O retrato está em baixo.',
      ready: true,
      portraitText: 'Faz assistência a fundos para cooperativas pequenas, pago por edital ganho.',
      hypothesis: 'O travão é a evidência desordenada; o puxão é a rede de confiança.',
      gaps: [
        { text: 'evidência desordenada', evidence: 'disse na conversa' },
        { text: '42/100' },
        { text: 'caixa curta' },
        { text: 'equipe de um' },
        { text: 'proposta lenta' },
        { text: 'arquivo morto' },
        { text: 'isto não entra' },
      ],
      potentials: [{ text: 'rede de confiança' }, { text: 'Likert alto' }, { text: 'edital recorrente' }],
      bets: [
        { title: 'Pasta de evidência', why: 'sem isto a proposta não sai', indicator: 'uma pasta por edital' },
        { title: 'Um edital piloto', why: 'prova o ritmo', indicator: 'rascunho entregue' },
        { title: 'ok' },
        { title: 'Preço mínimo', why: 'para de trabalhar de graça', indicator: 'tabela escrita' },
        { title: 'Ritmo semanal', why: 'uma hora fixa', indicator: 'bloco na agenda' },
        { title: 'Quinta aposta', why: 'não cabe', indicator: 'x' },
      ],
    },
    'pt',
  );
  assert.equal(draft.ready, true);
  assert.equal(draft.gaps.length, 5);
  assert.equal(draft.gaps.some((g) => g.text.includes('100')), false);
  assert.equal(draft.potentials.length, 2);
  assert.equal(draft.potentials.some((g) => /likert/i.test(g.text)), false);
  assert.equal(draft.bets.length, 4);
  assert.equal(draft.bets[0]?.title, 'Pasta de evidência');
  assert.equal(draft.bets.some((b) => b.title === 'Quinta aposta'), false);
});

test('polaris draft is not ready without a real portrait', () => {
  const draft = normalizePolarisDraft(
    { reply: 'Conta mais.', ready: true, portraitText: 'curto', hypothesis: 'também curto' },
    'pt',
  );
  assert.equal(draft.ready, false);
  assert.equal(draft.bets.length, 0);
});

test('polaris thread survives interview beats', () => {
  const patch = polarisInterviewPatch(
    [
      { role: 'assistant', text: 'O que fazem?' },
      { role: 'user', text: 'Assistimos cooperativas.' },
    ],
    [{ title: 'Pasta de evidência', why: 'trava a proposta', indicator: 'uma pasta' }],
  );
  const merged = mergeInterviewJson({ do: 'assistência a fundos', money: 'editais' }, patch);
  assert.equal(merged.do, 'assistência a fundos');
  assert.equal(readPolarisThread(merged)[1]?.text, 'Assistimos cooperativas.');
  assert.equal(readPolarisSuggestions(merged)[0]?.title, 'Pasta de evidência');
  assert.equal(POLARIS_THREAD_KEY in merged, true);
  assert.equal(POLARIS_SUGGESTIONS_KEY in merged, true);
});

test('selectNewBets respects the open cap and skips duplicates', () => {
  const proposed = [
    { title: 'Pasta de evidência', why: '', indicator: '' },
    { title: 'pasta   de evidência', why: '', indicator: '' },
    { title: 'Tabela de preço', why: 'deixa de improvisar', indicator: 'tabela' },
  ];
  assert.equal(selectNewBets(['Pasta de evidência'], proposed, 3).length, 1);
  assert.equal(selectNewBets(['Pasta de evidência'], proposed, 4).length, 0);
});

test('polaris opening is consultant loading, not a diagnosis dump', () => {
  assert.match(polarisOpening('pt'), /Etholys|ler/i);
  assert.doesNotMatch(polarisOpening('es'), /no puede quedar así/i);
  assert.equal(isCatalogPortrait('Diagnóstico NEXUS: 42/100.\nAtividade: hortas'), true);
  assert.equal(isCatalogPortrait('Assistimos cooperativas com editais e uma rede de confiança.'), false);
});

test('polaris prompt is a permanent consultant anchored on baseline maturity', () => {
  const prompt = polarisSystemPrompt('pt');
  assert.match(prompt, /consultor permanente/i);
  assert.match(prompt, /LINHA BASE/i);
  assert.match(prompt, /maturidade/i);
  assert.match(prompt, /Etholys/);
  assert.match(prompt, /Propor uma forma de avançar/);
  const parsed = parsePolarisModelJson('```json\n{"reply":"ok","ready":false}\n```');
  assert.equal((parsed as { reply: string }).reply, 'ok');
});
