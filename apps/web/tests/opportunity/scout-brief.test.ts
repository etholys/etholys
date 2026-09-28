import test from 'node:test';
import assert from 'node:assert/strict';
import { formatOpportunityScoutBrief } from '../../lib/opportunity/scout-brief';

test('Rural Commerce notes score fit and do not veto the hunt', () => {
  const text = formatOpportunityScoutBrief({
    themes: ['desenvolvimento rural', 'economia verde'],
    countries: ['Brasil', 'Uruguay', 'América Latina'],
    kinds: ['grant', 'credit', 'alliance', 'local_expert'],
    notes:
      'La evaluación debe considerar compatibilidad con MiPymes rurales, bioeconomía y cooperativismo.',
  });
  assert.match(text, /Temas: desenvolvimento rural/);
  assert.match(text, /CRITÉRIOS DE PRIORIDADE/);
  assert.match(text, /NÃO excluir/);
  assert.match(text, /not a veto/i);
  assert.equal(/Notas:\nLa evaluación/.test(text), false);
});
