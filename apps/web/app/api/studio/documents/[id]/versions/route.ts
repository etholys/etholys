import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import {
  canEditStudioContent,
  canReadStudio,
  getDocumentAccess,
} from '@/lib/studio/share';
import { normalizeStudioCanvas, type StudioCanvasState } from '@/lib/studio/types';

export const dynamic = 'force-dynamic';

async function authUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return null;
  return prisma.user.findUnique({ where: { email: session.user.email } });
}

/** GET /api/studio/documents/[id]/versions */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await authUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const doc = await prisma.studioDocument.findFirst({ where: { id: params.id } });
  if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const access = await getDocumentAccess(user.id, doc);
  if (!canReadStudio(access)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const versions = await prisma.studioDocumentVersion.findMany({
    where: { documentId: doc.id },
    orderBy: { createdAt: 'desc' },
    take: 40,
    select: {
      id: true,
      title: true,
      label: true,
      createdAt: true,
      createdById: true,
    },
  });
  return NextResponse.json({ versions });
}

/** POST /api/studio/documents/[id]/versions — { action: 'snapshot'|'restore', versionId?, label?, canvasState?, title? } */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await authUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const doc = await prisma.studioDocument.findFirst({ where: { id: params.id } });
  if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const access = await getDocumentAccess(user.id, doc);
  if (!canEditStudioContent(access)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const action = body.action === 'restore' ? 'restore' : 'snapshot';

  if (action === 'restore') {
    const versionId = typeof body.versionId === 'string' ? body.versionId : '';
    const ver = await prisma.studioDocumentVersion.findFirst({
      where: { id: versionId, documentId: doc.id },
    });
    if (!ver) return NextResponse.json({ error: 'Version not found' }, { status: 404 });

    // Snapshot actual before restore
    await prisma.studioDocumentVersion.create({
      data: {
        documentId: doc.id,
        title: doc.title,
        canvasState: doc.canvasState as object,
        label: 'Antes de restaurar',
        createdById: user.id,
      },
    });

    const canvas = normalizeStudioCanvas(ver.canvasState);
    const updated = await prisma.studioDocument.update({
      where: { id: doc.id },
      data: { title: ver.title, canvasState: canvas },
    });
    return NextResponse.json({
      document: { id: updated.id, title: updated.title, canvasState: canvas },
      restoredFrom: ver.id,
    });
  }

  const canvas =
    body.canvasState && typeof body.canvasState === 'object'
      ? normalizeStudioCanvas(body.canvasState)
      : normalizeStudioCanvas(doc.canvasState);
  const title =
    typeof body.title === 'string' && body.title.trim()
      ? body.title.trim()
      : doc.title;
  const label = typeof body.label === 'string' ? body.label.trim() : null;

  const ver = await prisma.studioDocumentVersion.create({
    data: {
      documentId: doc.id,
      title,
      canvasState: canvas as object,
      label: label || 'Snapshot',
      createdById: user.id,
    },
    select: { id: true, title: true, label: true, createdAt: true },
  });

  return NextResponse.json({ version: ver }, { status: 201 });
}
