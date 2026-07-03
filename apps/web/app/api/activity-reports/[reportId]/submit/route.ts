export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserCompanyIds } from '@/lib/tenant';
import { hasSiepPermission, resolveSiepPermissions } from '@/lib/siep/permissions';

export async function POST(_req: Request, { params }: { params: { reportId: string } }) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const report = await prisma.taskActivityReport.findFirst({
      where: { id: params.reportId, isActive: true },
      include: { project: { select: { companyId: true } }, mileage: true },
    });
    if (!report || !tenant.companyIds.includes(report.project.companyId)) {
      return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
    }
    if (report.authorId !== tenant.userId) {
      return NextResponse.json({ error: 'Só o autor pode submeter' }, { status: 403 });
    }
    if (report.status !== 'draft') {
      return NextResponse.json({ error: 'Reporte já submetido' }, { status: 400 });
    }

    const perms = await resolveSiepPermissions(tenant.userId, report.project.companyId);
    if (!hasSiepPermission(perms, 'siep.activities.report')) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
    }

    if (report.includesTravel && !report.mileage) {
      return NextResponse.json({ error: 'Preencha os dados de viagem/combustível antes de submeter' }, { status: 400 });
    }

    const updated = await prisma.taskActivityReport.update({
      where: { id: params.reportId },
      data: { status: 'submitted' },
      include: {
        task: { select: { id: true, title: true } },
        author: { select: { id: true, name: true } },
        mileage: true,
        budgetLine: { select: { id: true, description: true } },
      },
    });

    return NextResponse.json({ report: updated });
  } catch (error: unknown) {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
