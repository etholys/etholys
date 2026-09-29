import { AsyncLocalStorage } from 'async_hooks';

/** Preços Anthropic aproximados (USD). Actualizar quando a tabela oficial mudar. */
export type LlmPriceRow = {
  inputPerMTok: number;
  outputPerMTok: number;
  cacheReadPerMTok?: number;
  webSearchPer1k?: number;
};

const DEFAULT_WEB_SEARCH_PER_1K = 10;

/** Modelos usados no FundHub / plataforma. Fallback conservador = Sonnet. */
export const LLM_PRICE_TABLE: Record<string, LlmPriceRow> = {
  'claude-sonnet-4-6': { inputPerMTok: 3, outputPerMTok: 15, cacheReadPerMTok: 0.3, webSearchPer1k: 10 },
  'claude-sonnet-4-5': { inputPerMTok: 3, outputPerMTok: 15, cacheReadPerMTok: 0.3, webSearchPer1k: 10 },
  'claude-opus-4-6': { inputPerMTok: 15, outputPerMTok: 75, cacheReadPerMTok: 1.5, webSearchPer1k: 10 },
  'claude-opus-4-5': { inputPerMTok: 15, outputPerMTok: 75, cacheReadPerMTok: 1.5, webSearchPer1k: 10 },
  'claude-fable-5-1': { inputPerMTok: 10, outputPerMTok: 50, cacheReadPerMTok: 1, webSearchPer1k: 10 },
  'claude-haiku-4-5': { inputPerMTok: 1, outputPerMTok: 5, cacheReadPerMTok: 0.1, webSearchPer1k: 10 },
};

export type LlmUsageSnapshot = {
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
  webSearchRequests: number;
  estimatedCostUsd: number;
};

export type LlmUsageTotals = {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
  webSearchRequests: number;
  llmCalls: number;
  estimatedCostUsd: number;
  models: string[];
  calls: LlmUsageSnapshot[];
};

function priceForModel(model: string): LlmPriceRow {
  const key = model.trim().toLowerCase();
  if (LLM_PRICE_TABLE[key]) return LLM_PRICE_TABLE[key];
  for (const [name, row] of Object.entries(LLM_PRICE_TABLE)) {
    if (key.includes(name) || name.includes(key)) return row;
  }
  return LLM_PRICE_TABLE['claude-sonnet-4-6'];
}

export function estimateLlmCostUsd(input: {
  model: string;
  inputTokens?: number;
  outputTokens?: number;
  cacheReadTokens?: number;
  cacheCreationTokens?: number;
  webSearchRequests?: number;
}): number {
  const price = priceForModel(input.model);
  const inputTok = Math.max(0, input.inputTokens ?? 0);
  const outputTok = Math.max(0, input.outputTokens ?? 0);
  const cacheRead = Math.max(0, input.cacheReadTokens ?? 0);
  const cacheCreate = Math.max(0, input.cacheCreationTokens ?? 0);
  const web = Math.max(0, input.webSearchRequests ?? 0);

  const tokenCost =
    (inputTok / 1_000_000) * price.inputPerMTok +
    (outputTok / 1_000_000) * price.outputPerMTok +
    (cacheRead / 1_000_000) * (price.cacheReadPerMTok ?? price.inputPerMTok * 0.1) +
    (cacheCreate / 1_000_000) * price.inputPerMTok;

  const webCost = (web / 1000) * (price.webSearchPer1k ?? DEFAULT_WEB_SEARCH_PER_1K);
  return Math.round((tokenCost + webCost) * 1_000_000) / 1_000_000;
}

export function emptyLlmUsageTotals(): LlmUsageTotals {
  return {
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheCreationTokens: 0,
    webSearchRequests: 0,
    llmCalls: 0,
    estimatedCostUsd: 0,
    models: [],
    calls: [],
  };
}

export function accumulateLlmUsage(into: LlmUsageTotals, call: LlmUsageSnapshot): void {
  into.inputTokens += call.inputTokens;
  into.outputTokens += call.outputTokens;
  into.cacheReadTokens += call.cacheReadTokens;
  into.cacheCreationTokens += call.cacheCreationTokens;
  into.webSearchRequests += call.webSearchRequests;
  into.llmCalls += 1;
  into.estimatedCostUsd =
    Math.round((into.estimatedCostUsd + call.estimatedCostUsd) * 1_000_000) / 1_000_000;
  if (call.model && !into.models.includes(call.model)) into.models.push(call.model);
  into.calls.push(call);
}

type AnthropicUsageLike = {
  input_tokens?: number;
  output_tokens?: number;
  cache_read_input_tokens?: number;
  cache_creation_input_tokens?: number;
  server_tool_use?: { web_search_requests?: number };
};

export function usageFromAnthropicResponse(
  model: string,
  usage: AnthropicUsageLike | undefined,
  searchQueryCount = 0,
): LlmUsageSnapshot {
  const inputTokens = Math.max(0, usage?.input_tokens ?? 0);
  const outputTokens = Math.max(0, usage?.output_tokens ?? 0);
  const cacheReadTokens = Math.max(0, usage?.cache_read_input_tokens ?? 0);
  const cacheCreationTokens = Math.max(0, usage?.cache_creation_input_tokens ?? 0);
  const fromUsage = Math.max(0, usage?.server_tool_use?.web_search_requests ?? 0);
  const webSearchRequests = fromUsage > 0 ? fromUsage : Math.max(0, searchQueryCount);

  const estimatedCostUsd = estimateLlmCostUsd({
    model,
    inputTokens,
    outputTokens,
    cacheReadTokens,
    cacheCreationTokens,
    webSearchRequests,
  });

  return {
    model,
    inputTokens,
    outputTokens,
    cacheReadTokens,
    cacheCreationTokens,
    webSearchRequests,
    estimatedCostUsd,
  };
}

const llmUsageAls = new AsyncLocalStorage<LlmUsageTotals>();

/** Durante um scan (ou outro job), acumula usage de todas as chamadas LLM. */
export function withLlmUsageTracking<T>(fn: () => Promise<T>): Promise<{ result: T; usage: LlmUsageTotals }> {
  const totals = emptyLlmUsageTotals();
  return llmUsageAls.run(totals, async () => {
    const result = await fn();
    return { result, usage: totals };
  });
}

export function recordLlmUsage(call: LlmUsageSnapshot): void {
  const store = llmUsageAls.getStore();
  if (store) accumulateLlmUsage(store, call);
}

export function getActiveLlmUsage(): LlmUsageTotals | null {
  return llmUsageAls.getStore() ?? null;
}

/** Serializável para FundhubDiscoveryRun.errorsJson.aiCost */
export function llmUsageForPersistence(usage: LlmUsageTotals): Record<string, unknown> {
  return {
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    cacheReadTokens: usage.cacheReadTokens,
    cacheCreationTokens: usage.cacheCreationTokens,
    webSearchRequests: usage.webSearchRequests,
    llmCalls: usage.llmCalls,
    estimatedCostUsd: usage.estimatedCostUsd,
    models: usage.models,
    /** Detalhe por chamada — útil para debug; limitar tamanho. */
    calls: usage.calls.slice(0, 40).map((c) => ({
      model: c.model,
      inputTokens: c.inputTokens,
      outputTokens: c.outputTokens,
      webSearchRequests: c.webSearchRequests,
      estimatedCostUsd: c.estimatedCostUsd,
    })),
  };
}

export function parseAiCostFromErrorsJson(
  errorsJson: string | null | undefined,
): LlmUsageTotals | null {
  if (!errorsJson?.trim()) return null;
  try {
    const parsed = JSON.parse(errorsJson) as { aiCost?: Partial<LlmUsageTotals> };
    const c = parsed.aiCost;
    if (!c || typeof c.estimatedCostUsd !== 'number') return null;
    return {
      inputTokens: Number(c.inputTokens) || 0,
      outputTokens: Number(c.outputTokens) || 0,
      cacheReadTokens: Number(c.cacheReadTokens) || 0,
      cacheCreationTokens: Number(c.cacheCreationTokens) || 0,
      webSearchRequests: Number(c.webSearchRequests) || 0,
      llmCalls: Number(c.llmCalls) || 0,
      estimatedCostUsd: Number(c.estimatedCostUsd) || 0,
      models: Array.isArray(c.models) ? c.models.map(String) : [],
      calls: Array.isArray(c.calls) ? (c.calls as LlmUsageSnapshot[]) : [],
    };
  } catch {
    return null;
  }
}
