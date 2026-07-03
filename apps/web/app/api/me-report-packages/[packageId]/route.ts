export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserCompanyIds } from '@/lib/tenant';
import { extractTextDetailed } from '@/lib/siep/extract-file-text';
import { analyzeDonorReportFile } from '@/lib/siep/donor-report-analyze';
import { generateDonorReportDraft } from '@/lib/siep/donor-report-draft';
import { loadReportGuideContext } from '@/lib/siep/report-guide-context';
import { loadFileBuffer } from '@/lib/siep/file-storage';

async function loadPackageForTenant(packageId: string, tenant: { companyIds: string[] }) {
  const pkg = await prisma.mEReportPackage.findUnique({
    where: { id: packageId },
    include: {
      project: { select: { companyId: true } },
      files: { where: { isActive: true }, orderBy: { order: 'asc' } },
    },
  });
  if (!pkg || !tenant.companyIds.includes(pkg.project.companyId)) return null;
  return pkg;
}

export async function PUT(req: Request, { params }: { params: { packageId: string } }) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const pkg = await loadPackageForTenant(params.packageId, tenant);
    if (!pkg) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

    const body = await req.json();
    const data: Record<string, unknown> = {};
    if (body.title !== undefined) data.title = body.title;
    if (body.cadence !== undefined) data.cadence = body.cadence;
    if (body.period !== undefined) data.period = body.period || null;
    if (body.status !== undefined) data.status = body.status;
    if (body.donorFormat !== undefined) data.donorFormat = body.donorFormat;
    if (body.parentPackageId !== undefined) data.parentPackageId = body.parentPackageId || null;
    if (body.notes !== undefined) data.notes = body.notes || null;

    const updated = await prisma.mEReportPackage.update({
      where: { id: params.packageId },
      data,
      include: { files: { where: { isActive: true }, orderBy: { order: 'asc' } } },
    });
    return NextResponse.json({ package: updated });
  } catch (error: unknown) {
    console.error('MEReportPackage PUT error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: { packageId: string } }) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const pkg = await loadPackageForTenant(params.packageId, tenant);
    if (!pkg) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

    await prisma.mEReportPackage.update({
      where: { id: params.packageId },
      data: { isActive: false },
    });
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('MEReportPackage DELETE error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

/** POST — adicionar ficheiro ou analisar pacote (action=analyze) */
export async function POST(req: Request, { params }: { params: { packageId: string } }) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const pkg = await loadPackageForTenant(params.packageId, tenant);
    if (!pkg) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

    const body = await req.json();

    if (body.action === 'analyze') {
      const guideContext = await loadReportGuideContext(
        pkg.projectId,
        pkg.domain === 'budget' ? 'budget' : 'me',
      );
      const results: Array<{ fileId: string; fileName: string; validation: unknown }> = [];

      for (const file of pkg.files) {
        try {
          const buffer = await loadFileBuffer(file.cloudStoragePath);
          const extracted = await extractTextDetailed(buffer, file.fileName, file.mimeType);
          const validation = await analyzeDonorReportFile(
            file.fileName,
            extracted.text,
            pkg.donorFormat,
            guideContext,
            { charCount: extracted.charCount, method: extracted.method, issue: extracted.issue },
          );

          await prisma.mEReportFile.update({
            where: { id: file.id },
            data: {
              aiDetectedComponent: validation.detectedComponent,
              aiDetectedCadence: validation.detectedCadence,
              aiValidation: validation as object,
              component: file.component === 'other' ? validation.detectedComponent : file.component,
              cadence: file.cadence || validation.detectedCadence,
            },
          });

          results.push({ fileId: file.id, fileName: file.fileName, validation });
        } catch (fileErr: unknown) {
          const msg = fileErr instanceof Error ? fileErr.message : String(fileErr);
          results.push({
            fileId: file.id,
            fileName: file.fileName,
            validation: { error: msg, warnings: [msg] },
          });
        }
      }

      return NextResponse.json({ analyzed: results.length, results });
    }

    if (body.action === 'generateDraft') {
      const draft = await generateDonorReportDraft(pkg.projectId, pkg.id, {
        templateFileId: body.templateFileId || undefined,
        periodStart: body.periodStart || undefined,
        periodEnd: body.periodEnd || undefined,
      });

      const existing = await prisma.mEReport.findFirst({
        where: { packageId: pkg.id, isActive: true, status: 'draft' },
        orderBy: { updatedAt: 'desc' },
      });

      const reportData = {
        title: draft.title,
        type: pkg.domain === 'budget' ? 'financial' : 'progress',
        component: pkg.domain === 'budget' ? 'financial' : 'narrative',
        period: draft.period,
        content: draft.content,
        findings: draft.findings || null,
        recommendations: draft.recommendations || null,
        cadence: pkg.cadence,
        donorFormat: pkg.donorFormat,
        status: 'draft',
      };

      const report = existing
        ? await prisma.mEReport.update({
            where: { id: existing.id },
            data: reportData,
          })
        : await prisma.mEReport.create({
            data: { projectId: pkg.projectId, packageId: pkg.id, ...reportData },
          });

      return NextResponse.json({ report, draft, warnings: draft.warnings });
    }

    if (body.action === 'saveDraft') {
      const { reportId, title, period, content, findings, recommendations } = body;
      if (!reportId) return NextResponse.json({ error: 'reportId requerido' }, { status: 400 });
      const report = await prisma.mEReport.update({
        where: { id: reportId },
        data: {
          ...(title !== undefined ? { title } : {}),
          ...(period !== undefined ? { period } : {}),
          ...(content !== undefined ? { content } : {}),
          ...(findings !== undefined ? { findings } : {}),
          ...(recommendations !== undefined ? { recommendations } : {}),
        },
      });
      return NextResponse.json({ report });
    }

    if (body.action === 'addFile') {
      const { fileName, cloudStoragePath, mimeType, fileSizeBytes, component, cadence } = body;
      if (!fileName || !cloudStoragePath) {
        return NextResponse.json({ error: 'fileName y cloudStoragePath requeridos' }, { status: 400 });
      }
      const order = pkg.files.length;
      const file = await prisma.mEReportFile.create({
        data: {
          packageId: pkg.id,
          projectId: pkg.projectId,
          fileName,
          cloudStoragePath,
          mimeType: mimeType || null,
          fileSizeBytes: fileSizeBytes || 0,
          component: component || 'other',
          cadence: cadence || pkg.cadence,
          order,
        },
      });
      return NextResponse.json({ file });
    }

    if (body.action === 'updateFile') {
      const { fileId, component, cadence, userConfirmed } = body;
      if (!fileId) return NextResponse.json({ error: 'fileId requerido' }, { status: 400 });
      const file = await prisma.mEReportFile.update({
        where: { id: fileId },
        data: {
          ...(component !== undefined ? { component } : {}),
          ...(cadence !== undefined ? { cadence } : {}),
          ...(userConfirmed !== undefined ? { userConfirmed: Boolean(userConfirmed) } : {}),
        },
      });
      return NextResponse.json({ file });
    }

    if (body.action === 'removeFile') {
      const { fileId } = body;
      if (!fileId) return NextResponse.json({ error: 'fileId requerido' }, { status: 400 });
      await prisma.mEReportFile.update({ where: { id: fileId }, data: { isActive: false } });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'action inválida' }, { status: 400 });
  } catch (error: unknown) {
    console.error('MEReportPackage POST error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
