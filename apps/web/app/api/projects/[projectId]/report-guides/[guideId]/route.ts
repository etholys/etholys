export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserCompanyIds } from '@/lib/tenant';
import { extractAndStoreGuideText } from '@/lib/siep/report-guide-context';

export async function POST(_req: Request, { params }: { params: { projectId: string; guideId: string } }) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const guide = await prisma.projectReportGuide.findFirst({
      where: { id: params.guideId, projectId: params.projectId, isActive: true },
      include: { project: { select: { companyId: true } } },
    });
    if (!guide || !tenant.companyIds.includes(guide.project.companyId)) {
      return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
    }

    await prisma.projectReportGuide.update({
      where: { id: params.guideId },
      data: { extractionStatus: 'pending' },
    });
    await extractAndStoreGuideText(params.guideId);

    const refreshed = await prisma.projectReportGuide.findUnique({ where: { id: params.guideId } });
    return NextResponse.json({ guide: refreshed });
  } catch (error: unknown) {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
