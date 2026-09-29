import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  accumulateLlmUsage,
  emptyLlmUsageTotals,
  estimateLlmCostUsd,
  llmUsageForPersistence,
  parseAiCostFromErrorsJson,
  usageFromAnthropicResponse,
} from '../../lib/llm-usage';

describe('llm-usage', () => {
  it('estimates Sonnet token + web_search cost', () => {
    const usd = estimateLlmCostUsd({
      model: 'claude-sonnet-4-6',
      inputTokens: 100_000,
      outputTokens: 20_000,
      webSearchRequests: 10,
    });
    // 0.1M * $3 + 0.02M * $15 + 10/1000 * $10 = 0.70
    assert.ok(Math.abs(usd - 0.7) < 1e-6);
  });

  it('parses Anthropic usage including web_search_requests', () => {
    const snap = usageFromAnthropicResponse(
      'claude-sonnet-4-6',
      {
        input_tokens: 1000,
        output_tokens: 500,
        server_tool_use: { web_search_requests: 3 },
      },
      0,
    );
    assert.equal(snap.webSearchRequests, 3);
    assert.ok(snap.estimatedCostUsd > 0);
  });

  it('falls back to search query count when server_tool_use missing', () => {
    const snap = usageFromAnthropicResponse(
      'claude-sonnet-4-6',
      { input_tokens: 10, output_tokens: 5 },
      4,
    );
    assert.equal(snap.webSearchRequests, 4);
  });

  it('round-trips persistence via errorsJson.aiCost', () => {
    const totals = emptyLlmUsageTotals();
    accumulateLlmUsage(
      totals,
      usageFromAnthropicResponse('claude-sonnet-4-6', {
        input_tokens: 2000,
        output_tokens: 800,
        server_tool_use: { web_search_requests: 2 },
      }),
    );
    const json = JSON.stringify({ aiCost: llmUsageForPersistence(totals) });
    const parsed = parseAiCostFromErrorsJson(json);
    assert.equal(parsed?.llmCalls, 1);
    assert.equal(parsed?.webSearchRequests, 2);
    assert.equal(parsed?.estimatedCostUsd, totals.estimatedCostUsd);
  });
});
