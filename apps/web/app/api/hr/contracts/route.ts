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

    const contracts = await prisma.employeeContract.findMany({
      where: {
        companyId: companyId && tenant.companyIds.includes(companyId) ? companyId : { in: tenant.companyIds },
        isActive: true,
      },
      orderBy: { startDate: 'desc' },
    });

    // Enrich with user info
    const userIds = [...new Set(contracts.map((c: any) => c.userId))];
    const users = await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true, email: true } });
    const userMap = Object.fromEntries(users.map((u: any) => [u.id, u]));

    return NextResponse.json({
      contracts: contracts.map((c: any) => ({ ...c, type: c.contractType, hoursPerWeek: c.workHours, user: userMap[c.userId] || null })),
    });
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

    const contract = await prisma.employeeContract.create({
      data: {
        companyId: body.companyId,
        userId: body.userId || body.memberId,
        contractType: body.type || body.contractType || 'full_time',
        position: body.position || '',
        department: body.department || null,
        salary: body.salary ? parseFloat(body.salary) : null,
        currency: body.currency || 'USD',
        startDate: body.startDate ? new Date(body.startDate) : new Date(),
        endDate: body.endDate ? new Date(body.endDate) : null,
        workHours: body.hoursPerWeek ? parseFloat(body.hoursPerWeek) : 40,
        socialSecurity: body.socialSecurity ? parseFloat(body.socialSecurity) : 0,
        healthInsurance: body.healthInsurance ? parseFloat(body.healthInsurance) : 0,
        otherDeductions: body.otherDeductions ? parseFloat(body.otherDeductions) : 0,
        bonuses: body.bonuses ? parseFloat(body.bonuses) : 0,
        notes: body.notes || null,
      },
    });
    return NextResponse.json({ contract });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const body = await req.json();
    const id = body.id as string | undefined;
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const existing = await prisma.employeeContract.findUnique({ where: { id } });
    if (!existing || !tenant.companyIds.includes(existing.companyId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const contract = await prisma.employeeContract.update({
      where: { id },
      data: {
        contractType: body.type != null ? String(body.type).toLowerCase().replace(/-/g, '_') : existing.contractType,
        position: body.position !== undefined ? body.position : existing.position,
        department: body.department !== undefined ? body.department : existing.department,
        salary: body.salary !== undefined && body.salary !== '' ? parseFloat(String(body.salary)) : existing.salary,
        currency: body.currency !== undefined ? body.currency : existing.currency,
        startDate:
          body.startDate !== undefined && body.startDate !== ''
            ? new Date(body.startDate)
            : existing.startDate,
        endDate:
          body.endDate === undefined
            ? existing.endDate
            : body.endDate === '' || body.endDate === null
              ? null
              : new Date(body.endDate),
        workHours:
          body.hoursPerWeek !== undefined && body.hoursPerWeek !== ''
            ? parseFloat(String(body.hoursPerWeek))
            : existing.workHours,
        socialSecurity:
          body.socialSecurity !== undefined ? parseFloat(String(body.socialSecurity || 0)) : existing.socialSecurity,
        healthInsurance:
          body.healthInsurance !== undefined ? parseFloat(String(body.healthInsurance || 0)) : existing.healthInsurance,
        otherDeductions:
          body.otherDeductions !== undefined ? parseFloat(String(body.otherDeductions || 0)) : existing.otherDeductions,
        bonuses: body.bonuses !== undefined ? parseFloat(String(body.bonuses || 0)) : existing.bonuses,
        notes: body.notes !== undefined ? body.notes : existing.notes,
      },
    });
    return NextResponse.json({ contract });
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
    const existing = await prisma.employeeContract.findUnique({ where: { id } });
    if (!existing || !tenant.companyIds.includes(existing.companyId)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    await prisma.employeeContract.update({ where: { id }, data: { isActive: false } });
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
