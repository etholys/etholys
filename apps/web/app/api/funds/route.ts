import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth-options';

interface SessionUser {
  id: string;
  companyId?: string;
  name?: string | null;
  email?: string | null;
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const user = session.user as SessionUser;
    const companyId = (user as any).companyId || user.id;
    
    // Filtros
    const search = searchParams.get('search');
    const statusFilter = searchParams.get('status');
    const countryFilter = searchParams.get('country');
    const typeFilter = searchParams.get('type');
    const categoryFilter = searchParams.get('category');
    const minAmount = searchParams.get('minAmount');
    const maxAmount = searchParams.get('maxAmount');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

    if (!companyId) {
      return NextResponse.json({ error: 'No company associated' }, { status: 400 });
    }

    // Construir query
    const where: any = { companyId };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { institution: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (statusFilter) where.status = statusFilter;
    if (typeFilter) where.type = typeFilter;
    if (categoryFilter) where.category = categoryFilter;

    if (countryFilter) {
      where.countries = { contains: countryFilter };
    }

    if (minAmount || maxAmount) {
      where.amount = {};
      if (minAmount) where.amount.gte = parseFloat(minAmount);
      if (maxAmount) where.amount.lte = parseFloat(maxAmount);
    }

    // Paginación
    const skip = (page - 1) * limit;

    const [funds, total] = await Promise.all([
      (prisma as any).fund.findMany({
        where,
        skip,
        take: limit,
        orderBy: { deadline: 'asc' },
        include: {
          userStatus: {
            where: { userId: session.user?.id },
            select: { status: true, notes: true },
          },
        },
      }),
      (prisma as any).fund.count({ where }),
    ]);

    return NextResponse.json({
      funds: (funds as any[]).map((fund: any) => ({
        ...fund,
        userStatus: fund.userStatus[0] || null,
      })),
      pagination: {
        total,
        pages: Math.ceil(total / limit),
        current: page,
        pageSize: limit,
      },
    });
  } catch (error) {
    console.error('[GET /api/funds]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = session.user as SessionUser;
    const companyId = (user as any).companyId || user.id;
    if (!companyId) {
      return NextResponse.json({ error: 'No company associated' }, { status: 400 });
    }

    const body = await request.json();

    const fund = await (prisma as any).fund.create({
      data: {
        companyId,
        ...body,
      },
    });

    return NextResponse.json(fund, { status: 201 });
  } catch (error) {
    console.error('[POST /api/funds]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
