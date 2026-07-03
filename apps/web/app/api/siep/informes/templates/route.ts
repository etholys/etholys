export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserCompanyIds } from '@/lib/tenant';
import {
  listProjectInformeTemplates,
  saveProjectInformeTemplate,
} from '@/lib/siep/informe-template-store';
import { normalizeInformeDomain } from '@/lib/siep/informe-domains';

export async function GET(req: Request) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get('projectId');
    const domain = normalizeInformeDomain(searchParams.get('domain'));
    if (!projectId) return NextResponse.json({ error: 'projectId requerido' }, { status: 400 });

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { companyId: true },
    });
    if (!project || !tenant.companyIds.includes(project.companyId)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const templates = await listProjectInformeTemplates(projectId, domain);
    return NextResponse.json({ templates });
  } catch (error: unknown) {
    console.error('[siep/informes/templates GET]', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const body = await req.json();
    const projectId = String(body.projectId || '');
    const domain = normalizeInformeDomain(body.domain);
    const fileName = String(body.templateFileName || body.fileName || '');
    const cloudStoragePath = body.cloudStoragePath ? String(body.cloudStoragePath) : '';
    const canvasState = body.canvasState;
    const canvasFormat = String(body.canvasFormat || 'docx');
    const replaceFileId = body.replaceFileId ? String(body.replaceFileId) : undefined;
    const blankTemplate = Boolean(body.blankTemplate);

    if (!projectId || !fileName || !canvasState) {
      return NextResponse.json({ error: 'Campos obrigatórios em falta' }, { status: 400 });
    }
    if (!blankTemplate && !cloudStoragePath) {
      return NextResponse.json({ error: 'cloudStoragePath obrigatório para modelos importados' }, { status: 400 });
    }

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { companyId: true },
    });
    if (!project || !tenant.companyIds.includes(project.companyId)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const template = await saveProjectInformeTemplate({
      projectId,
      domain,
      fileName,
      cloudStoragePath: cloudStoragePath || `blank://${projectId}/${domain}/${Date.now()}`,
      mimeType: body.mimeType || (blankTemplate ? 'application/x-etholys-blank' : undefined),
      fileSizeBytes: body.fileSizeBytes,
      canvasState,
      canvasFormat,
      replaceFileId,
    });

    return NextResponse.json({ template });
  } catch (error: unknown) {
    console.error('[siep/informes/templates POST]', error);
    const msg = error instanceof Error ? error.message : 'Error interno';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
