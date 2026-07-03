export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { resolveOpportunityCompanyId } from '@/lib/opportunity/resolve-company';
import { validateScanCandidate } from '@/lib/opportunity/validate-candidate';

export async function POST(req: NextRequest) {
  const ctx = await resolveOpportunityCompanyId(req.nextUrl.searchParams.get('companyId'));
  if (!ctx) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const body = (await req.json()) as {
    runId?: string;
    tempId?: string;
    action?: 'save' | 'discard' | 'later';
  };

  if (!body.runId || !body.tempId || !body.action) {
    return NextResponse.json({ error: 'runId, tempId e action são obrigatórios' }, { status: 400 });
  }

  try {
    const result = await validateScanCandidate({
      companyId: ctx.companyId,
      userId: ctx.userId,
      runId: body.runId,
      tempId: body.tempId,
      action: body.action,
    });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Erro' },
      { status: 400 },
    );
  }
}
