export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { resolveOpportunityCompanyId } from '@/lib/opportunity/resolve-company';

export async function GET(
  request: NextRequest,
  ctx: { params: Promise<{ fundId: string }> },
) {
  try {
    const tenant = await resolveOpportunityCompanyId(request.nextUrl.searchParams.get('companyId'));
    if (!tenant) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { fundId } = await ctx.params;
    const fund = await prisma.fund.findFirst({
      where: {
        id: fundId,
        companyId: tenant.companyId,
        isActive: true,
      },
      include: {
        userStatus: { where: { userId: tenant.userId } },
      },
    });

    if (!fund) {
      return NextResponse.json({ error: 'Fund not found' }, { status: 404 });
    }

    return NextResponse.json({
      fund: {
        ...fund,
        userStatus: fund.userStatus[0] ?? null,
      },
    });
  } catch (error) {
    console.error('[GET /api/funds/[fundId]]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  ctx: { params: Promise<{ fundId: string }> },
) {
  try {
    const tenant = await resolveOpportunityCompanyId(request.nextUrl.searchParams.get('companyId'));
    if (!tenant) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { fundId } = await ctx.params;
    const body = await request.json();

    const result = await prisma.fund.updateMany({
      where: {
        id: fundId,
        companyId: tenant.companyId,
      },
      data: body,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('[PUT /api/funds/[fundId]]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
