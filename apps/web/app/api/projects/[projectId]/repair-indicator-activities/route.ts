export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserCompanyIds } from '@/lib/tenant';
import { repairIndicatorActivities } from '@/lib/siep/repair-indicator-activities';

export async function POST(_req: Request, { params }: { params: { projectId: string } }) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const project = await prisma.project.findUnique({
      where: { id: params.projectId },
      select: { id: true, companyId: true },
    });
    if (!project) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
    if (!tenant.companyIds.includes(project.companyId)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const result = await repairIndicatorActivities(params.projectId);

    return NextResponse.json({
      repaired: result.reparented,
      activitiesCreated: result.activitiesCreated,
      remainingOrphans: result.remainingOrphans,
      message:
        result.remainingOrphans === 0
          ? 'Vínculos con actividades corregidos.'
          : 'Reparación aplicada — algunos indicadores pueden requerir asignación manual.',
    });
  } catch (error: unknown) {
    console.error('repair-indicator-activities error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
