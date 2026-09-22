import 'server-only';

import { prisma } from '@/lib/prisma';
import { readOpportunityBriefing } from '@/lib/opportunity/briefing';
import { writeScanResults } from '@/lib/opportunity/candidate-store';
import { buildLearningContext } from '@/lib/opportunity/scan-context';
import { fetchSourceSnippets, snippetsToPromptBlock } from '@/lib/opportunity/fetch-sources';
import { listUserMonitoredUrls } from '@/lib/opportunity/source-catalog';
import { discoverOpportunitiesOnline } from '@/lib/opportunity/web-discovery';
import type { OpportunityBriefing, ScanCandidate, ScanFocus } from '@/lib/opportunity/scan-types';

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
}> {
  const scanFocus = opts.scanFocus ?? 'open_now';
  const started = Date.now();
  const briefing = opts.briefing ?? (await readOpportunityBriefing(opts.companyId));

  const [existingFunds, learningContext, optionalUrls] = await Promise.all([
    prisma.fund.findMany({
      where: { companyId: opts.companyId, isActive: true },
      select: { name: true, institution: true },
      take: 80,
    }),
    buildLearningContext(opts.companyId),
    listUserMonitoredUrls(opts.companyId),
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

  let optionalExtraContext = '';
  if (optionalUrls.length > 0) {
    try {
      await setScanProgress(run.id, 12, 'fetching_portals');
      const { snippets } = await fetchSourceSnippets(optionalUrls);
      optionalExtraContext = snippetsToPromptBlock(snippets);
    } catch {
      // portais opcionais — ignorar falhas
    }
  }

  await setScanProgress(run.id, 18, 'starting_discovery');

  const discovery = await discoverOpportunitiesOnline({
    briefing,
    learningContext,
    existingFunds,
    optionalExtraContext: optionalExtraContext || undefined,
    scanFocus,
    onProgress: (pct, phase) => setScanProgress(run.id, pct, phase),
  });

  let candidates = discovery.candidates.filter(
    (c) => !existingSet.has(`${c.name.toLowerCase()}|${c.institution.toLowerCase()}`),
  );

  if (candidates.length === 0) {
    candidates = discovery.candidates;
  }

  await writeScanResults(
    opts.companyId,
    {
      runId: run.id,
      candidates,
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
      errorsJson: JSON.stringify({
        searchQueries: discovery.searchQueries,
        mode: discovery.discoveryMode,
        scanFocus,
        scanName: briefing.scanName ?? null,
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
  };
}
