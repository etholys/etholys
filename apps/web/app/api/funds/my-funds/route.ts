import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth-options';

interface SessionUser {
  id: string;
  companyId?: string;
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = session.user as SessionUser;
    const userId = user.id;
    const page = parseInt(request.nextUrl.searchParams.get('page') || '1');
    const limit = 20;

    // Get user's saved funds
    const savedFundStatuses = await (prisma as any).userFundStatus.findMany({
      where: {
        userId,
        status: 'saved',
      },
      select: { fundId: true },
    });

    const fundIds = savedFundStatuses.map((s: any) => s.fundId);

    const [funds, total] = await Promise.all([
      (prisma as any).fund.findMany({
        where: {
          id: { in: fundIds },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { deadline: 'asc' },
      }),
      (prisma as any).fund.count({
        where: {
          id: { in: fundIds },
        },
      }),
    ]);

    return NextResponse.json({
      funds,
      pagination: {
        total,
        pages: Math.ceil(total / limit),
        current: page,
        pageSize: limit,
      },
    });
  } catch (error) {
    console.error('[GET /api/funds/my-funds]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
