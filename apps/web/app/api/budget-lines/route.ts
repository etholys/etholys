export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserCompanyIds } from '@/lib/tenant';

export async function GET(req: Request) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get('projectId');
    if (!projectId) return NextResponse.json({ error: 'projectId requerido' }, { status: 400 });
    const project = await prisma.project.findUnique({ where: { id: projectId }, select: { companyId: true } });
    if (!project || !tenant.companyIds.includes(project.companyId)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }
    const lines = await prisma.budgetLine.findMany({
      where: { projectId, isActive: true },
      orderBy: [{ category: 'asc' }, { order: 'asc' }],
      include: { transactions: { orderBy: { date: 'desc' } } },
    });
    return NextResponse.json({ lines });
  } catch (error: any) {
    console.error('BudgetLine GET error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const body = await req.json();
    const { projectId, category, description, unit, quantity, unitCost, narrative, fundSource, periodStart, periodEnd } = body;
    if (!projectId || !category || !description) {
      return NextResponse.json({ error: 'projectId, category, description requeridos' }, { status: 400 });
    }
    const project = await prisma.project.findUnique({ where: { id: projectId }, select: { companyId: true } });
    if (!project || !tenant.companyIds.includes(project.companyId)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }
    const qty = parseFloat(quantity) || 1;
    const uc = parseFloat(unitCost) || 0;
    const maxOrder = await prisma.budgetLine.aggregate({ where: { projectId, category }, _max: { order: true } });
    const line = await prisma.budgetLine.create({
      data: {
        projectId,
        category,
        description,
        unit: unit || null,
        quantity: qty,
        unitCost: uc,
        total: qty * uc,
        narrative: narrative || '',
        fundSource: fundSource || 'federal',
        periodStart: periodStart ? new Date(periodStart) : null,
        periodEnd: periodEnd ? new Date(periodEnd) : null,
        order: (maxOrder._max.order ?? -1) + 1,
      },
    });
    return NextResponse.json({ line });
  } catch (error: any) {
    console.error('BudgetLine POST error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const body = await req.json();
    const { id, ...updates } = body;
    if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 });
    const existing = await prisma.budgetLine.findUnique({
      where: { id },
      include: { project: { select: { companyId: true } } },
    });
    if (!existing || !tenant.companyIds.includes(existing.project.companyId)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }
    const data: any = {};
    if (updates.category !== undefined) data.category = updates.category;
    if (updates.description !== undefined) data.description = updates.description;
    if (updates.unit !== undefined) data.unit = updates.unit || null;
    if (updates.quantity !== undefined) data.quantity = parseFloat(updates.quantity) || 1;
    if (updates.unitCost !== undefined) data.unitCost = parseFloat(updates.unitCost) || 0;
    if (updates.narrative !== undefined) data.narrative = updates.narrative;
    if (updates.fundSource !== undefined) data.fundSource = updates.fundSource;
    if (updates.periodStart !== undefined) data.periodStart = updates.periodStart ? new Date(updates.periodStart) : null;
    if (updates.periodEnd !== undefined) data.periodEnd = updates.periodEnd ? new Date(updates.periodEnd) : null;
    // Recalculate total
    const qty = data.quantity ?? existing.quantity;
    const uc = data.unitCost ?? existing.unitCost;
    data.total = qty * uc;
    const line = await prisma.budgetLine.update({ where: { id }, data });
    return NextResponse.json({ line });
  } catch (error: any) {
    console.error('BudgetLine PUT error:', error);
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
    const existing = await prisma.budgetLine.findUnique({
      where: { id },
      include: { project: { select: { companyId: true } } },
    });
    if (!existing || !tenant.companyIds.includes(existing.project.companyId)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }
    await prisma.budgetLine.update({ where: { id }, data: { isActive: false } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('BudgetLine DELETE error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
