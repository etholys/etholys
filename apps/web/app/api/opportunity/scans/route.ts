export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { readOpportunityBriefing } from '@/lib/opportunity/briefing';
import { pendingCandidates, readScanResults } from '@/lib/opportunity/candidate-store';
import { resolveOpportunityCompanyId } from '@/lib/opportunity/resolve-company';
import { runOpportunityScan } from '@/lib/opportunity/run-scan';
import type { OpportunityBriefing, ScanFocus } from '@/lib/opportunity/scan-types';

export async function GET(req: NextRequest) {
  const ctx = await resolveOpportunityCompanyId(req.nextUrl.searchParams.get('companyId'));
  if (!ctx) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const [latest, recentRuns] = await Promise.all([
    prisma.fundhubDiscoveryRun.findFirst({
      where: { companyId: ctx.companyId },
      orderBy: { startedAt: 'desc' },
    }),
    prisma.fundhubDiscoveryRun.findMany({
      where: { companyId: ctx.companyId },
      orderBy: { startedAt: 'desc' },
      take: 8,
      select: {
        id: true,
        status: true,
        startedAt: true,
        finishedAt: true,
        scanned: true,
        created: true,
        errorCount: true,
      },
    }),
  ]);

  if (!latest) {
    return NextResponse.json({
      companyId: ctx.companyId,
      latest: null,
      pending: [],
      recentRuns,
    });
  }

  const results = await readScanResults(ctx.companyId, latest.id);
  const pendingAll = pendingCandidates(results);
  return NextResponse.json({
    companyId: ctx.companyId,
    latest: {
      id: latest.id,
      status: latest.status,
      startedAt: latest.startedAt,
      finishedAt: latest.finishedAt,
      scanned: latest.scanned,
      created: latest.created,
      errorCount: latest.errorCount,
      discoveryMode: results.discoveryMode ?? null,
      searchQueries: results.searchQueries ?? [],
      scanFocus: results.scanFocus ?? null,
    },
    pending: pendingAll,
    pendingOpen: pendingCandidates(results, 'open_now'),
    pendingReference: pendingCandidates(results, 'reference'),
    later: results.candidates.filter((c) => results.laterTempIds.includes(c.tempId)),
    recentRuns,
  });
}

export async function POST(req: NextRequest) {
  const ctx = await resolveOpportunityCompanyId(req.nextUrl.searchParams.get('companyId'));
  if (!ctx) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const running = await prisma.fundhubDiscoveryRun.findFirst({
    where: { companyId: ctx.companyId, status: 'running' },
  });
  if (running) {
    return NextResponse.json({ error: 'Já existe uma varredura em curso', runId: running.id }, { status: 409 });
  }

  let briefing: OpportunityBriefing | undefined;
  let scanFocus: ScanFocus = 'open_now';
  try {
    const body = await req.json();
    if (body?.briefing) briefing = body.briefing as OpportunityBriefing;
    if (body?.scanFocus === 'reference' || body?.scanFocus === 'open_now') {
      scanFocus = body.scanFocus;
    }
  } catch {
    // body opcional
  }

  if (!briefing) {
    briefing = await readOpportunityBriefing(ctx.companyId);
  } else {
    const { writeOpportunityBriefing } = await import('@/lib/opportunity/briefing');
    await writeOpportunityBriefing(ctx.companyId, briefing);
  }

  try {
    const result = await runOpportunityScan({
      companyId: ctx.companyId,
      userId: ctx.userId,
      briefing,
      scanFocus,
    });
    return NextResponse.json({
      companyId: ctx.companyId,
      runId: result.runId,
      scanned: result.scanned,
      created: result.created,
      candidates: result.candidates,
      discoveryMode: result.discoveryMode,
      searchQueries: result.searchQueries,
      scanFocus: result.scanFocus,
    });
  } catch (e) {
    console.error('[POST /api/opportunity/scans]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Falha na varredura' },
      { status: 500 },
    );
  }
}
