export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserCompanyIds } from '@/lib/tenant';
import { extractAndStoreGuideText } from '@/lib/siep/report-guide-context';
import {
  createProjectReportGuide,
  findProjectReportGuides,
  normalizeGuideDomain,
} from '@/lib/siep/report-guide-db';

async function assertProjectAccess(projectId: string, tenant: { companyIds: string[] }) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { companyId: true },
  });
  if (!project || !tenant.companyIds.includes(project.companyId)) return null;
  return project;
}

export async function GET(_req: Request, { params }: { params: { projectId: string } }) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    if (!(await assertProjectAccess(params.projectId, tenant))) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const domain = new URL(_req.url).searchParams.get('domain')?.trim() || null;

    const guides = await findProjectReportGuides(params.projectId, domain);

    return NextResponse.json({
      guides: guides.map((g) => ({
        id: g.id,
        title: g.title,
        fileName: g.fileName,
        mimeType: g.mimeType,
        fileSizeBytes: g.fileSizeBytes,
        extractionStatus: g.extractionStatus,
        hasText: Boolean(g.extractedText && g.extractedText.length > 0),
        textPreview: g.extractedText ? g.extractedText.slice(0, 280) : null,
        uploadedBy: g.uploadedBy,
        createdAt: g.createdAt,
      })),
    });
  } catch (error: unknown) {
    console.error('[SIEP] report-guides GET:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function POST(req: Request, { params }: { params: { projectId: string } }) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    if (!(await assertProjectAccess(params.projectId, tenant))) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const body = await req.json();
    const fileName = String(body.fileName || '').trim();
    const cloudStoragePath = String(body.cloudStoragePath || body.cloud_storage_path || '').trim();

    if (!fileName || !cloudStoragePath) {
      return NextResponse.json({ error: 'fileName y cloudStoragePath requeridos' }, { status: 400 });
    }

    const count = await prisma.projectReportGuide.count({
      where: { projectId: params.projectId, isActive: true },
    });

    const domain = normalizeGuideDomain(body.domain);

    const guide = await createProjectReportGuide({
      projectId: params.projectId,
      title: String(body.title || fileName).trim() || fileName,
      fileName,
      cloudStoragePath,
      mimeType: body.mimeType || null,
      fileSizeBytes: parseInt(String(body.fileSizeBytes || 0), 10) || 0,
      uploadedById: tenant.userId,
      order: count,
      domain,
      extractionStatus: 'pending',
    });

    await extractAndStoreGuideText(guide.id).catch((err: unknown) => {
      console.error('[SIEP] guide extraction failed:', guide.id, err);
    });

    const refreshed = await prisma.projectReportGuide.findUnique({
      where: { id: guide.id },
      include: { uploadedBy: { select: { id: true, name: true } } },
    });

    return NextResponse.json({ guide: refreshed });
  } catch (error: unknown) {
    console.error('[SIEP] report-guides POST:', error);
    const msg = error instanceof Error ? error.message : 'Error interno';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: { projectId: string } }) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    if (!(await assertProjectAccess(params.projectId, tenant))) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const guideId = new URL(req.url).searchParams.get('id')?.trim();
    if (!guideId) return NextResponse.json({ error: 'id requerido' }, { status: 400 });

    const existing = await prisma.projectReportGuide.findFirst({
      where: { id: guideId, projectId: params.projectId, isActive: true },
    });
    if (!existing) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

    await prisma.projectReportGuide.update({
      where: { id: guideId },
      data: { isActive: false },
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
