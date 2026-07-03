export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserCompanyIds } from '@/lib/tenant';
import { isLikelyDbId } from '@/lib/utils';

/** KPIs reais do FundHub — só leitura. */
export async function GET(req: NextRequest) {
  const tenant = await getUserCompanyIds();
  if (!tenant) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const requested = req.nextUrl.searchParams.get('companyId')?.trim() ?? '';
  const companyId =
    isLikelyDbId(requested) && tenant.companyIds.includes(requested)
      ? requested
      : tenant.companyIds[0] ?? '';

  if (!companyId) {
    return NextResponse.json({ error: 'Empresa inválida' }, { status: 400 });
  }

  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const in14Days = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

  const [
    newFundsWeek,
    deadlinesSoon,
    draftProposals,
    complianceInProgress,
    savedFunds,
    coalitionSize,
  ] = await Promise.all([
    prisma.fund.count({ where: { companyId, createdAt: { gte: weekAgo }, isActive: true } }),
    prisma.fund.count({
      where: {
        companyId,
        isActive: true,
        deadline: { gte: now, lte: in14Days },
        status: 'open',
      },
    }),
    prisma.proposal.count({ where: { companyId, deletedAt: null, status: 'draft' } }),
    prisma.fundhubComplianceChecklist.count({ where: { companyId } }),
    prisma.fund.count({
      where: { companyId, userStatus: { some: { status: 'saved' } } },
    }),
    prisma.aiCompanyMemory
      .findFirst({
        where: { companyId, category: 'fundhub_coalition', key: 'members_v1' },
        select: { value: true },
      })
      .then((row) => {
        if (!row?.value) return 0;
        try {
          const d = JSON.parse(row.value) as { members?: unknown[] };
          return Array.isArray(d.members) ? d.members.length : 0;
        } catch {
          return 0;
        }
      }),
  ]);

  return NextResponse.json({
    companyId,
    stats: {
      newFundsWeek,
      deadlinesSoon,
      draftProposals,
      complianceInProgress,
      savedFunds,
      coalitionMembers: coalitionSize,
    },
  });
}
