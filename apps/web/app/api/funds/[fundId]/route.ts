import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth-options';

interface SessionUser {
  id: string;
  companyId?: string;
}

export async function GET(
  request: NextRequest,
  { params }: { params: { fundId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = session.user as SessionUser;
    const fund = await (prisma as any).fund.findFirst({
      where: {
        id: params.fundId,
        companyId: (user as any).companyId || user.id,
      },
      include: {
        userStatus: true,
        conversationThreads: true,
      },
    });

    if (!fund) {
      return NextResponse.json({ error: 'Fund not found' }, { status: 404 });
    }

    return NextResponse.json({ fund });
  } catch (error) {
    console.error('[GET /api/funds/[fundId]]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { fundId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = session.user as SessionUser;
    const body = await request.json();

    const fund = await (prisma as any).fund.updateMany({
      where: {
        id: params.fundId,
        companyId: (user as any).companyId || user.id,
      },
      data: body,
    });

    return NextResponse.json(fund);
  } catch (error) {
    console.error('[PUT /api/funds/[fundId]]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
