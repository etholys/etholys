import 'server-only';

import { prisma } from '@/lib/prisma';
import { parseAiCostFromErrorsJson } from '@/lib/llm-usage';

export type FundhubCostRunRow = {
  id: string;
  companyId: string;
  companyName: string;
  status: string;
  startedAt: string;
  finishedAt: string | null;
  durationMs: number | null;
  created: number;
  estimatedCostUsd: number;
  inputTokens: number;
  outputTokens: number;
  webSearchRequests: number;
  llmCalls: number;
  costPerCandidateUsd: number | null;
  models: string[];
};

export type FundhubCostCompanyRow = {
  companyId: string;
  companyName: string;
  runs: number;
  completed: number;
  failed: number;
  candidates: number;
  estimatedCostUsd: number;
  avgCostPerRunUsd: number;
  costPerCandidateUsd: number | null;
  inputTokens: number;
  outputTokens: number;
  webSearchRequests: number;
};

export type FundhubCostReport = {
  days: number;
  generatedAt: string;
  pricingNote: string;
  totals: {
    runs: number;
    completed: number;
    failed: number;
    candidates: number;
    estimatedCostUsd: number;
    avgCostPerRunUsd: number;
    costPerCandidateUsd: number | null;
    inputTokens: number;
    outputTokens: number;
    webSearchRequests: number;
    llmCalls: number;
  };
  byCompany: FundhubCostCompanyRow[];
  recentRuns: FundhubCostRunRow[];
};

function resolveCost(run: {
  estimatedCostUsd: number | null;
  inputTokens: number | null;
  outputTokens: number | null;
  webSearchRequests: number | null;
  llmCalls: number | null;
  errorsJson: string | null;
}): {
  estimatedCostUsd: number;
  inputTokens: number;
  outputTokens: number;
  webSearchRequests: number;
  llmCalls: number;
  models: string[];
} {
  if (typeof run.estimatedCostUsd === 'number' && run.estimatedCostUsd >= 0) {
    return {
      estimatedCostUsd: run.estimatedCostUsd,
      inputTokens: run.inputTokens ?? 0,
      outputTokens: run.outputTokens ?? 0,
      webSearchRequests: run.webSearchRequests ?? 0,
      llmCalls: run.llmCalls ?? 0,
      models: parseAiCostFromErrorsJson(run.errorsJson)?.models ?? [],
    };
  }
  const fromJson = parseAiCostFromErrorsJson(run.errorsJson);
  if (fromJson) {
    return {
      estimatedCostUsd: fromJson.estimatedCostUsd,
      inputTokens: fromJson.inputTokens,
      outputTokens: fromJson.outputTokens,
      webSearchRequests: fromJson.webSearchRequests,
      llmCalls: fromJson.llmCalls,
      models: fromJson.models,
    };
  }
  return {
    estimatedCostUsd: 0,
    inputTokens: 0,
    outputTokens: 0,
    webSearchRequests: 0,
    llmCalls: 0,
    models: [],
  };
}

export async function buildFundhubCostReport(opts: {
  days?: number;
  companyId?: string | null;
}): Promise<FundhubCostReport> {
  const days = Math.min(90, Math.max(1, opts.days ?? 30));
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const runs = await prisma.fundhubDiscoveryRun.findMany({
    where: {
      startedAt: { gte: since },
      ...(opts.companyId ? { companyId: opts.companyId } : {}),
    },
    orderBy: { startedAt: 'desc' },
    take: 500,
    select: {
      id: true,
      companyId: true,
      status: true,
      startedAt: true,
      finishedAt: true,
      durationMs: true,
      created: true,
      estimatedCostUsd: true,
      inputTokens: true,
      outputTokens: true,
      webSearchRequests: true,
      llmCalls: true,
      errorsJson: true,
      company: { select: { name: true } },
    },
  });

  const byCompanyMap = new Map<string, FundhubCostCompanyRow>();
  let totalCost = 0;
  let totalCandidates = 0;
  let totalInput = 0;
  let totalOutput = 0;
  let totalWeb = 0;
  let totalLlm = 0;
  let completed = 0;
  let failed = 0;

  const recentRuns: FundhubCostRunRow[] = [];

  for (const run of runs) {
    const cost = resolveCost(run);
    totalCost += cost.estimatedCostUsd;
    totalCandidates += run.created;
    totalInput += cost.inputTokens;
    totalOutput += cost.outputTokens;
    totalWeb += cost.webSearchRequests;
    totalLlm += cost.llmCalls;
    if (run.status === 'completed') completed += 1;
    if (run.status === 'failed') failed += 1;

    const companyName = run.company?.name || run.companyId;
    let row = byCompanyMap.get(run.companyId);
    if (!row) {
      row = {
        companyId: run.companyId,
        companyName,
        runs: 0,
        completed: 0,
        failed: 0,
        candidates: 0,
        estimatedCostUsd: 0,
        avgCostPerRunUsd: 0,
        costPerCandidateUsd: null,
        inputTokens: 0,
        outputTokens: 0,
        webSearchRequests: 0,
      };
      byCompanyMap.set(run.companyId, row);
    }
    row.runs += 1;
    if (run.status === 'completed') row.completed += 1;
    if (run.status === 'failed') row.failed += 1;
    row.candidates += run.created;
    row.estimatedCostUsd =
      Math.round((row.estimatedCostUsd + cost.estimatedCostUsd) * 1_000_000) / 1_000_000;
    row.inputTokens += cost.inputTokens;
    row.outputTokens += cost.outputTokens;
    row.webSearchRequests += cost.webSearchRequests;

    if (recentRuns.length < 40) {
      recentRuns.push({
        id: run.id,
        companyId: run.companyId,
        companyName,
        status: run.status,
        startedAt: run.startedAt.toISOString(),
        finishedAt: run.finishedAt?.toISOString() ?? null,
        durationMs: run.durationMs,
        created: run.created,
        estimatedCostUsd: cost.estimatedCostUsd,
        inputTokens: cost.inputTokens,
        outputTokens: cost.outputTokens,
        webSearchRequests: cost.webSearchRequests,
        llmCalls: cost.llmCalls,
        costPerCandidateUsd:
          run.created > 0
            ? Math.round((cost.estimatedCostUsd / run.created) * 1_000_000) / 1_000_000
            : null,
        models: cost.models,
      });
    }
  }

  const byCompany = [...byCompanyMap.values()]
    .map((r) => ({
      ...r,
      avgCostPerRunUsd:
        r.runs > 0 ? Math.round((r.estimatedCostUsd / r.runs) * 1_000_000) / 1_000_000 : 0,
      costPerCandidateUsd:
        r.candidates > 0
          ? Math.round((r.estimatedCostUsd / r.candidates) * 1_000_000) / 1_000_000
          : null,
    }))
    .sort((a, b) => b.estimatedCostUsd - a.estimatedCostUsd);

  const runCount = runs.length;
  totalCost = Math.round(totalCost * 1_000_000) / 1_000_000;

  return {
    days,
    generatedAt: new Date().toISOString(),
    pricingNote:
      'Estimativa com tabela Anthropic (Sonnet $3/$15 MTok, web_search ~$10/1k). Não inclui margem Etholys nem faturação ao cliente.',
    totals: {
      runs: runCount,
      completed,
      failed,
      candidates: totalCandidates,
      estimatedCostUsd: totalCost,
      avgCostPerRunUsd:
        runCount > 0 ? Math.round((totalCost / runCount) * 1_000_000) / 1_000_000 : 0,
      costPerCandidateUsd:
        totalCandidates > 0
          ? Math.round((totalCost / totalCandidates) * 1_000_000) / 1_000_000
          : null,
      inputTokens: totalInput,
      outputTokens: totalOutput,
      webSearchRequests: totalWeb,
      llmCalls: totalLlm,
    },
    byCompany,
    recentRuns,
  };
}
