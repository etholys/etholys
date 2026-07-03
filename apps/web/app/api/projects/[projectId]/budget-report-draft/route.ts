export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserCompanyIds } from '@/lib/tenant';
import { generateBudgetReportDraft } from '@/lib/siep/budget-report-draft';

async function assertProjectAccess(projectId: string, tenant: { companyIds: string[] }) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { companyId: true },
  });
  if (!project || !tenant.companyIds.includes(project.companyId)) return null;
  return project;
}

export async function POST(req: Request, { params }: { params: { projectId: string } }) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    if (!(await assertProjectAccess(params.projectId, tenant))) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const body = await req.json();
    const action = body.action || 'draft';

    if (action === 'draft') {
      const draft = await generateBudgetReportDraft(params.projectId, {
        periodStart: body.periodStart || undefined,
        periodEnd: body.periodEnd || undefined,
        donorFormat: body.donorFormat || undefined,
      });
      return NextResponse.json({ draft });
    }

    if (action === 'save') {
      const { title, period, content, findings, recommendations, packageId } = body;
      if (!title) return NextResponse.json({ error: 'title requerido' }, { status: 400 });

      const report = await prisma.mEReport.create({
        data: {
          projectId: params.projectId,
          title: String(title),
          type: 'financial',
          component: 'financial',
          period: period || null,
          content: content || '',
          findings: findings || null,
          recommendations: recommendations || null,
          status: 'draft',
          packageId: packageId || null,
          donorFormat: body.donorFormat || null,
        },
      });
      return NextResponse.json({ report });
    }

    return NextResponse.json({ error: 'action inválida' }, { status: 400 });
  } catch (error: unknown) {
    console.error('[SIEP] budget-report-draft POST:', error);
    const msg = error instanceof Error ? error.message : 'Error interno';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function GET(_req: Request, { params }: { params: { projectId: string } }) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    if (!(await assertProjectAccess(params.projectId, tenant))) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const reports = await prisma.mEReport.findMany({
      where: {
        projectId: params.projectId,
        isActive: true,
        OR: [{ type: 'financial' }, { component: 'financial' }],
      },
      orderBy: { reportDate: 'desc' },
    });

    return NextResponse.json({ reports });
  } catch (error: unknown) {
    console.error('[SIEP] budget-report-draft GET:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
