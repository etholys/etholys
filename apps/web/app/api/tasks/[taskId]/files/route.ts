export const dynamic = 'force-dynamic';

import fs from 'node:fs/promises';
import path from 'node:path';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserCompanyIds } from '@/lib/tenant';
import { createS3Client, getBucketConfig, isObjectStorageConfigured } from '@/lib/aws-config';

const MAX_BYTES = 8 * 1024 * 1024;

async function loadTask(taskId: string, companyIds: string[]) {
  const task = await prisma.task.findFirst({
    where: { id: taskId, isActive: true },
    include: { project: { select: { companyId: true } } },
  });
  if (!task) return null;
  const companyId = task.project?.companyId || task.companyId;
  if (!companyId || !companyIds.includes(companyId)) return null;
  return { task, companyId };
}

export async function GET(_req: Request, { params }: { params: { taskId: string } }) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const access = await loadTask(params.taskId, tenant.companyIds);
    if (!access) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
    const files = await prisma.attachment.findMany({
      where: { taskId: params.taskId },
      select: { id: true, fileName: true, fileSize: true, fileType: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json({ files });
  } catch (error: unknown) {
    console.error('Task files list error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function POST(req: Request, { params }: { params: { taskId: string } }) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const access = await loadTask(params.taskId, tenant.companyIds);
    if (!access) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

    const form = await req.formData();
    const file = form.get('file');
    if (!(file instanceof File)) return NextResponse.json({ error: 'file required' }, { status: 400 });
    if (file.size <= 0 || file.size > MAX_BYTES) {
      return NextResponse.json({ error: 'file too large' }, { status: 400 });
    }
    const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80) || 'file';
    const buffer = Buffer.from(await file.arrayBuffer());
    const keyTail = `work/${access.companyId}/${params.taskId}/${Date.now()}-${safe}`;
    let cloudStoragePath = `uploads/${keyTail}`;

    if (isObjectStorageConfigured()) {
      const { bucketName, folderPrefix } = getBucketConfig();
      cloudStoragePath = `${folderPrefix}${keyTail}`;
      await createS3Client().send(
        new PutObjectCommand({
          Bucket: bucketName,
          Key: cloudStoragePath,
          Body: buffer,
          ContentType: file.type || 'application/octet-stream',
        }),
      );
    } else {
      const abs = path.join(process.cwd(), 'public', cloudStoragePath);
      await fs.mkdir(path.dirname(abs), { recursive: true });
      await fs.writeFile(abs, buffer);
    }

    const saved = await prisma.attachment.create({
      data: {
        taskId: params.taskId,
        fileName: file.name.slice(0, 180),
        fileSize: file.size,
        fileType: file.type || 'application/octet-stream',
        cloudStoragePath,
      },
      select: { id: true, fileName: true, fileSize: true, fileType: true, createdAt: true },
    });
    return NextResponse.json({ file: saved });
  } catch (error: unknown) {
    console.error('Task file upload error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
