export const dynamic = 'force-dynamic';
export const maxDuration = 60;

import { NextRequest, NextResponse } from 'next/server';
import { patchScanCandidate } from '@/lib/opportunity/candidate-store';
import { enrichCandidateEvidence } from '@/lib/opportunity/enrich-call';
import { resolveOpportunityCompanyId } from '@/lib/opportunity/resolve-company';
import type { ScanCandidate } from '@/lib/opportunity/scan-types';

export async function POST(req: NextRequest) {
  const ctx = await resolveOpportunityCompanyId(req.nextUrl.searchParams.get('companyId'));
  if (!ctx) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const body = (await req.json()) as { candidate?: ScanCandidate; runId?: string; tempId?: string };
  if (!body.candidate?.name || !body.candidate?.institution) {
    return NextResponse.json({ error: 'candidate obrigatório' }, { status: 400 });
  }

  try {
    const enriched = await enrichCandidateEvidence(body.candidate);
    const runId = body.runId || body.candidate.runId;
    const tempId = body.tempId || body.candidate.tempId;
    if (runId && tempId) {
      await patchScanCandidate(ctx.companyId, runId, tempId, {
        callUrl: enriched.callUrl,
        institutionUrl: enriched.institutionUrl,
        linkOficial: enriched.linkOficial,
        documents: enriched.documents,
        sourceExcerpt: enriched.sourceExcerpt,
      });
    }
    return NextResponse.json({ candidate: enriched });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Falha ao enriquecer' },
      { status: 500 },
    );
  }
}
