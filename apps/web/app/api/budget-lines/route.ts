export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserCompanyIds } from '@/lib/tenant';
import { computeLineTotal } from '@/lib/siep/budget-line-calc';
import { normalizeBudgetLineInput, recalculateProjectBudgetLines } from '@/lib/siep/budget-line-sync';

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
  } catch (error: unknown) {
    console.error('BudgetLine GET error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const body = await req.json();
    const { projectId, description, narrative, fundSource, periodStart, periodEnd } = body;
    if (!projectId || !body.category || !description) {
      return NextResponse.json({ error: 'projectId, category, description requeridos' }, { status: 400 });
    }
    const project = await prisma.project.findUnique({ where: { id: projectId }, select: { companyId: true } });
    if (!project || !tenant.companyIds.includes(project.companyId)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const normalized = normalizeBudgetLineInput(body);
    const existingLines = await prisma.budgetLine.findMany({
      where: { projectId, isActive: true },
      select: { id: true, category: true, quantity: true, unitCost: true, unit: true, unitType: true },
    });

    const draftLine = {
      id: 'new',
      category: normalized.category,
      quantity: normalized.quantity,
      unitCost: normalized.unitCost,
      unit: normalized.unit,
      unitType: normalized.unitType,
    };
    const total = computeLineTotal(draftLine, [...existingLines, draftLine]);

    const maxOrder = await prisma.budgetLine.aggregate({
      where: { projectId, category: normalized.category },
      _max: { order: true },
    });

    const line = await prisma.budgetLine.create({
      data: {
        projectId,
        category: normalized.category,
        description,
        unit: normalized.unit,
        unitType: normalized.unitType,
        quantity: normalized.quantity,
        unitCost: normalized.unitCost,
        total,
        narrative: narrative || '',
        fundSource: fundSource || 'federal',
        periodStart: periodStart ? new Date(periodStart) : null,
        periodEnd: periodEnd ? new Date(periodEnd) : null,
        order: (maxOrder._max.order ?? -1) + 1,
      },
    });

    await recalculateProjectBudgetLines(projectId);
    const refreshed = await prisma.budgetLine.findUnique({ where: { id: line.id } });
    return NextResponse.json({ line: refreshed ?? line });
  } catch (error: unknown) {
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
      include: { project: { select: { companyId: true, id: true } } },
    });
    if (!existing || !tenant.companyIds.includes(existing.project.companyId)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const normalized = normalizeBudgetLineInput(updates, existing);
    const data: Record<string, unknown> = {};
    if (updates.category !== undefined) data.category = normalized.category;
    if (updates.description !== undefined) data.description = updates.description;
    if (updates.unit !== undefined || updates.category !== undefined) data.unit = normalized.unit;
    if (updates.unitType !== undefined || updates.unit !== undefined || updates.category !== undefined) {
      data.unitType = normalized.unitType;
    }
    if (updates.quantity !== undefined) data.quantity = normalized.quantity;
    if (updates.unitCost !== undefined) data.unitCost = normalized.unitCost;
    if (updates.narrative !== undefined) data.narrative = updates.narrative;
    if (updates.fundSource !== undefined) data.fundSource = updates.fundSource;
    if (updates.periodStart !== undefined) data.periodStart = updates.periodStart ? new Date(updates.periodStart) : null;
    if (updates.periodEnd !== undefined) data.periodEnd = updates.periodEnd ? new Date(updates.periodEnd) : null;

    const siblingLines = await prisma.budgetLine.findMany({
      where: { projectId: existing.projectId, isActive: true, NOT: { id } },
      select: { id: true, category: true, quantity: true, unitCost: true, unit: true, unitType: true },
    });

    const merged = {
      id,
      category: (data.category as string) ?? existing.category,
      quantity: (data.quantity as number) ?? existing.quantity,
      unitCost: (data.unitCost as number) ?? existing.unitCost,
      unit: (data.unit as string | null) ?? existing.unit,
      unitType: (data.unitType as string) ?? existing.unitType,
    };
    data.total = computeLineTotal(merged, [...siblingLines, merged]);

    const line = await prisma.budgetLine.update({ where: { id }, data });
    await recalculateProjectBudgetLines(existing.projectId);
    const refreshed = await prisma.budgetLine.findUnique({ where: { id: line.id } });
    return NextResponse.json({ line: refreshed ?? line });
  } catch (error: unknown) {
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
      include: { project: { select: { companyId: true, id: true } } },
    });
    if (!existing || !tenant.companyIds.includes(existing.project.companyId)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }
    await prisma.budgetLine.update({ where: { id }, data: { isActive: false } });
    await recalculateProjectBudgetLines(existing.projectId);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('BudgetLine DELETE error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
