export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getUserCompanyIds } from '@/lib/tenant';
import { prisma } from '@/lib/prisma';
import { saveLocalSiepFile, type SiepFileCategory } from '@/lib/siep/file-storage';

/** Upload directo a disco cuando S3 no está configurado (desarrollo local). */
export async function POST(req: NextRequest) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const form = await req.formData();
    const file = form.get('file');
    const projectId = String(form.get('projectId') || '').trim();
    const category = (String(form.get('category') || 'general') as SiepFileCategory);

    if (!file || !(file instanceof Blob)) {
      return NextResponse.json({ error: 'Archivo requerido' }, { status: 400 });
    }
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

    const fileName = file instanceof File ? file.name : 'upload.bin';
    const buf = Buffer.from(await file.arrayBuffer());
    if (buf.length > 50 * 1024 * 1024) {
      return NextResponse.json({ error: 'Máximo 50 MB' }, { status: 400 });
    }

    const cat: SiepFileCategory =
      category === 'guides' || category === 'reports' ? category : 'general';
    const cloud_storage_path = await saveLocalSiepFile(cat, projectId, buf, fileName);

    return NextResponse.json({ mode: 'local', cloud_storage_path });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Error interno';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
