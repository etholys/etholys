import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { resolveStudioCompanyId } from '@/lib/studio/access';
import type { StudioCanvasState } from '@/lib/studio/types';
import { normalizeStudioCanvas } from '@/lib/studio/types';
import { getDocumentAccess } from '@/lib/studio/share';
import {
  canChangeStudioVisibility,
  canDeleteStudioDocument,
  canEditStudioContent,
} from '@/lib/studio/share';

export const dynamic = 'force-dynamic';

async function authUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return null;
  return prisma.user.findUnique({ where: { email: session.user.email } });
}

/** GET /api/studio/documents/[id] */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await authUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const doc = await prisma.studioDocument.findFirst({ where: { id: params.id } });
  if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const access = await getDocumentAccess(user.id, doc);
  if (access === 'none') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  return NextResponse.json({
    document: {
      ...doc,
      canvasState: normalizeStudioCanvas(doc.canvasState),
    },
    access,
  });
}

/** PUT /api/studio/documents/[id] — save title/canvas/folder/visibility */
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await authUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const existing = await prisma.studioDocument.findFirst({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const access = await getDocumentAccess(user.id, existing);
  if (!canEditStudioContent(access)) {
    return NextResponse.json({ error: 'Sem permissão para editar' }, { status: 403 });
  }

  const data: {
    title?: string;
    canvasState?: StudioCanvasState;
    folderId?: string | null;
    status?: string;
    visibility?: string;
  } = {};

  if (typeof body.title === 'string' && body.title.trim()) data.title = body.title.trim();
  if (body.canvasState && typeof body.canvasState === 'object') {
    data.canvasState = normalizeStudioCanvas(body.canvasState);
  }
  if ('folderId' in body) {
    data.folderId = typeof body.folderId === 'string' && body.folderId ? body.folderId : null;
  }
  if (typeof body.status === 'string') data.status = body.status;
  if (
    (body.visibility === 'company' || body.visibility === 'private') &&
    canChangeStudioVisibility(access)
  ) {
    data.visibility = body.visibility;
  }

  // Snapshot antes de guardar canvas (histórico)
  if (data.canvasState && body.createVersion !== false) {
    try {
      await prisma.studioDocumentVersion.create({
        data: {
          documentId: existing.id,
          title: existing.title,
          canvasState: existing.canvasState as object,
          label: typeof body.versionLabel === 'string' ? body.versionLabel : 'Antes de guardar',
          createdById: user.id,
        },
      });
    } catch (e) {
      console.warn('[studio] version snapshot skipped', e);
    }
  }

  const updated = await prisma.studioDocument.update({
    where: { id: existing.id },
    data,
  });

  return NextResponse.json({
    document: { ...updated, canvasState: normalizeStudioCanvas(updated.canvasState) },
    access,
  });
}

/** DELETE /api/studio/documents/[id] */
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await authUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const companyId = await resolveStudioCompanyId(
    user.id,
    req.nextUrl.searchParams.get('companyId'),
  );

  const existing = await prisma.studioDocument.findFirst({
    where: companyId ? { id: params.id, companyId } : { id: params.id },
  });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const access = await getDocumentAccess(user.id, existing);
  if (!canDeleteStudioDocument(access)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  await prisma.studioDocument.delete({ where: { id: existing.id } });
  return NextResponse.json({ ok: true });
}
