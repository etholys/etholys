export const dynamic = 'force-dynamic';

import fs from 'node:fs/promises';
import path from 'node:path';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserCompanyIds } from '@/lib/tenant';
import { deleteFile, getFileUrl } from '@/lib/s3';

async function loadOwnedFile(taskId: string, fileId: string, companyIds: string[]) {
  const task = await prisma.task.findFirst({
    where: { id: taskId, isActive: true },
    include: { project: { select: { companyId: true } } },
  });
  if (!task) return null;
  const companyId = task.project?.companyId || task.companyId;
  if (!companyId || !companyIds.includes(companyId)) return null;
  const file = await prisma.attachment.findFirst({ where: { id: fileId, taskId } });
  if (!file) return null;
  return file;
}

export async function GET(_req: Request, { params }: { params: { taskId: string; fileId: string } }) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const file = await loadOwnedFile(params.taskId, params.fileId, tenant.companyIds);
    if (!file) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

    if (file.cloudStoragePath.startsWith('uploads/work/')) {
      const abs = path.join(process.cwd(), 'public', file.cloudStoragePath);
      const buf = await fs.readFile(abs);
      return new NextResponse(new Uint8Array(buf), {
        headers: {
          'Content-Type': file.fileType || 'application/octet-stream',
          'Content-Disposition': `attachment; filename="${file.fileName.replace(/"/g, '')}"`,
        },
      });
    }
    const url = await getFileUrl(file.cloudStoragePath, false);
    return NextResponse.redirect(url);
  } catch (error: unknown) {
    console.error('Task file download error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: { taskId: string; fileId: string } }) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const file = await loadOwnedFile(params.taskId, params.fileId, tenant.companyIds);
    if (!file) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
    await prisma.attachment.delete({ where: { id: file.id } });
    if (!file.cloudStoragePath.startsWith('uploads/work/')) {
      try {
        await deleteFile(file.cloudStoragePath);
      } catch {
        /* the row is already gone */
      }
    }
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('Task file delete error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
