import 'server-only';

import { prisma } from '@/lib/prisma';
import { readOpportunityBriefing } from '@/lib/opportunity/briefing';
import { readCompanyScanInbox, writeScanResults } from '@/lib/opportunity/candidate-store';
import { buildLearningContext } from '@/lib/opportunity/scan-context';
import { fetchSourceSnippets, snippetsToPromptBlock } from '@/lib/opportunity/fetch-sources';
import { listEtholysCatalogHints, listUserMonitoredUrls } from '@/lib/opportunity/source-catalog';
import { discoverOpportunitiesOnline } from '@/lib/opportunity/web-discovery';
import { applyBriefingDiversity } from '@/lib/opportunity/discovery-queries';
import { dropDuplicateFunds } from '@/lib/opportunity/scan-filters';
import {
  emptyLlmUsageTotals,
  llmUsageForPersistence,
  withLlmUsageTracking,
  type LlmUsageTotals,
} from '@/lib/llm-usage';
import type { OpportunityBriefing, ScanCandidate, ScanFocus } from '@/lib/opportunity/scan-types';

function uniqueNameInstitution(
  items: Array<{ name: string; institution?: string }>,
): Array<{ name: string; institution: string }> {
  const seen = new Set<string>();
  const out: Array<{ name: string; institution: string }> = [];
  for (const item of items) {
    const name = item.name?.trim();
    if (!name) continue;
    const institution = (item.institution || '').trim();
    const key = `${name.toLowerCase()}|${institution.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ name, institution });
  }
  return out;
}

async function setScanProgress(runId: string, progressPct: number, phase: string) {
  const pct = Math.max(0, Math.min(99, Math.round(progressPct)));
  await prisma.fundhubDiscoveryRun
    .update({
      where: { id: runId },
      data: {
        scanned: Math.max(1, Math.floor(pct / 10)),
        errorsJson: JSON.stringify({ progressPct: pct, phase }),
      },
    })
    .catch(() => {});
}

function costColumns(usage: LlmUsageTotals) {
  return {
    estimatedCostUsd: usage.estimatedCostUsd,
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    webSearchRequests: usage.webSearchRequests,
    llmCalls: usage.llmCalls,
  };
}

export async function runOpportunityScan(opts: {
  companyId: string;
  userId: string;
  briefing?: OpportunityBriefing;
  scanFocus?: ScanFocus;
  /** Se já criado pelo POST async. */
  existingRunId?: string;
}): Promise<{
  runId: string;
  candidates: ScanCandidate[];
  scanned: number;
  created: number;
  discoveryMode: 'web' | 'knowledge';
  searchQueries: string[];
  scanFocus: ScanFocus;
  aiCost: LlmUsageTotals;
}> {
  const scanFocus = opts.scanFocus ?? 'open_now';
  const started = Date.now();
  const briefing = opts.briefing ?? (await readOpportunityBriefing(opts.companyId));

  const [existingFunds, learningContext, optionalUrls, catalogHints, inbox] = await Promise.all([
    prisma.fund.findMany({
      where: { companyId: opts.companyId, isActive: true },
      select: { name: true, institution: true },
      take: 80,
    }),
    buildLearningContext(opts.companyId),
    listUserMonitoredUrls(opts.companyId),
    listEtholysCatalogHints(),
    readCompanyScanInbox(opts.companyId),
  ]);

  const existingSet = new Set(
    existingFunds.map((f) => `${f.name.toLowerCase()}|${f.institution.toLowerCase()}`),
  );

  const run =
    opts.existingRunId
      ? await prisma.fundhubDiscoveryRun.findUniqueOrThrow({ where: { id: opts.existingRunId } })
      : await prisma.fundhubDiscoveryRun.create({
          data: {
            companyId: opts.companyId,
            initiatedByUserId: opts.userId,
            source: scanFocus === 'open_now' ? 'opportunity_open_now' : 'opportunity_reference',
            status: 'running',
          },
        });

  let usage: LlmUsageTotals = emptyLlmUsageTotals();

  try {
    const extraUrls = optionalUrls;

    let optionalExtraContext = '';
    if (catalogHints.length > 0) {
      optionalExtraContext = catalogHints
        .map((h) => `- ${h.name}: ${h.url}${h.tags ? ` (${h.tags})` : ''}`)
        .join('\n');
    }
    if (extraUrls.length > 0) {
      try {
        await setScanProgress(run.id, 12, 'fetching_portals');
        const { snippets } = await fetchSourceSnippets(extraUrls);
        const block = snippetsToPromptBlock(snippets);
        optionalExtraContext = [optionalExtraContext, block].filter(Boolean).join('\n');
      } catch {
        // portais opcionais — ignorar falhas
      }
    }

    const alreadyInInbox = [...inbox.pending, ...inbox.later];
    const deskSkip = uniqueNameInstitution([
      ...existingFunds,
      ...alreadyInInbox.map((c) => ({ name: c.name, institution: c.institution })),
    ]);

    await setScanProgress(run.id, 18, 'starting_discovery');

    const tracked = await withLlmUsageTracking(() =>
      discoverOpportunitiesOnline({
        briefing,
        learningContext,
        existingFunds: deskSkip,
        optionalExtraContext: optionalExtraContext || undefined,
        scanFocus,
        onProgress: (pct, phase) => setScanProgress(run.id, pct, phase),
      }),
    );
    usage = tracked.usage;
    const discovery = tracked.result;

    let candidates = applyBriefingDiversity(
      dropDuplicateFunds(discovery.candidates, deskSkip),
      briefing,
    );
    if (candidates.length === 0) {
      candidates = applyBriefingDiversity(
        dropDuplicateFunds(discovery.candidates, existingFunds).filter(
          (c) => !existingSet.has(`${c.name.toLowerCase()}|${c.institution.toLowerCase()}`),
        ),
        briefing,
      );
      candidates = dropDuplicateFunds(candidates, alreadyInInbox);
    }

    await writeScanResults(
      opts.companyId,
      {
        runId: run.id,
        candidates: candidates.map((c) => ({ ...c, scanFocus, runId: run.id })),
        savedTempIds: [],
        discardedTempIds: [],
        laterTempIds: [],
        discoveryMode: discovery.discoveryMode,
        searchQueries: discovery.searchQueries,
        scanFocus,
        scanProfileName: briefing.scanName,
      },
      `discovery:${opts.userId}`,
    );

    const durationMs = Date.now() - started;
    const searchCount = discovery.searchQueries.length;

    await prisma.fundhubDiscoveryRun.update({
      where: { id: run.id },
      data: {
        status: 'completed',
        scanned: Math.max(1, searchCount),
        created: candidates.length,
        updated: 0,
        errorCount: 0,
        ...costColumns(usage),
        errorsJson: JSON.stringify({
          searchQueries: discovery.searchQueries,
          mode: discovery.discoveryMode,
          scanFocus,
          scanName: briefing.scanName ?? null,
          fallbackReason: discovery.fallbackReason ?? null,
          aiCost: llmUsageForPersistence(usage),
        }),
        finishedAt: new Date(),
        durationMs,
      },
    });

    return {
      runId: run.id,
      candidates,
      scanned: Math.max(1, searchCount),
      created: candidates.length,
      discoveryMode: discovery.discoveryMode,
      searchQueries: discovery.searchQueries,
      scanFocus,
      aiCost: usage,
    };
  } catch (e) {
    const durationMs = Date.now() - started;
    await prisma.fundhubDiscoveryRun
      .update({
        where: { id: run.id },
        data: {
          status: 'failed',
          errorCount: 1,
          ...costColumns(usage),
          errorsJson: JSON.stringify({
            error: e instanceof Error ? e.message : String(e),
            aiCost: llmUsageForPersistence(usage),
          }),
          finishedAt: new Date(),
          durationMs,
        },
      })
      .catch(() => {});
    throw e;
  }
}
