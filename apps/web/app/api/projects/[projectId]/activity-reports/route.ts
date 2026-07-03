export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserCompanyIds } from '@/lib/tenant';
import { hasSiepPermission, resolveSiepPermissions } from '@/lib/siep/permissions';

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

    const project = await prisma.project.findUnique({
      where: { id: params.projectId },
      select: { companyId: true },
    });
    if (!project || !tenant.companyIds.includes(project.companyId)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const perms = await resolveSiepPermissions(tenant.userId, project.companyId);
    const canViewAll = hasSiepPermission(perms, 'siep.activities.view_all_reports')
      || hasSiepPermission(perms, 'siep.activities.approve_reports');

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

    const project = await prisma.project.findUnique({
      where: { id: params.projectId },
      select: { companyId: true },
    });
    if (!project || !tenant.companyIds.includes(project.companyId)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const perms = await resolveSiepPermissions(tenant.userId, project.companyId);
    if (!hasSiepPermission(perms, 'siep.activities.report')) {
      return NextResponse.json({ error: 'Sem permissão para reportar actividades' }, { status: 403 });
    }

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
