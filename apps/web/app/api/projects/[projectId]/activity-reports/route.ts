export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserCompanyIds } from '@/lib/tenant';
import { hasSiepPermission, requireProjectPermission } from '@/lib/siep/permissions';

const reportInclude = {
  task: { select: { id: true, title: true, status: true } },
  author: { select: { id: true, name: true, email: true } },
  reviewer: { select: { id: true, name: true } },
  budgetLine: { select: { id: true, description: true, category: true } },
  mileage: true,
};

export async function GET(_req: Request, { params }: { params: { projectId: string } }) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const gate = await requireProjectPermission(tenant.userId, params.projectId, [
      'siep.activities.report',
      'siep.activities.view_all_reports',
      'siep.activities.approve_reports',
      'siep.tasks.view',
      'siep.project.view',
    ]);
    if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

    const canViewAll =
      hasSiepPermission(gate.access.permissions, 'siep.activities.view_all_reports') ||
      hasSiepPermission(gate.access.permissions, 'siep.activities.approve_reports');

    const reports = await prisma.taskActivityReport.findMany({
      where: {
        projectId: params.projectId,
        isActive: true,
        ...(canViewAll ? {} : { authorId: tenant.userId }),
      },
      include: reportInclude,
      orderBy: [{ reportDate: 'desc' }, { createdAt: 'desc' }],
    });

    return NextResponse.json({ reports });
  } catch (error: unknown) {
    console.error('[SIEP] activity-reports GET:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function POST(req: Request, { params }: { params: { projectId: string } }) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const gate = await requireProjectPermission(
      tenant.userId,
      params.projectId,
      'siep.activities.report',
    );
    if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

    const body = await req.json();
    if (!body.taskId) return NextResponse.json({ error: 'taskId requerido' }, { status: 400 });

    const task = await prisma.task.findFirst({
      where: { id: body.taskId, projectId: params.projectId, isActive: true },
    });
    if (!task) return NextResponse.json({ error: 'Actividade não encontrada' }, { status: 404 });

    const report = await prisma.taskActivityReport.create({
      data: {
        projectId: params.projectId,
        taskId: body.taskId,
        authorId: tenant.userId,
        reportDate: body.reportDate ? new Date(body.reportDate) : new Date(),
        narrative: String(body.narrative || ''),
        progressPct: body.progressPct != null ? parseInt(String(body.progressPct), 10) : null,
        status: 'draft',
        budgetLineId: body.budgetLineId || null,
        photoUrls: body.photoUrls ?? [],
        deliverableUrls: body.deliverableUrls ?? [],
        includesTravel: Boolean(body.includesTravel),
      },
      include: reportInclude,
    });

    return NextResponse.json({ report });
  } catch (error: unknown) {
    console.error('[SIEP] activity-reports POST:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
