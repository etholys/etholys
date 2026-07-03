export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserCompanyIds } from '@/lib/tenant';
import { loadFileBuffer } from '@/lib/siep/file-storage';
import {
  detectCanvasFormat,
  parseReportTemplate,
} from '@/lib/siep/report-template-parse';

export async function POST(req: Request) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const body = await req.json();
    const projectId = String(body.projectId || '');
    const cloudStoragePath = String(body.cloudStoragePath || '');
    const templateFileName = String(body.templateFileName || '');

    if (!projectId || !cloudStoragePath || !templateFileName) {
      return NextResponse.json({ error: 'Campos obrigatórios em falta' }, { status: 400 });
    }

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { companyId: true },
    });
    if (!project || !tenant.companyIds.includes(project.companyId)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const buffer = await loadFileBuffer(cloudStoragePath);
    const canvasState = await parseReportTemplate(
      buffer,
      templateFileName,
      'parse-preview',
      body.mimeType,
    );

    return NextResponse.json({
      canvasState,
      canvasFormat: canvasState.format || detectCanvasFormat(templateFileName, body.mimeType) || 'docx',
      fieldCount: canvasState.regions.length,
    });
  } catch (error: unknown) {
    console.error('[siep/informes/templates/parse POST]', error);
    const msg = error instanceof Error ? error.message : 'Error interno';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
