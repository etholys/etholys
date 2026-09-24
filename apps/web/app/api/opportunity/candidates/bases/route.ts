export const dynamic = 'force-dynamic';
export const maxDuration = 60;

import { NextRequest, NextResponse } from 'next/server';
import { patchScanCandidate } from '@/lib/opportunity/candidate-store';
import { attachBasesText } from '@/lib/opportunity/extract-bases';
import { resolveOpportunityCompanyId } from '@/lib/opportunity/resolve-company';
import type { ScanCandidate } from '@/lib/opportunity/scan-types';

export async function POST(req: NextRequest) {
  const ctx = await resolveOpportunityCompanyId(req.nextUrl.searchParams.get('companyId'));
  if (!ctx) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const body = (await req.json()) as { candidate?: ScanCandidate; runId?: string; tempId?: string };
  if (!body.candidate?.name || !body.candidate?.institution) {
    return NextResponse.json({ error: 'candidate obrigatório' }, { status: 400 });
  }

  const next = await attachBasesText(body.candidate);
  const runId = body.runId || body.candidate.runId;
  const tempId = body.tempId || body.candidate.tempId;
  if (runId && tempId && next.basesText) {
    await patchScanCandidate(ctx.companyId, runId, tempId, { basesText: next.basesText });
  }

  return NextResponse.json({ candidate: next, basesText: next.basesText ?? '' });
}
