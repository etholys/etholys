export const dynamic = 'force-dynamic';
export const maxDuration = 90;

import { NextRequest, NextResponse } from 'next/server';
import { patchScanCandidate } from '@/lib/opportunity/candidate-store';
import { enrichCandidateEvidence } from '@/lib/opportunity/enrich-call';
import { relocalizeCandidateNarratives } from '@/lib/opportunity/relocalize-candidate';
import { resolveOpportunityCompanyId } from '@/lib/opportunity/resolve-company';
import type { ScanCandidate } from '@/lib/opportunity/scan-types';

export async function POST(req: NextRequest) {
  const ctx = await resolveOpportunityCompanyId(req.nextUrl.searchParams.get('companyId'));
  if (!ctx) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const body = (await req.json()) as {
    candidate?: ScanCandidate;
    runId?: string;
    tempId?: string;
    locale?: unknown;
  };
  if (!body.candidate?.name || !body.candidate?.institution) {
    return NextResponse.json({ error: 'candidate obrigatório' }, { status: 400 });
  }

  try {
    let enriched = await enrichCandidateEvidence(body.candidate);
    // Corrige narrativas de varreduras antigas no idioma errado → idioma do Hub.
    enriched = await relocalizeCandidateNarratives(enriched, body.locale);

    const runId = body.runId || body.candidate.runId;
    const tempId = body.tempId || body.candidate.tempId;
    if (runId && tempId) {
      await patchScanCandidate(ctx.companyId, runId, tempId, {
        callUrl: enriched.callUrl,
        institutionUrl: enriched.institutionUrl,
        linkOficial: enriched.linkOficial,
        documents: enriched.documents,
        sourceExcerpt: enriched.sourceExcerpt,
        basesText: enriched.basesText,
        evidence: enriched.evidence,
        description: enriched.description,
        whoCanApply: enriched.whoCanApply,
        eligibility: enriched.eligibility,
        requirements: enriched.requirements,
        howToApply: enriched.howToApply,
        risksCaveats: enriched.risksCaveats,
        availabilityNote: enriched.availabilityNote,
        matchJustification: enriched.matchJustification,
        classificationNote: enriched.classificationNote,
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
