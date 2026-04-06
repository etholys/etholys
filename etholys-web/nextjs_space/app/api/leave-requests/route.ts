export const dynamic = 'force-dynamic';

import { NextResponse, NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserCompanyIds } from '@/lib/tenant';

export async function GET(req: NextRequest) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const { searchParams } = new URL(req.url);
    const companyId = searchParams.get('companyId');

    const where: any = {
      companyId: companyId && tenant.companyIds.includes(companyId) ? companyId : { in: tenant.companyIds },
    };

    const leaves = await prisma.leaveRequest.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json({ leaves });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const body = await req.json();
    if (!tenant.companyIds.includes(body.companyId)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const startDate = new Date(body.startDate);
    const endDate = new Date(body.endDate);
    const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
    const days = body.days || Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

    const leave = await prisma.leaveRequest.create({
      data: {
        companyId: body.companyId,
        userId: body.userId || tenant.userId,
        type: body.type || 'vacation',
        startDate,
        endDate,
        days,
        reason: body.reason || null,
        notes: body.notes || null,
      },
    });
    return NextResponse.json({ leave });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const body = await req.json();

    const existing = await prisma.leaveRequest.findUnique({ where: { id: body.id } });
    if (!existing || !tenant.companyIds.includes(existing.companyId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const data: any = {};
    if (body.status) {
      data.status = body.status;
      data.reviewedBy = tenant.userId;
      data.reviewedAt = new Date();
    }
    if (body.notes !== undefined) data.notes = body.notes;

    const leave = await prisma.leaveRequest.update({
      where: { id: body.id },
      data,
    });
    return NextResponse.json({ leave });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    const existing = await prisma.leaveRequest.findUnique({ where: { id } });
    if (!existing || !tenant.companyIds.includes(existing.companyId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    await prisma.leaveRequest.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
