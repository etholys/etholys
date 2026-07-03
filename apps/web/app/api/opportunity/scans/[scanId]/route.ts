export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { pendingCandidates, readScanResults } from '@/lib/opportunity/candidate-store';
import { resolveOpportunityCompanyId } from '@/lib/opportunity/resolve-company';

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ scanId: string }> },
) {
  const tenant = await resolveOpportunityCompanyId(req.nextUrl.searchParams.get('companyId'));
  if (!tenant) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const { scanId } = await ctx.params;
  const run = await prisma.fundhubDiscoveryRun.findFirst({
    where: { id: scanId, companyId: tenant.companyId },
  });
  if (!run) return NextResponse.json({ error: 'Varredura não encontrada' }, { status: 404 });

  const results = await readScanResults(tenant.companyId, run.id);
  return NextResponse.json({
    run: {
      id: run.id,
      status: run.status,
      startedAt: run.startedAt,
      finishedAt: run.finishedAt,
      scanned: run.scanned,
      created: run.created,
      updated: run.updated,
      errorCount: run.errorCount,
      durationMs: run.durationMs,
    },
    pending: pendingCandidates(results),
    saved: results.candidates.filter((c) => results.savedTempIds.includes(c.tempId)),
    discarded: results.candidates.filter((c) => results.discardedTempIds.includes(c.tempId)),
    later: results.candidates.filter((c) => results.laterTempIds.includes(c.tempId)),
  });
}
