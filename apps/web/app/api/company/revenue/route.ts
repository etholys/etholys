export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { isCompanyAdmin } from '@/lib/integrated-workspace';
import { readAnnualRevenue, writeAnnualRevenue } from '@/lib/opportunity/briefing';
import { resolveOpportunityCompanyId } from '@/lib/opportunity/resolve-company';

export async function GET(req: NextRequest) {
  const ctx = await resolveOpportunityCompanyId(req.nextUrl.searchParams.get('companyId'));
  if (!ctx) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  if (!(await isCompanyAdmin(ctx.userId, ctx.companyId))) {
    return NextResponse.json({ error: 'Só a administração da empresa vê o faturamento.' }, { status: 403 });
  }
  const revenueByYear = await readAnnualRevenue(ctx.companyId);
  return NextResponse.json({ companyId: ctx.companyId, revenueByYear });
}

export async function PUT(req: NextRequest) {
  const ctx = await resolveOpportunityCompanyId(req.nextUrl.searchParams.get('companyId'));
  if (!ctx) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  if (!(await isCompanyAdmin(ctx.userId, ctx.companyId))) {
    return NextResponse.json({ error: 'Só a administração da empresa grava o faturamento.' }, { status: 403 });
  }
  const body = (await req.json().catch(() => null)) as { revenueByYear?: unknown } | null;
  const revenueByYear = await writeAnnualRevenue(ctx.companyId, body?.revenueByYear);
  return NextResponse.json({ companyId: ctx.companyId, revenueByYear });
}
