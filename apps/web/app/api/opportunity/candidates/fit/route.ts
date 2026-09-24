export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { readOpportunityBriefing } from '@/lib/opportunity/briefing';
import { patchScanCandidate } from '@/lib/opportunity/candidate-store';
import { evaluateFit } from '@/lib/opportunity/fit';
import { resolveOpportunityCompanyId } from '@/lib/opportunity/resolve-company';
import type { ScanCandidate } from '@/lib/opportunity/scan-types';

export async function POST(req: NextRequest) {
  const ctx = await resolveOpportunityCompanyId(req.nextUrl.searchParams.get('companyId'));
  if (!ctx) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const body = (await req.json()) as { candidate?: ScanCandidate; runId?: string; tempId?: string };
  if (!body.candidate?.name || !body.candidate?.institution) {
    return NextResponse.json({ error: 'candidate obrigatório' }, { status: 400 });
  }

  const briefing = await readOpportunityBriefing(ctx.companyId);
  const fit = evaluateFit(body.candidate, briefing);
  const runId = body.runId || body.candidate.runId;
  const tempId = body.tempId || body.candidate.tempId;
  if (runId && tempId) {
    await patchScanCandidate(ctx.companyId, runId, tempId, { fit });
  }

  return NextResponse.json({ fit, briefing: { countries: briefing.countries, kinds: briefing.kinds } });
}
