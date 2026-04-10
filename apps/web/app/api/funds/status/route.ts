import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth-options';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { fundId, status, notes } = body;

    const userStatus = await (prisma as any).userFundStatus.upsert({
      where: {
        fundId_userId: {
          fundId,
          userId: session.user.id,
        },
      },
      update: { status, notes },
      create: {
        fundId,
        userId: session.user.id,
        status,
        notes,
      },
    });

    return NextResponse.json(userStatus);
  } catch (error) {
    console.error('[POST /api/funds/status]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
