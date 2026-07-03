import 'server-only';

import { prisma } from '@/lib/prisma';
import { readOpportunityBriefing } from '@/lib/opportunity/briefing';
import { writeScanResults } from '@/lib/opportunity/candidate-store';
import { buildLearningContext } from '@/lib/opportunity/scan-context';
import { fetchSourceSnippets, snippetsToPromptBlock } from '@/lib/opportunity/fetch-sources';
import { listUserMonitoredUrls } from '@/lib/opportunity/source-catalog';
import { discoverOpportunitiesOnline } from '@/lib/opportunity/web-discovery';
import type { OpportunityBriefing, ScanCandidate, ScanFocus } from '@/lib/opportunity/scan-types';

export async function runOpportunityScan(opts: {
  companyId: string;
  userId: string;
  briefing?: OpportunityBriefing;
  scanFocus?: ScanFocus;
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

  const run = await prisma.fundhubDiscoveryRun.create({
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
      const { snippets } = await fetchSourceSnippets(optionalUrls);
      optionalExtraContext = snippetsToPromptBlock(snippets);
    } catch {
      // portais opcionais — ignorar falhas
    }
  }

  const discovery = await discoverOpportunitiesOnline({
    briefing,
    learningContext,
    existingFunds,
    optionalExtraContext: optionalExtraContext || undefined,
    scanFocus,
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
