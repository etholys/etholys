export const dynamic = 'force-dynamic';
export const maxDuration = 600;

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { readOpportunityBriefing, writeOpportunityBriefing } from '@/lib/opportunity/briefing';
import {
  pendingCandidates,
  readCompanyScanInbox,
  readScanResults,
  parseScanResults,
  SCAN_MEMORY_CATEGORY,
} from '@/lib/opportunity/candidate-store';
import { payloadMatchesProfile } from '@/lib/opportunity/scan-inbox';
import { readScanProfile } from '@/lib/opportunity/scan-profiles';
import { resolveOpportunityCompanyId } from '@/lib/opportunity/resolve-company';
import { runOpportunityScan } from '@/lib/opportunity/run-scan';
import { isDiscoveryRunStale } from '@/lib/opportunity/scan-run-liveness';
import type { OpportunityBriefing, ScanFocus } from '@/lib/opportunity/scan-types';
import { isSystemAdmin } from '@/lib/platform-access';

type RunCostFields = {
  estimatedCostUsd?: number | null;
  inputTokens?: number | null;
  outputTokens?: number | null;
  webSearchRequests?: number | null;
};

/** Custo IA / tokens — só system admin Etholys; clientes não recebem no JSON. */
function stripRunCostsForClient<T extends RunCostFields>(
  run: T,
  allowInternalCosts: boolean,
): T {
  if (allowInternalCosts) return run;
  const {
    estimatedCostUsd: _c,
    inputTokens: _i,
    outputTokens: _o,
    webSearchRequests: _w,
    ...rest
  } = run;
  return rest as T;
}


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

  const session = await getServerSession(authOptions);
  const allowInternalCosts = isSystemAdmin(session?.user?.email);

  const runId = req.nextUrl.searchParams.get('runId')?.trim();

  if (runId) {
    const run = await prisma.fundhubDiscoveryRun.findFirst({
      where: { id: runId, companyId: ctx.companyId },
    });
    if (!run) return NextResponse.json({ error: 'Varredura não encontrada' }, { status: 404 });
    const results = await readScanResults(ctx.companyId, run.id);
    const progress = progressFromErrorsJson(run.errorsJson);
    const stamp = <T extends { runId?: string }>(c: T) => ({ ...c, runId: run.id });
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
      pending: pendingCandidates(results).map(stamp),
      pendingOpen: pendingCandidates(results, 'open_now').map(stamp),
      pendingReference: pendingCandidates(results, 'reference').map(stamp),
      later: results.candidates.filter((c) => results.laterTempIds.includes(c.tempId)).map(stamp),
    });
  }

  const profileIdParam = req.nextUrl.searchParams.get('profileId')?.trim() || null;
  const scopeProfileId = profileIdParam && profileIdParam !== 'all' ? profileIdParam : null;
  const scopeProfile = scopeProfileId
    ? await readScanProfile(ctx.companyId, scopeProfileId)
    : null;

  const [latest, recentRunsRaw, inbox] = await Promise.all([
    prisma.fundhubDiscoveryRun.findFirst({
      where: { companyId: ctx.companyId },
      orderBy: { startedAt: 'desc' },
    }),
    prisma.fundhubDiscoveryRun.findMany({
      where: { companyId: ctx.companyId },
      orderBy: { startedAt: 'desc' },
      take: scopeProfileId ? 24 : 8,
      select: {
        id: true,
        status: true,
        startedAt: true,
        finishedAt: true,
        scanned: true,
        created: true,
        errorCount: true,
        estimatedCostUsd: true,
        inputTokens: true,
        outputTokens: true,
        webSearchRequests: true,
      },
    }),
    readCompanyScanInbox(ctx.companyId, { profileId: scopeProfileId }),
  ]);

  const recentMemory = await prisma.aiCompanyMemory.findMany({
    where: {
      companyId: ctx.companyId,
      category: SCAN_MEMORY_CATEGORY,
      key: { in: recentRunsRaw.map((r) => `run_${r.id}`) },
    },
    select: { key: true, value: true },
  });
  const memoryByKey = new Map(recentMemory.map((r) => [r.key, r.value]));

  const recentEnriched = recentRunsRaw.map((r) => {
    const payload = parseScanResults(memoryByKey.get(`run_${r.id}`), r.id);
    return {
      ...r,
      scanFocus: payload.scanFocus ?? null,
      scanProfileId: payload.scanProfileId ?? null,
      scanProfileName: payload.scanProfileName ?? null,
    };
  });

  const recentFiltered =
    scopeProfile != null
      ? recentEnriched.filter((r) =>
          payloadMatchesProfile(
            { scanProfileId: r.scanProfileId ?? undefined, scanProfileName: r.scanProfileName ?? undefined },
            scopeProfile,
          ),
        )
      : recentEnriched;

  const safeRecent = recentFiltered
    .slice(0, 8)
    .map((r) => stripRunCostsForClient(r, allowInternalCosts));

  if (!latest) {
    return NextResponse.json({
      companyId: ctx.companyId,
      profileId: scopeProfileId,
      latest: null,
      pending: [],
      pendingOpen: [],
      pendingReference: [],
      later: [],
      recentRuns: safeRecent,
    });
  }

  const results = await readScanResults(ctx.companyId, latest.id);
  const latestInScope =
    !scopeProfile ||
    payloadMatchesProfile(
      {
        scanProfileId: results.scanProfileId,
        scanProfileName: results.scanProfileName,
      },
      scopeProfile,
    );

  return NextResponse.json({
    companyId: ctx.companyId,
    profileId: scopeProfileId,
    latest: latestInScope
      ? stripRunCostsForClient(
          {
            id: latest.id,
            status: latest.status,
            startedAt: latest.startedAt,
            finishedAt: latest.finishedAt,
            scanned: latest.scanned,
            created: latest.created,
            errorCount: latest.errorCount,
            estimatedCostUsd: latest.estimatedCostUsd,
            inputTokens: latest.inputTokens,
            outputTokens: latest.outputTokens,
            webSearchRequests: latest.webSearchRequests,
            discoveryMode: results.discoveryMode ?? null,
            searchQueries: results.searchQueries ?? [],
            scanFocus: results.scanFocus ?? null,
            scanProfileId: results.scanProfileId ?? null,
            scanProfileName: results.scanProfileName ?? null,
          },
          allowInternalCosts,
        )
      : null,
    pending: inbox.pending,
    pendingOpen: inbox.pendingOpen,
    pendingReference: inbox.pendingReference,
    later: inbox.later,
    recentRuns: safeRecent,
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
    // Sem heartbeat recente a varredura morreu (processo caiu). Idade total não conta:
    // um barrido mundial segue em background bem depois dos 8 min.
    if (isDiscoveryRunStale(running)) {
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
  let locale: unknown;
  let scanProfileId: string | null = null;
  try {
    const body = await req.json();
    if (body?.briefing) briefing = body.briefing as OpportunityBriefing;
    if (body?.scanFocus === 'reference' || body?.scanFocus === 'open_now') {
      scanFocus = body.scanFocus;
    }
    if (body?.locale != null) locale = body.locale;
    if (typeof body?.scanProfileId === 'string' && body.scanProfileId.trim()) {
      scanProfileId = body.scanProfileId.trim();
    }
  } catch {
    // body opcional
  }

  if (!briefing || (!briefing.themes?.length && !briefing.countries?.length)) {
    briefing = await readOpportunityBriefing(ctx.companyId);
  } else {
    await writeOpportunityBriefing(ctx.companyId, briefing);
  }

  if (scanProfileId) {
    const profile = await readScanProfile(ctx.companyId, scanProfileId);
    if (!profile) {
      return NextResponse.json({ error: 'Perfil de busca não encontrado' }, { status: 404 });
    }
    briefing = {
      ...briefing,
      ...profile.briefing,
      scanName: profile.name,
      classifications: profile.classifications?.length
        ? profile.classifications
        : briefing.classifications,
    };
  }

  const run = await prisma.fundhubDiscoveryRun.create({
    data: {
      companyId: ctx.companyId,
      initiatedByUserId: ctx.userId,
      source: scanFocus === 'open_now' ? 'opportunity_open_now' : 'opportunity_reference',
      status: 'running',
      errorsJson: JSON.stringify({
        progressPct: 5,
        phase: 'queued',
        scanProfileId,
      }),
    },
  });

  const briefingSnapshot = briefing;
  const companyId = ctx.companyId;
  const userId = ctx.userId;
  const profileIdSnapshot = scanProfileId;

  // Não await — responde JSON imediato; cliente faz poll
  void runOpportunityScan({
    companyId,
    userId,
    briefing: briefingSnapshot,
    scanFocus,
    scanProfileId: profileIdSnapshot,
    locale,
    existingRunId: run.id,
  }).catch((e) => {
    // runOpportunityScan already persists status=failed + aiCost
    console.error('[POST /api/opportunity/scans] background', e);
  });

  return NextResponse.json({
    companyId: ctx.companyId,
    runId: run.id,
    status: 'running',
    scanFocus,
    scanProfileId: profileIdSnapshot,
    message: 'Varredura iniciada — aguarde.',
  });
}
