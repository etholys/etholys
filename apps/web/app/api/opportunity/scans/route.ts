export const dynamic = 'force-dynamic';
export const maxDuration = 300;

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { readOpportunityBriefing, writeOpportunityBriefing } from '@/lib/opportunity/briefing';
import { pendingCandidates, readScanResults } from '@/lib/opportunity/candidate-store';
import { resolveOpportunityCompanyId } from '@/lib/opportunity/resolve-company';
import { runOpportunityScan } from '@/lib/opportunity/run-scan';
import type { OpportunityBriefing, ScanFocus } from '@/lib/opportunity/scan-types';

function progressFromErrorsJson(errorsJson: string | null | undefined): {
  progressPct: number | null;
  phase: string | null;
} {
  if (!errorsJson) return { progressPct: null, phase: null };
  try {
    const o = JSON.parse(errorsJson) as { progressPct?: number; phase?: string };
    return {
      progressPct: typeof o.progressPct === 'number' ? o.progressPct : null,
      phase: typeof o.phase === 'string' ? o.phase : null,
    };
  } catch {
    return { progressPct: null, phase: null };
  }
}

export async function GET(req: NextRequest) {
  const ctx = await resolveOpportunityCompanyId(req.nextUrl.searchParams.get('companyId'));
  if (!ctx) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const runId = req.nextUrl.searchParams.get('runId')?.trim();

  if (runId) {
    const run = await prisma.fundhubDiscoveryRun.findFirst({
      where: { id: runId, companyId: ctx.companyId },
    });
    if (!run) return NextResponse.json({ error: 'Varredura não encontrada' }, { status: 404 });
    const results = await readScanResults(ctx.companyId, run.id);
    const progress = progressFromErrorsJson(run.errorsJson);
    return NextResponse.json({
      companyId: ctx.companyId,
      run: {
        id: run.id,
        status: run.status,
        startedAt: run.startedAt,
        finishedAt: run.finishedAt,
        scanned: run.scanned,
        created: run.created,
        errorCount: run.errorCount,
        errorsJson: run.errorsJson,
        progressPct: run.status === 'completed' ? 100 : progress.progressPct,
        phase: progress.phase,
        discoveryMode: results.discoveryMode ?? null,
        searchQueries: results.searchQueries ?? [],
        scanFocus: results.scanFocus ?? null,
        scanProfileName: results.scanProfileName ?? null,
      },
      pending: pendingCandidates(results),
      pendingOpen: pendingCandidates(results, 'open_now'),
      pendingReference: pendingCandidates(results, 'reference'),
      later: results.candidates.filter((c) => results.laterTempIds.includes(c.tempId)),
    });
  }

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
      pendingOpen: [],
      pendingReference: [],
      later: [],
      recentRuns,
    });
  }

  const results = await readScanResults(ctx.companyId, latest.id);
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
      scanProfileName: results.scanProfileName ?? null,
    },
    pending: pendingCandidates(results),
    pendingOpen: pendingCandidates(results, 'open_now'),
    pendingReference: pendingCandidates(results, 'reference'),
    later: results.candidates.filter((c) => results.laterTempIds.includes(c.tempId)),
    recentRuns,
  });
}

/**
 * Arranca varredura em background e devolve runId de imediato —
 * evita timeout do proxy (HTML <!DOCTYPE> em vez de JSON).
 */
export async function POST(req: NextRequest) {
  const ctx = await resolveOpportunityCompanyId(req.nextUrl.searchParams.get('companyId'));
  if (!ctx) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const running = await prisma.fundhubDiscoveryRun.findFirst({
    where: { companyId: ctx.companyId, status: 'running' },
  });
  if (running) {
    const ageMs = Date.now() - new Date(running.startedAt).getTime();
    // Varredura presa > 8 min → marcar falha e permitir nova
    if (ageMs > 8 * 60 * 1000) {
      await prisma.fundhubDiscoveryRun.update({
        where: { id: running.id },
        data: {
          status: 'failed',
          finishedAt: new Date(),
          errorsJson: JSON.stringify({ error: 'timeout_stale' }),
        },
      });
    } else {
      return NextResponse.json(
        { error: 'Já existe uma varredura em curso', runId: running.id, status: 'running' },
        { status: 409 },
      );
    }
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
    await writeOpportunityBriefing(ctx.companyId, briefing);
  }

  const run = await prisma.fundhubDiscoveryRun.create({
    data: {
      companyId: ctx.companyId,
      initiatedByUserId: ctx.userId,
      source: scanFocus === 'open_now' ? 'opportunity_open_now' : 'opportunity_reference',
      status: 'running',
      errorsJson: JSON.stringify({ progressPct: 5, phase: 'queued' }),
    },
  });

  const briefingSnapshot = briefing;
  const companyId = ctx.companyId;
  const userId = ctx.userId;

  // Não await — responde JSON imediato; cliente faz poll
  void runOpportunityScan({
    companyId,
    userId,
    briefing: briefingSnapshot,
    scanFocus,
    existingRunId: run.id,
  }).catch(async (e) => {
    console.error('[POST /api/opportunity/scans] background', e);
    await prisma.fundhubDiscoveryRun
      .update({
        where: { id: run.id },
        data: {
          status: 'failed',
          finishedAt: new Date(),
          errorCount: 1,
          errorsJson: JSON.stringify({
            error: e instanceof Error ? e.message : String(e),
          }),
        },
      })
      .catch(() => {});
  });

  return NextResponse.json({
    companyId: ctx.companyId,
    runId: run.id,
    status: 'running',
    scanFocus,
    message: 'Varredura iniciada — aguarde.',
  });
}
