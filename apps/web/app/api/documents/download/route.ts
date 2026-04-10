export const dynamic = 'force-dynamic';

import { NextResponse, NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserCompanyIds } from '@/lib/tenant';
import { getFileUrl } from '@/lib/s3';

export async function GET(req: NextRequest) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const path = searchParams.get('path');
    const isPublicParam = searchParams.get('isPublic');

    // Direct path mode (for chat attachments)
    if (path) {
      const isPublic = isPublicParam === 'true';
      const url = await getFileUrl(path, isPublic);
      return NextResponse.json({ url });
    }

    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const doc = await prisma.document.findUnique({ where: { id } });
    if (!doc || !tenant.companyIds.includes(doc.companyId)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const url = await getFileUrl(doc.cloudStoragePath, doc.isPublic);
    return NextResponse.json({ url });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
