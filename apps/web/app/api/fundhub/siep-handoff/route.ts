export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { resolveOpportunityCompanyId } from '@/lib/opportunity/resolve-company';
import { handoffFundToSiep } from '@/lib/opportunity/siep-handoff';

/** R3 — criar / reabrir ponte FundHub → projeto SIEP (pós-prémio fora do FundHub). */
export async function POST(req: NextRequest) {
  const ctx = await resolveOpportunityCompanyId(req.nextUrl.searchParams.get('companyId'));
  if (!ctx) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const body = (await req.json()) as { fundId?: string; locale?: string };
  const fundId = String(body.fundId ?? '').trim();
  if (!fundId) return NextResponse.json({ error: 'fundId obrigatório' }, { status: 400 });

  const result = await handoffFundToSiep({
    companyId: ctx.companyId,
    fundId,
    userId: ctx.userId,
    locale: body.locale,
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 404 });
  }
  return NextResponse.json(result);
}
