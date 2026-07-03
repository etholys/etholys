export const dynamic = 'force-dynamic';

import { NextResponse, NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserCompanyIds } from '@/lib/tenant';
import { generatePresignedUploadUrl, getFileUrl, deleteFile } from '@/lib/s3';
import { isS3Configured, presignSiepUpload } from '@/lib/siep/file-storage';

export async function GET(req: NextRequest) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const { searchParams } = new URL(req.url);
    const companyId = searchParams.get('companyId');
    const category = searchParams.get('category');
    const projectId = searchParams.get('projectId');

    const where: any = {
      companyId: companyId && tenant.companyIds.includes(companyId) ? companyId : { in: tenant.companyIds },
      isActive: true,
    };
    if (category) where.category = category;
    if (projectId) where.projectId = projectId;

    const documents = await prisma.document.findMany({
      where,
      include: { company: { select: { name: true, shortName: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json({ documents });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// Step 1: Get presigned upload URL
export async function POST(req: NextRequest) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const body = await req.json();

    // If action=presign, return presigned URL for upload
    if (body.action === 'presign') {
      if (body.scope === 'siep') {
        const result = await presignSiepUpload(
          body.fileName,
          body.contentType || 'application/octet-stream',
        );
        return NextResponse.json(result);
      }
      if (!isS3Configured()) {
        return NextResponse.json(
          { error: 'Almacenamiento S3 no configurado (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_BUCKET_NAME)' },
          { status: 503 },
        );
      }
      const { uploadUrl, cloud_storage_path } = await generatePresignedUploadUrl(
        body.fileName,
        body.contentType || 'application/octet-stream',
        body.isPublic || false,
      );
      return NextResponse.json({ mode: 's3', uploadUrl, cloud_storage_path });
    }

    // Otherwise, create document record
    if (!tenant.companyIds.includes(body.companyId)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const doc = await prisma.document.create({
      data: {
        companyId: body.companyId,
        name: body.name || body.fileName,
        description: body.description || null,
        category: body.category || 'general',
        tags: body.tags || null,
        fileName: body.fileName,
        fileSize: body.fileSize || 0,
        fileType: body.fileType || '',
        cloudStoragePath: body.cloud_storage_path,
        isPublic: body.isPublic || false,
        uploadedBy: body.uploadedBy || null,
        projectId: body.projectId || null,
      },
      include: { company: { select: { name: true, shortName: true } } },
    });
    return NextResponse.json({ document: doc });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const body = await req.json();
    const existing = await prisma.document.findUnique({ where: { id: body.id } });
    if (!existing || !tenant.companyIds.includes(existing.companyId)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const doc = await prisma.document.update({
      where: { id: body.id },
      data: {
        name: body.name ?? existing.name,
        description: body.description !== undefined ? body.description : existing.description,
        category: body.category !== undefined ? body.category : existing.category,
        tags: body.tags !== undefined ? body.tags : existing.tags,
        projectId: body.projectId !== undefined ? body.projectId : existing.projectId,
      },
      include: { company: { select: { name: true, shortName: true } } },
    });
    return NextResponse.json({ document: doc });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    const existing = await prisma.document.findUnique({ where: { id } });
    if (!existing || !tenant.companyIds.includes(existing.companyId)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    // Delete from S3
    try { await deleteFile(existing.cloudStoragePath); } catch {}
    await prisma.document.update({ where: { id }, data: { isActive: false } });
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
