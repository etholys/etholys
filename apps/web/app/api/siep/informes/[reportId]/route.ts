export const dynamic = 'force-dynamic';
export const maxDuration = 120;

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserCompanyIds } from '@/lib/tenant';
import {
  loadInformeEditorState,
  legacyCanvasFromReport,
} from '@/lib/siep/informe-service';
import { loadFileBuffer } from '@/lib/siep/file-storage';
import { exportReportFromCanvas } from '@/lib/siep/report-template-export';
import { parseReportTemplate } from '@/lib/siep/report-template-parse';
import { reconcileCanvasDocxCoords } from '@/lib/siep/reconcile-canvas-docx';
import {
  canvasStateToPlainText,
  type ReportCanvasState,
} from '@/lib/siep/report-canvas-types';
import { displayMeasurementPeriod } from '@/lib/siep/measurement-period';
import {
  ensureInformeAiSession,
  patchInformeMeta,
  readInformeMeta,
} from '@/lib/siep/informe-report-meta';

type RouteCtx = { params: Promise<{ reportId: string }> };

export async function GET(_req: Request, ctx: RouteCtx) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const { reportId } = await ctx.params;

    const loaded = await loadInformeEditorState(reportId, tenant.companyIds);
    if (!loaded) return NextResponse.json({ error: 'Informe não encontrado' }, { status: 404 });

    const { report, canvasState } = loaded;
    let canvas = canvasState || legacyCanvasFromReport(report);
    const templateFile = report.package?.files?.[0] ?? null;
    const meta = await readInformeMeta(reportId);

    const aiSessionId = await ensureInformeAiSession(reportId, {
      title: report.title,
      companyId: report.project.companyId,
      userId: tenant.userId,
    });

    if (!meta.canvasState && canvas) {
      await patchInformeMeta(reportId, {
        canvasState: canvas,
        canvasFormat: canvas.format,
      });
    }

    return NextResponse.json({
      report: {
        id: report.id,
        title: report.title,
        status: report.status,
        period: report.period ? displayMeasurementPeriod(report.period, 'pt') : report.period,
        periodRaw: report.period,
        cadence: report.cadence,
        domain: report.package?.domain || 'me',
        canvasFormat: meta.canvasFormat || report.canvasFormat || canvas.format,
        aiSessionId,
        projectId: report.projectId,
        projectName: report.project.name,
      },
      canvasState: canvas,
      templateFile: templateFile
        ? { id: templateFile.id, fileName: templateFile.fileName, mimeType: templateFile.mimeType }
        : null,
    });
  } catch (error: unknown) {
    console.error('[siep/informes/[reportId] GET]', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function PUT(req: Request, ctx: RouteCtx) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const { reportId } = await ctx.params;
    const body = await req.json();
    const canvasState = body.canvasState as ReportCanvasState | undefined;
    const status = body.status as string | undefined;

    const existing = await prisma.mEReport.findUnique({
      where: { id: reportId },
      include: { project: { select: { companyId: true } } },
    });
    if (!existing || !tenant.companyIds.includes(existing.project.companyId)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const data: Record<string, unknown> = {};
    if (canvasState) {
      data.content = canvasStateToPlainText(canvasState);
      const findings = canvasState.regions.find((r) => r.id === 'findings');
      const recs = canvasState.regions.find((r) => r.id === 'recommendations');
      if (findings) data.findings = findings.text;
      if (recs) data.recommendations = recs.text;
    }
    if (status) data.status = status;

    const report = await prisma.mEReport.update({ where: { id: reportId }, data });

    if (canvasState) {
      await patchInformeMeta(reportId, {
        canvasState,
        canvasFormat: canvasState.format,
      });
    }

    const meta = await readInformeMeta(reportId);
    return NextResponse.json({ report, canvasState: meta.canvasState ?? canvasState });
  } catch (error: unknown) {
    console.error('[siep/informes/[reportId] PUT]', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function POST(req: Request, ctx: RouteCtx) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const { reportId } = await ctx.params;
    const body = await req.json();

    if (body.action !== 'export') {
      return NextResponse.json({ error: 'action inválida' }, { status: 400 });
    }

    const loaded = await loadInformeEditorState(reportId, tenant.companyIds);
    if (!loaded) return NextResponse.json({ error: 'Informe não encontrado' }, { status: 404 });

    const { report, canvasState } = loaded;
    const canvas = canvasState || legacyCanvasFromReport(report);
    const templateFile = report.package?.files?.[0];
    if (!templateFile) {
      return NextResponse.json({ error: 'Sem ficheiro modelo' }, { status: 400 });
    }

    if (canvas.format === 'markdown') {
      const text = canvasStateToPlainText(canvas);
      return NextResponse.json({
        fileName: `${report.title.replace(/[^\w\s-]/g, '')}.txt`,
        mimeType: 'text/plain; charset=utf-8',
        base64: Buffer.from(text, 'utf-8').toString('base64'),
      });
    }

    const buffer = await loadFileBuffer(templateFile.cloudStoragePath);
    let exportCanvas = canvas;
    if (canvas.format === 'docx') {
      const freshTemplate = await parseReportTemplate(
        buffer,
        templateFile.fileName,
        templateFile.id,
        templateFile.mimeType,
      );
      exportCanvas = reconcileCanvasDocxCoords(freshTemplate, canvas);
    }
    const exported = await exportReportFromCanvas(buffer, exportCanvas, templateFile.fileName);

    return NextResponse.json({
      fileName: exported.fileName,
      mimeType: exported.mimeType,
      base64: exported.buffer.toString('base64'),
    });
  } catch (error: unknown) {
    console.error('[siep/informes/[reportId] POST export]', error);
    const msg = error instanceof Error ? error.message : 'Error interno';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(_req: Request, ctx: RouteCtx) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const { reportId } = await ctx.params;

    const existing = await prisma.mEReport.findUnique({
      where: { id: reportId },
      include: { project: { select: { companyId: true } } },
    });
    if (!existing || !tenant.companyIds.includes(existing.project.companyId)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    await prisma.mEReport.update({ where: { id: reportId }, data: { isActive: false } });
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('[siep/informes/[reportId] DELETE]', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
