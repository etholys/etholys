import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeInstrumentType } from '../../lib/opportunity/instrument-type';

test('verbose invented chips collapse to Grant / Crédito / Aliança / Técnico', () => {
  assert.equal(
    normalizeInstrumentType('Grant não-reembolsável (matching grant — co-investimento obrigatório)'),
    'Grant',
  );
  assert.equal(
    normalizeInstrumentType('Grant não-reembolsável (através de parceiros implementadores)'),
    'Grant',
  );
  assert.equal(
    normalizeInstrumentType('Suporte técnico não-reembolsável + acesso a financiamento reembolsável'),
    'Técnico',
  );
  assert.equal(
    normalizeInstrumentType('Financiamento (empréstimos + grants para capacitação técnica não-reembolsável)'),
    'Crédito',
  );
  assert.equal(normalizeInstrumentType('Crédito concessional'), 'Crédito');
  assert.equal(normalizeInstrumentType('Aliança estratégico-operacional'), 'Aliança');
  assert.equal(normalizeInstrumentType('Grant'), 'Grant');
});
