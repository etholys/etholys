export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserCompanyIds } from '@/lib/tenant';

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const project = await prisma.project.findUnique({
      where: { id: params.id },
      include: {
        company: true,
        members: { include: { user: true } },
        tasks: { include: { assignee: true }, orderBy: { order: 'asc' } },
        milestones: { orderBy: { order: 'asc' } },
        risks: { orderBy: { createdAt: 'desc' } },
        transactions: { orderBy: { date: 'desc' } },
        sowSections: { where: { isActive: true }, orderBy: { order: 'asc' } },
        budgetLines: { where: { isActive: true }, orderBy: [{ category: 'asc' }, { order: 'asc' }] },
        meReports: { where: { isActive: true }, orderBy: { reportDate: 'desc' } },
        indicatorMeasurements: { orderBy: [{ period: 'asc' }, { createdAt: 'asc' }], include: { objective: { select: { id: true, title: true, code: true, type: true, indicator: true, baseline: true, target: true, actual: true } } } },
      },
    });
    if (!project) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

    // Build full recursive objective tree (supports unlimited depth)
    const allObjectives = await prisma.objective.findMany({
      where: { projectId: params.id, isActive: true },
      orderBy: { order: 'asc' },
    });
    const objMap = new Map<string | null, any[]>();
    for (const obj of allObjectives) {
      const pid = obj.parentId || null;
      if (!objMap.has(pid)) objMap.set(pid, []);
      objMap.get(pid)!.push(obj);
    }
    function buildTree(parentId: string | null): any[] {
      const items = objMap.get(parentId) || [];
      return items.map(item => ({ ...item, children: buildTree(item.id) }));
    }
    (project as any).objectives = buildTree(null);
    // Tenant check
    if (!tenant.companyIds.includes(project.companyId)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }
    return NextResponse.json({ project });
  } catch (error: any) {
    console.error('Project detail error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const existing = await prisma.project.findUnique({ where: { id: params.id }, select: { companyId: true } });
    if (!existing || !tenant.companyIds.includes(existing.companyId)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }
    const body = await req.json();
    const project = await prisma.project.update({ where: { id: params.id }, data: body });
    return NextResponse.json({ project });
  } catch (error: any) {
    console.error('Update project error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const existing = await prisma.project.findUnique({ where: { id: params.id }, select: { companyId: true } });
    if (!existing || !tenant.companyIds.includes(existing.companyId)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }
    await prisma.project.update({ where: { id: params.id }, data: { isActive: false } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Delete project error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
