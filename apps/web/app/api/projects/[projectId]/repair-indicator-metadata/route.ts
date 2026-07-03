export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserCompanyIds } from '@/lib/tenant';
import { repairIndicatorMetadata } from '@/lib/siep/repair-indicator-metadata';

export async function POST(req: Request, { params }: { params: { projectId: string } }) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const project = await prisma.project.findUnique({
      where: { id: params.projectId },
      select: { id: true, companyId: true, description: true, goal: true },
    });
    if (!project || !tenant.companyIds.includes(project.companyId)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const useAi = body.useAi !== false;
    const documentHint = [project.goal, project.description, body.documentHint].filter(Boolean).join('\n');

    const result = await repairIndicatorMetadata(params.projectId, { useAi, documentHint });

    return NextResponse.json({
      ...result,
      message:
        result.remaining > 0
          ? `${result.updated + result.aiFilled} indicador(es) actualizado(s). ${result.remaining} ainda sem meta — re-importe o marco lógico para valores exactos.`
          : `Metadados M&E actualizados (${result.updated + result.aiFilled} indicador(es)).`,
    });
  } catch (error: unknown) {
    console.error('[SIEP] repair-indicator-metadata error:', error);
    const msg = error instanceof Error ? error.message : 'Error interno';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
