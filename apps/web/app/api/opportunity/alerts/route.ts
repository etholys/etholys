export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getRollingOpportunities, getUpcomingDeadlines, syncDeadlineNotifications } from '@/lib/opportunity/deadline-alerts';
import { resolveOpportunityCompanyId } from '@/lib/opportunity/resolve-company';

export async function GET(req: NextRequest) {
  const ctx = await resolveOpportunityCompanyId(req.nextUrl.searchParams.get('companyId'));
  if (!ctx) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const withinDays = Math.min(60, Math.max(1, parseInt(req.nextUrl.searchParams.get('days') || '30', 10)));
  const [deadlines, rolling] = await Promise.all([
    getUpcomingDeadlines(ctx.companyId, withinDays),
    getRollingOpportunities(ctx.companyId),
  ]);

  return NextResponse.json({
    companyId: ctx.companyId,
    deadlines,
    rolling,
    total: deadlines.length + rolling.length,
  });
}

export async function POST(req: NextRequest) {
  const ctx = await resolveOpportunityCompanyId(req.nextUrl.searchParams.get('companyId'));
  if (!ctx) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const result = await syncDeadlineNotifications(ctx.companyId, ctx.userId);
  return NextResponse.json({ companyId: ctx.companyId, ...result });
}
