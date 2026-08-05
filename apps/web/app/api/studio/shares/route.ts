import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { resolveStudioCompanyId } from '@/lib/studio/access';
import {
  createStudioShare,
  getDocumentAccess,
  getFolderAccess,
  isCompanyMember,
  listCompanyMembersForShare,
} from '@/lib/studio/share';

export const dynamic = 'force-dynamic';

async function authUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return null;
  return prisma.user.findUnique({ where: { email: session.user.email } });
}

/** GET /api/studio/shares?companyId=&folderId=|&documentId=&members=1 */
export async function GET(req: NextRequest) {
  const user = await authUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const companyId = await resolveStudioCompanyId(
    user.id,
    req.nextUrl.searchParams.get('companyId'),
  );
  if (!companyId) return NextResponse.json({ error: 'No company' }, { status: 400 });

  if (req.nextUrl.searchParams.get('members') === '1') {
    if (!(await isCompanyMember(user.id, companyId))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const members = await listCompanyMembersForShare(companyId);
    return NextResponse.json({ members });
  }

  const folderId = req.nextUrl.searchParams.get('folderId');
  const documentId = req.nextUrl.searchParams.get('documentId');

  let visibility = 'private';

  if (folderId) {
    const folder = await prisma.studioFolder.findFirst({ where: { id: folderId, companyId } });
    if (!folder) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if ((await getFolderAccess(user.id, folder)) !== 'owner') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    visibility = folder.visibility;
  } else if (documentId) {
    const doc = await prisma.studioDocument.findFirst({ where: { id: documentId, companyId } });
    if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if ((await getDocumentAccess(user.id, doc)) !== 'owner') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    visibility = doc.visibility;
  } else {
    return NextResponse.json({ error: 'folderId or documentId required' }, { status: 400 });
  }

  const shares = await prisma.studioShare.findMany({
    where: {
      companyId,
      status: 'active',
      ...(folderId ? { targetType: 'folder', folderId } : { targetType: 'document', documentId: documentId! }),
    },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      email: true,
      role: true,
      accessMode: true,
      status: true,
      createdAt: true,
      acceptedAt: true,
      expiresAt: true,
      user: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json({ shares, visibility });
}

/** POST /api/studio/shares — create share */
export async function POST(req: NextRequest) {
  const user = await authUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const companyId = await resolveStudioCompanyId(
    user.id,
    typeof body.companyId === 'string' ? body.companyId : null,
  );
  if (!companyId) return NextResponse.json({ error: 'No company' }, { status: 400 });

  const email = typeof body.email === 'string' ? body.email.trim() : '';
  const role = body.role === 'editor' ? 'editor' : 'viewer';
  const forceExternal = body.forceExternal === true;
  const folderId = typeof body.folderId === 'string' ? body.folderId : null;
  const documentId = typeof body.documentId === 'string' ? body.documentId : null;

  if (!email) return NextResponse.json({ error: 'Email required' }, { status: 400 });
  if (!folderId && !documentId) {
    return NextResponse.json({ error: 'folderId or documentId required' }, { status: 400 });
  }

  try {
    if (folderId) {
      const folder = await prisma.studioFolder.findFirst({ where: { id: folderId, companyId } });
      if (!folder) return NextResponse.json({ error: 'Folder not found' }, { status: 404 });
      const access = await getFolderAccess(user.id, folder);
      if (access !== 'owner') {
        return NextResponse.json({ error: 'Só o dono pode partilhar' }, { status: 403 });
      }

      const result = await createStudioShare({
        companyId,
        invitedById: user.id,
        targetType: 'folder',
        folderId,
        email,
        role,
        forceExternal,
      });
      return NextResponse.json(result, { status: 201 });
    }

    const doc = await prisma.studioDocument.findFirst({
      where: { id: documentId!, companyId },
    });
    if (!doc) return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    const access = await getDocumentAccess(user.id, doc);
    if (access !== 'owner') {
      return NextResponse.json({ error: 'Só o dono pode partilhar' }, { status: 403 });
    }

    const result = await createStudioShare({
      companyId,
      invitedById: user.id,
      targetType: 'document',
      documentId: doc.id,
      email,
      role,
      forceExternal,
    });
    return NextResponse.json(result, { status: 201 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[POST /api/studio/shares]', e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/** DELETE /api/studio/shares?id= */
export async function DELETE(req: NextRequest) {
  const user = await authUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const companyId = await resolveStudioCompanyId(
    user.id,
    req.nextUrl.searchParams.get('companyId'),
  );
  if (!companyId) return NextResponse.json({ error: 'No company' }, { status: 400 });

  const share = await prisma.studioShare.findFirst({ where: { id, companyId } });
  if (!share) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (share.invitedById !== user.id) {
    // allow owner of target
    if (share.folderId) {
      const f = await prisma.studioFolder.findUnique({ where: { id: share.folderId } });
      if (f?.createdById !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    } else if (share.documentId) {
      const d = await prisma.studioDocument.findUnique({ where: { id: share.documentId } });
      if (d?.createdById !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    } else {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  await prisma.studioShare.update({ where: { id: share.id }, data: { status: 'revoked' } });
  return NextResponse.json({ ok: true });
}
