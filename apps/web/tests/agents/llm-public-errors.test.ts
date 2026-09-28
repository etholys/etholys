import test from 'node:test';
import assert from 'node:assert/strict';
import {
  LlmProviderError,
  PUBLIC_LLM_UNAVAILABLE,
  isLlmBillingError,
  publicLlmErrorMessage,
  usesAdaptiveThinking,
} from '../../lib/llm-client';

test('billing error never exposes Anthropic or credits to clients', () => {
  const err = new LlmProviderError('billing', {
    providerDetail:
      'Your credit balance is too low to access the Anthropic API. Please go to Plans & Billing to upgrade or purchase credits.',
  });
  assert.equal(err.message, PUBLIC_LLM_UNAVAILABLE);
  assert.ok(!/Anthropic|credit|console\.anthropic|LLM_BILLING/i.test(err.message));
  assert.equal(isLlmBillingError(err), true);
  assert.equal(publicLlmErrorMessage(err), PUBLIC_LLM_UNAVAILABLE);
});

test('legacy LLM_BILLING strings are sanitized', () => {
  const legacy = new Error(
    'LLM_BILLING: A conta da API Anthropic está sem créditos. Adicione créditos em console.anthropic.com.',
  );
  assert.equal(publicLlmErrorMessage(legacy), PUBLIC_LLM_UNAVAILABLE);
  assert.ok(!/Anthropic|créditos|console\.anthropic/i.test(publicLlmErrorMessage(legacy)));
});

test('raw provider dumps are sanitized', () => {
  const raw = new Error('LLM (claude-sonnet-4-6): {"type":"error","error":{"type":"authentication_error"}}');
  assert.equal(publicLlmErrorMessage(raw), PUBLIC_LLM_UNAVAILABLE);
});

test('Fable 5.1 uses adaptive thinking so temperature must be omitted', () => {
  assert.equal(usesAdaptiveThinking('claude-fable-5-1'), true);
  assert.equal(usesAdaptiveThinking('claude-sonnet-4-6'), false);
});

test('product truncation messages stay intact', () => {
  const msg = 'A IA cortou a resposta. Tente um documento mais curto, ou divida o ficheiro em partes menores.';
  assert.equal(publicLlmErrorMessage(new Error(msg)), msg);
});
