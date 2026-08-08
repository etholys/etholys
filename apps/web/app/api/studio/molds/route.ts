import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { resolveStudioCompanyId } from '@/lib/studio/access';
import { isCompanyMember } from '@/lib/studio/share';
import { isStudioPageSize } from '@/lib/studio/types';
import { createS3Client, getBucketConfig } from '@/lib/aws-config';
import { isS3Configured } from '@/lib/siep/file-storage';
import { PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import fs from 'node:fs/promises';
import path from 'node:path';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

async function authUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return null;
  return prisma.user.findUnique({ where: { email: session.user.email } });
}

async function withImageUrl(mold: {
  id: string;
  name: string;
  pageSize: string;
  imagePath: string;
  notes: string | null;
  createdAt: Date;
}) {
  let imageUrl = mold.imagePath;
  if (mold.imagePath.startsWith('uploads/studio-molds/')) {
    imageUrl = `/${mold.imagePath}`;
  } else if (isS3Configured()) {
    try {
      const s3 = createS3Client();
      const { bucketName } = getBucketConfig();
      imageUrl = await getSignedUrl(
        s3,
        new GetObjectCommand({ Bucket: bucketName, Key: mold.imagePath }),
        { expiresIn: 3600 },
      );
    } catch {
      /* keep path */
    }
  }
  return { ...mold, imageUrl };
}

/** GET /api/studio/molds?companyId= */
export async function GET(req: NextRequest) {
  const user = await authUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const companyId = await resolveStudioCompanyId(
    user.id,
    req.nextUrl.searchParams.get('companyId'),
  );
  if (!companyId) return NextResponse.json({ error: 'No company' }, { status: 400 });

  const molds = await prisma.studioPageMold.findMany({
    where: { companyId },
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      name: true,
      pageSize: true,
      imagePath: true,
      notes: true,
      createdAt: true,
    },
  });
  const withUrls = await Promise.all(molds.map((m) => withImageUrl(m)));
  return NextResponse.json({ molds: withUrls });
}

/** POST multipart: file, companyId, name, pageSize?, notes? */
export async function POST(req: NextRequest) {
  const user = await authUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: 'multipart required' }, { status: 400 });

  const file = form.get('file');
  if (!(file instanceof File)) return NextResponse.json({ error: 'file required' }, { status: 400 });

  const name =
    (typeof form.get('name') === 'string' && String(form.get('name')).trim()) ||
    file.name ||
    'Molde';
  const pageSizeRaw = typeof form.get('pageSize') === 'string' ? String(form.get('pageSize')) : 'A4';
  const pageSize = isStudioPageSize(pageSizeRaw) ? pageSizeRaw : 'A4';
  const notes = typeof form.get('notes') === 'string' ? String(form.get('notes')).trim() : null;
  const companyId = await resolveStudioCompanyId(
    user.id,
    typeof form.get('companyId') === 'string' ? String(form.get('companyId')) : null,
  );
  if (!companyId) return NextResponse.json({ error: 'No company' }, { status: 400 });
  if (!(await isCompanyMember(user.id, companyId))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  if (buffer.length > 15 * 1024 * 1024) {
    return NextResponse.json({ error: 'Ficheiro demasiado grande (máx. 15 MB)' }, { status: 400 });
  }

  const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 160) || 'mold.png';
  let imagePath: string;
  if (isS3Configured()) {
    const s3 = createS3Client();
    const { bucketName, folderPrefix } = getBucketConfig();
    imagePath = `${folderPrefix}studio-molds/${companyId}/${Date.now()}-${safe}`;
    await s3.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: imagePath,
        Body: buffer,
        ContentType: file.type || 'image/png',
      }),
    );
  } else {
    imagePath = `uploads/studio-molds/${companyId}/${Date.now()}-${safe}`;
    const abs = path.join(process.cwd(), 'public', imagePath);
    await fs.mkdir(path.dirname(abs), { recursive: true });
    await fs.writeFile(abs, buffer);
  }

  const mold = await prisma.studioPageMold.create({
    data: {
      companyId,
      name,
      pageSize,
      imagePath,
      notes,
      createdById: user.id,
    },
  });

  return NextResponse.json({ mold: await withImageUrl(mold) }, { status: 201 });
}

/** DELETE /api/studio/molds?id= */
export async function DELETE(req: NextRequest) {
  const user = await authUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const mold = await prisma.studioPageMold.findFirst({ where: { id } });
  if (!mold) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!(await isCompanyMember(user.id, mold.companyId))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  await prisma.studioPageMold.delete({ where: { id: mold.id } });
  return NextResponse.json({ ok: true });
}
