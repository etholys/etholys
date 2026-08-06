import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { resolveStudioCompanyId } from '@/lib/studio/access';
import {
  buildStudioShareUrl,
  canManageStudioShares,
  createStudioShare,
  getDocumentAccess,
  getFolderAccess,
  isCompanyMember,
  listCompanyMembersForShare,
  parseStudioShareRole,
  updateStudioShareRole,
} from '@/lib/studio/share';

export const dynamic = 'force-dynamic';

async function authUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return null;
  return prisma.user.findUnique({ where: { email: session.user.email } });
}

async function assertCanManageTarget(
  userId: string,
  companyId: string,
  folderId: string | null,
  documentId: string | null,
): Promise<
  | { ok: true; access: Awaited<ReturnType<typeof getFolderAccess>>; visibility: string }
  | { ok: false; error: NextResponse }
> {
  if (folderId) {
    const folder = await prisma.studioFolder.findFirst({ where: { id: folderId, companyId } });
    if (!folder) return { ok: false, error: NextResponse.json({ error: 'Not found' }, { status: 404 }) };
    const access = await getFolderAccess(userId, folder);
    if (!canManageStudioShares(access)) {
      return {
        ok: false,
        error: NextResponse.json({ error: 'Sem permissão para gerir partilhas' }, { status: 403 }),
      };
    }
    return { ok: true, access, visibility: folder.visibility };
  }
  if (documentId) {
    const doc = await prisma.studioDocument.findFirst({ where: { id: documentId, companyId } });
    if (!doc) return { ok: false, error: NextResponse.json({ error: 'Not found' }, { status: 404 }) };
    const access = await getDocumentAccess(userId, doc);
    if (!canManageStudioShares(access)) {
      return {
        ok: false,
        error: NextResponse.json({ error: 'Sem permissão para gerir partilhas' }, { status: 403 }),
      };
    }
    return { ok: true, access, visibility: doc.visibility };
  }
  return {
    ok: false,
    error: NextResponse.json({ error: 'folderId or documentId required' }, { status: 400 }),
  };
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

  const gate = await assertCanManageTarget(user.id, companyId, folderId, documentId);
  if (!gate.ok) return gate.error;

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
      token: true,
      user: { select: { id: true, name: true } },
    },
  });

  const withUrls = shares.map(({ token, ...rest }) => ({
    ...rest,
    inviteUrl: buildStudioShareUrl(token),
  }));

  return NextResponse.json({
    shares: withUrls,
    visibility: gate.visibility,
    access: gate.access,
    canChangeVisibility: gate.access === 'owner',
  });
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
  const role = parseStudioShareRole(body.role, 'editor');
  const forceExternal = body.forceExternal === true;
  const sendEmail = body.sendEmail !== false;
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
      if (!canManageStudioShares(access)) {
        return NextResponse.json({ error: 'Sem permissão para partilhar' }, { status: 403 });
      }

      const result = await createStudioShare({
        companyId,
        invitedById: user.id,
        targetType: 'folder',
        folderId,
        email,
        role,
        forceExternal,
        sendEmail,
      });
      return NextResponse.json(result, { status: 201 });
    }

    const doc = await prisma.studioDocument.findFirst({
      where: { id: documentId!, companyId },
    });
    if (!doc) return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    const access = await getDocumentAccess(user.id, doc);
    if (!canManageStudioShares(access)) {
      return NextResponse.json({ error: 'Sem permissão para partilhar' }, { status: 403 });
    }

    const result = await createStudioShare({
      companyId,
      invitedById: user.id,
      targetType: 'document',
      documentId: doc.id,
      email,
      role,
      forceExternal,
      sendEmail,
    });
    return NextResponse.json(result, { status: 201 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[POST /api/studio/shares]', e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/** PATCH /api/studio/shares — alterar papel { id, role } */
export async function PATCH(req: NextRequest) {
  const user = await authUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const id = typeof body.id === 'string' ? body.id : '';
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const companyId = await resolveStudioCompanyId(
    user.id,
    typeof body.companyId === 'string' ? body.companyId : null,
  );
  if (!companyId) return NextResponse.json({ error: 'No company' }, { status: 400 });

  const share = await prisma.studioShare.findFirst({ where: { id, companyId, status: 'active' } });
  if (!share) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const gate = await assertCanManageTarget(user.id, companyId, share.folderId, share.documentId);
  if (!gate.ok) return gate.error;

  const role = parseStudioShareRole(body.role);
  const updated = await updateStudioShareRole(share.id, role);
  const { token, ...rest } = updated;
  return NextResponse.json({
    share: {
      ...rest,
      inviteUrl: buildStudioShareUrl(token),
    },
  });
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
    const gate = await assertCanManageTarget(user.id, companyId, share.folderId, share.documentId);
    if (!gate.ok) return gate.error;
  }

  await prisma.studioShare.update({ where: { id: share.id }, data: { status: 'revoked' } });
  return NextResponse.json({ ok: true });
}
