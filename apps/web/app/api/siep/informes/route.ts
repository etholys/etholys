export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserCompanyIds } from '@/lib/tenant';
import { createInforme } from '@/lib/siep/informe-service';
import { normalizeInformeDomain } from '@/lib/siep/informe-domains';
import { displayMeasurementPeriod } from '@/lib/siep/measurement-period';

export async function GET(req: Request) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get('projectId');

    if (!projectId) {
      return NextResponse.json({ error: 'projectId requerido' }, { status: 400 });
    }

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { companyId: true },
    });
    if (!project || !tenant.companyIds.includes(project.companyId)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const domainParam = searchParams.get('domain') || 'all';
    const domainFilter =
      domainParam === 'all' || !domainParam ? undefined : normalizeInformeDomain(domainParam);

    const legacyOr =
      domainFilter === 'budget'
        ? [{ packageId: null, OR: [{ component: 'financial' }, { type: 'financial' }] }]
        : domainFilter === 'me'
          ? [
              {
                packageId: null,
                NOT: { OR: [{ component: 'financial' }, { type: 'financial' }, { component: 'narrative' }] },
              },
            ]
          : domainFilter === 'narrative'
            ? [
                { packageId: null, component: 'narrative', NOT: { type: 'financial' } },
                { package: { domain: 'me' }, component: 'narrative' },
              ]
            : domainFilter === 'field'
              ? [{ packageId: null, component: 'field' }]
              : [];

    const reports = await prisma.mEReport.findMany({
      where: {
        projectId,
        isActive: true,
        ...(domainFilter
          ? {
              OR: [{ package: { domain: domainFilter } }, ...legacyOr],
            }
          : {}),
      },
      include: {
        package: { select: { id: true, domain: true, cadence: true, period: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take: 100,
    });

    const informes = reports.map((r) => ({
      id: r.id,
      title: r.title,
      status: r.status,
      cadence: r.cadence || r.package?.cadence,
      period: r.period ? displayMeasurementPeriod(r.period, 'pt') : r.period,
      periodRaw: r.period,
      domain: r.package?.domain || (r.component === 'financial' ? 'budget' : r.component === 'narrative' ? 'narrative' : r.component === 'field' ? 'field' : 'me'),
      canvasFormat: r.canvasFormat,
      updatedAt: r.updatedAt,
      aiSessionId: r.aiSessionId,
    }));

    return NextResponse.json({ informes });
  } catch (error: unknown) {
    console.error('[siep/informes GET]', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const body = await req.json();
    const {
      projectId,
      domain = 'me',
      cadence,
      periodStart,
      periodEnd,
      title,
      donorFormat,
      templateFileId,
      templateFileName,
      cloudStoragePath,
      mimeType,
      fileSizeBytes,
      canvasState,
      canvasFormat,
    } = body;

    const hasTemplate = Boolean(templateFileId);
    const hasUpload = Boolean(templateFileName && cloudStoragePath);
    const hasCanvas = Boolean(canvasState?.regions?.length);
    if (!projectId || !cadence || !periodStart || !periodEnd || (!hasTemplate && !hasUpload && !hasCanvas)) {
      return NextResponse.json({ error: 'Campos obrigatórios em falta' }, { status: 400 });
    }

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { companyId: true },
    });
    if (!project || !tenant.companyIds.includes(project.companyId)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const result = await createInforme({
      projectId,
      companyId: project.companyId,
      userId: tenant.userId,
      domain: normalizeInformeDomain(domain),
      cadence,
      periodStart,
      periodEnd,
      title,
      donorFormat,
      templateFileId,
      templateFileName,
      cloudStoragePath,
      mimeType,
      fileSizeBytes,
      canvasState,
      canvasFormat,
    });

    return NextResponse.json({
      reportId: result.report.id,
      packageId: result.package.id,
      aiSessionId: result.aiSessionId,
      canvasFormat: result.report.canvasFormat,
    });
  } catch (error: unknown) {
    console.error('[siep/informes POST]', error);
    const msg = error instanceof Error ? error.message : 'Error interno';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
