export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { readOpportunityBriefing, writeOpportunityBriefing } from '@/lib/opportunity/briefing';
import { resolveOpportunityCompanyId } from '@/lib/opportunity/resolve-company';
import type { OpportunityBriefing } from '@/lib/opportunity/scan-types';

export async function GET(req: NextRequest) {
  const ctx = await resolveOpportunityCompanyId(req.nextUrl.searchParams.get('companyId'));
  if (!ctx) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const briefing = await readOpportunityBriefing(ctx.companyId);
  return NextResponse.json({ companyId: ctx.companyId, briefing });
}

export async function PUT(req: NextRequest) {
  const ctx = await resolveOpportunityCompanyId(req.nextUrl.searchParams.get('companyId'));
  if (!ctx) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const body = (await req.json()) as { briefing?: OpportunityBriefing };
  if (!body.briefing) {
    return NextResponse.json({ error: 'briefing obrigatório' }, { status: 400 });
  }

  const briefing = await writeOpportunityBriefing(ctx.companyId, body.briefing);
  return NextResponse.json({ companyId: ctx.companyId, briefing });
}
