export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserCompanyIds } from '@/lib/tenant';

export async function GET(req: Request) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const { searchParams } = new URL(req.url);
    const budgetItemId = searchParams.get('budgetItemId');
    if (!budgetItemId) return NextResponse.json({ error: 'budgetItemId requerido' }, { status: 400 });
    const item = await prisma.companyBudgetItem.findUnique({ where: { id: budgetItemId }, select: { companyId: true } });
    if (!item || !tenant.companyIds.includes(item.companyId)) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    const fundings = await prisma.budgetItemFunding.findMany({
      where: { budgetItemId },
      include: { project: { select: { id: true, name: true } } },
      orderBy: { periodStart: 'asc' },
    });
    return NextResponse.json({ fundings });
  } catch (error: any) {
    console.error('BudgetItemFunding GET error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const body = await req.json();
    const { budgetItemId, projectId, percentage, periodStart, periodEnd, note } = body;
    if (!budgetItemId) return NextResponse.json({ error: 'budgetItemId requerido' }, { status: 400 });
    const item = await prisma.companyBudgetItem.findUnique({ where: { id: budgetItemId }, select: { companyId: true } });
    if (!item || !tenant.companyIds.includes(item.companyId)) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    const funding = await prisma.budgetItemFunding.create({
      data: {
        budgetItemId,
        projectId: projectId || null,
        percentage: parseFloat(percentage) || 100,
        periodStart: periodStart ? new Date(periodStart) : null,
        periodEnd: periodEnd ? new Date(periodEnd) : null,
        note: note || null,
      },
      include: { project: { select: { id: true, name: true } } },
    });
    return NextResponse.json({ funding });
  } catch (error: any) {
    console.error('BudgetItemFunding POST error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const body = await req.json();
    const { id, projectId, percentage, periodStart, periodEnd, note } = body;
    if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 });
    const existing = await prisma.budgetItemFunding.findUnique({ where: { id }, include: { budgetItem: { select: { companyId: true } } } });
    if (!existing || !tenant.companyIds.includes(existing.budgetItem.companyId)) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    const funding = await prisma.budgetItemFunding.update({
      where: { id },
      data: {
        projectId: projectId !== undefined ? (projectId || null) : undefined,
        percentage: percentage !== undefined ? (parseFloat(percentage) || 100) : undefined,
        periodStart: periodStart !== undefined ? (periodStart ? new Date(periodStart) : null) : undefined,
        periodEnd: periodEnd !== undefined ? (periodEnd ? new Date(periodEnd) : null) : undefined,
        note: note !== undefined ? (note || null) : undefined,
      },
      include: { project: { select: { id: true, name: true } } },
    });
    return NextResponse.json({ funding });
  } catch (error: any) {
    console.error('BudgetItemFunding PUT error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 });
    const existing = await prisma.budgetItemFunding.findUnique({ where: { id }, include: { budgetItem: { select: { companyId: true } } } });
    if (!existing || !tenant.companyIds.includes(existing.budgetItem.companyId)) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    await prisma.budgetItemFunding.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('BudgetItemFunding DELETE error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
