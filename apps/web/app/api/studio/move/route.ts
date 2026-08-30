import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { resolveStudioCompanyId } from '@/lib/studio/access';
import { studioFolderIsDescendantOf } from '@/lib/studio/move-items';
import {
  canCreateStudioContent,
  canEditStudioContent,
  getDocumentAccess,
  getFolderAccess,
} from '@/lib/studio/share';

export const dynamic = 'force-dynamic';

async function authUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return null;
  return prisma.user.findUnique({ where: { email: session.user.email } });
}

/** POST /api/studio/move — mover pastas e/ou documentos para outra pasta (ou raiz). */
export async function POST(req: NextRequest) {
  const user = await authUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const folderIds = Array.isArray(body.folderIds)
    ? body.folderIds.filter((x): x is string => typeof x === 'string' && x.length > 0)
    : [];
  const documentIds = Array.isArray(body.documentIds)
    ? body.documentIds.filter((x): x is string => typeof x === 'string' && x.length > 0)
    : [];

  if (!folderIds.length && !documentIds.length) {
    return NextResponse.json({ error: 'Nothing to move' }, { status: 400 });
  }

  const targetFolderId =
    typeof body.targetFolderId === 'string' && body.targetFolderId.trim()
      ? body.targetFolderId.trim()
      : null;

  let companyId = await resolveStudioCompanyId(
    user.id,
    typeof body.companyId === 'string' ? body.companyId : null,
  );

  if (targetFolderId) {
    const target = await prisma.studioFolder.findFirst({ where: { id: targetFolderId } });
    if (!target) return NextResponse.json({ error: 'Target folder not found' }, { status: 404 });
    companyId = target.companyId;
    const targetAccess = await getFolderAccess(user.id, target);
    if (!canCreateStudioContent(targetAccess)) {
      return NextResponse.json({ error: 'Sem permissão para mover para esta pasta' }, { status: 403 });
    }
  }

  if (!companyId) return NextResponse.json({ error: 'No company' }, { status: 400 });

  for (const fid of folderIds) {
    if (targetFolderId && (fid === targetFolderId || (await studioFolderIsDescendantOf(targetFolderId, fid)))) {
      return NextResponse.json({ error: 'Cannot move folder into itself or a subfolder' }, { status: 400 });
    }
    const folder = await prisma.studioFolder.findFirst({ where: { id: fid, companyId } });
    if (!folder) return NextResponse.json({ error: `Folder not found: ${fid}` }, { status: 404 });
    const access = await getFolderAccess(user.id, folder);
    if (!canEditStudioContent(access)) {
      return NextResponse.json({ error: 'Sem permissão para mover pasta' }, { status: 403 });
    }
  }

  for (const did of documentIds) {
    const doc = await prisma.studioDocument.findFirst({ where: { id: did, companyId } });
    if (!doc) return NextResponse.json({ error: `Document not found: ${did}` }, { status: 404 });
    const access = await getDocumentAccess(user.id, doc);
    if (!canEditStudioContent(access)) {
      return NextResponse.json({ error: 'Sem permissão para mover documento' }, { status: 403 });
    }
  }

  await prisma.$transaction([
    ...folderIds.map((id) =>
      prisma.studioFolder.update({
        where: { id },
        data: { parentId: targetFolderId },
      }),
    ),
    ...documentIds.map((id) =>
      prisma.studioDocument.update({
        where: { id },
        data: { folderId: targetFolderId },
      }),
    ),
  ]);

  return NextResponse.json({
    ok: true,
    moved: { folders: folderIds.length, documents: documentIds.length, targetFolderId },
  });
}
