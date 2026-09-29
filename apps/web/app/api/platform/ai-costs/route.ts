export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { isSystemAdmin } from '@/lib/platform-access';
import { buildFundhubCostReport } from '@/lib/opportunity/fundhub-cost-report';
import { isLikelyDbId } from '@/lib/utils';

/**
 * GET /api/platform/ai-costs?days=30&companyId=
 * Só system admin Etholys — rentabilidade FundHub / custo Anthropic.
 */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email || !isSystemAdmin(session.user.email)) {
    return NextResponse.json({ error: 'Solo system admin Etholys' }, { status: 403 });
  }

  const daysRaw = Number(req.nextUrl.searchParams.get('days') ?? '30');
  const days = Number.isFinite(daysRaw) ? daysRaw : 30;
  const companyId = (req.nextUrl.searchParams.get('companyId') ?? '').trim() || null;
  if (companyId && !isLikelyDbId(companyId)) {
    return NextResponse.json({ error: 'companyId inválido' }, { status: 400 });
  }

  const report = await buildFundhubCostReport({ days, companyId });
  return NextResponse.json(report);
}
