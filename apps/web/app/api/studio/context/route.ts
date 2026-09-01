import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { resolveStudioCompanyId } from '@/lib/studio/access';
import {
  canCreateStudioContent,
  canEditStudioContent,
  canReadStudio,
  getDocumentAccess,
  getFolderAccess,
} from '@/lib/studio/share';
import {
  createStudioContextAsset,
  deleteStudioContextAsset,
  listStudioContextAssets,
} from '@/lib/studio/context-assets';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

async function authUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return null;
  return prisma.user.findUnique({ where: { email: session.user.email } });
}

/** GET /api/studio/context?companyId=&folderId=|&documentId= */
export async function GET(req: NextRequest) {
  const user = await authUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const folderId = req.nextUrl.searchParams.get('folderId');
  const documentId = req.nextUrl.searchParams.get('documentId');
  if (!folderId && !documentId) {
    return NextResponse.json({ error: 'folderId or documentId required' }, { status: 400 });
  }

  let companyId = await resolveStudioCompanyId(user.id, req.nextUrl.searchParams.get('companyId'));

  if (folderId) {
    const folder = await prisma.studioFolder.findFirst({ where: { id: folderId } });
    if (!folder) return NextResponse.json({ error: 'Folder not found' }, { status: 404 });
    const access = await getFolderAccess(user.id, folder);
    if (!canReadStudio(access)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    companyId = folder.companyId;
  } else if (documentId) {
    const doc = await prisma.studioDocument.findFirst({ where: { id: documentId } });
    if (!doc) return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    const access = await getDocumentAccess(user.id, doc);
    if (!canReadStudio(access)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    companyId = doc.companyId;
  }

  if (!companyId) return NextResponse.json({ error: 'No company' }, { status: 400 });

  const assets = await listStudioContextAssets({
    companyId,
    folderId,
    documentId,
  });
  return NextResponse.json({ assets, companyId });
}

/** POST /api/studio/context — multipart: file, companyId?, folderId|documentId, label? */
export async function POST(req: NextRequest) {
  try {
  const user = await authUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: 'multipart required' }, { status: 400 });

  const file = form.get('file');
  if (!(file instanceof File)) return NextResponse.json({ error: 'file required' }, { status: 400 });

  const folderId = typeof form.get('folderId') === 'string' ? String(form.get('folderId')) : null;
  const documentId = typeof form.get('documentId') === 'string' ? String(form.get('documentId')) : null;
  const label = typeof form.get('label') === 'string' ? String(form.get('label')).trim() : null;
  const requestedCompany =
    typeof form.get('companyId') === 'string' ? String(form.get('companyId')) : null;

  if (!folderId && !documentId) {
    return NextResponse.json({ error: 'folderId or documentId required' }, { status: 400 });
  }

  let companyId = await resolveStudioCompanyId(user.id, requestedCompany);
  let scope: 'folder' | 'document' = 'folder';

  if (folderId) {
    const folder = await prisma.studioFolder.findFirst({ where: { id: folderId } });
    if (!folder) return NextResponse.json({ error: 'Folder not found' }, { status: 404 });
    const access = await getFolderAccess(user.id, folder);
    if (!canCreateStudioContent(access)) {
      return NextResponse.json({ error: 'Sem permissão para adicionar contexto' }, { status: 403 });
    }
    companyId = folder.companyId;
    scope = 'folder';
  } else if (documentId) {
    const doc = await prisma.studioDocument.findFirst({ where: { id: documentId } });
    if (!doc) return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    const access = await getDocumentAccess(user.id, doc);
    if (!canEditStudioContent(access)) {
      return NextResponse.json({ error: 'Sem permissão para anexar' }, { status: 403 });
    }
    companyId = doc.companyId;
    scope = 'document';
  }

  if (!companyId) return NextResponse.json({ error: 'No company' }, { status: 400 });

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const asset = await createStudioContextAsset({
      companyId,
      scope,
      folderId,
      documentId,
      file: {
        buffer,
        fileName: file.name || 'file',
        mimeType: file.type,
        size: file.size,
      },
      label,
      createdById: user.id,
    });
    return NextResponse.json({ asset }, { status: 201 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[POST /api/studio/context]', e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro ao carregar anexo.';
    console.error('[POST /api/studio/context] outer', e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/** DELETE /api/studio/context?id=&companyId= */
export async function DELETE(req: NextRequest) {
  const user = await authUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const row = await prisma.studioContextAsset.findFirst({ where: { id } });
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (row.folderId) {
    const folder = await prisma.studioFolder.findFirst({ where: { id: row.folderId } });
    if (!folder) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const access = await getFolderAccess(user.id, folder);
    if (!canCreateStudioContent(access)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  } else if (row.documentId) {
    const doc = await prisma.studioDocument.findFirst({ where: { id: row.documentId } });
    if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const access = await getDocumentAccess(user.id, doc);
    if (!canEditStudioContent(access)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  } else {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  await deleteStudioContextAsset(row.id, row.companyId);
  return NextResponse.json({ ok: true });
}
