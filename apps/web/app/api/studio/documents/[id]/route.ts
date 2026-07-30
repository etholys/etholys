import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { resolveStudioCompanyId } from '@/lib/studio/access';
import type { StudioCanvasState } from '@/lib/studio/types';

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

  const companyId = await resolveStudioCompanyId(
    user.id,
    req.nextUrl.searchParams.get('companyId'),
  );
  if (!companyId) return NextResponse.json({ error: 'No company' }, { status: 400 });

  const doc = await prisma.studioDocument.findFirst({
    where: { id: params.id, companyId },
  });
  if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json({
    document: {
      ...doc,
      canvasState: doc.canvasState as StudioCanvasState,
    },
  });
}

/** PUT /api/studio/documents/[id] — save title/canvas/folder */
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await authUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const companyId = await resolveStudioCompanyId(
    user.id,
    typeof body.companyId === 'string' ? body.companyId : null,
  );
  if (!companyId) return NextResponse.json({ error: 'No company' }, { status: 400 });

  const existing = await prisma.studioDocument.findFirst({
    where: { id: params.id, companyId },
  });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const data: {
    title?: string;
    canvasState?: StudioCanvasState;
    folderId?: string | null;
    status?: string;
  } = {};

  if (typeof body.title === 'string' && body.title.trim()) data.title = body.title.trim();
  if (body.canvasState && typeof body.canvasState === 'object') {
    data.canvasState = body.canvasState as StudioCanvasState;
  }
  if ('folderId' in body) {
    data.folderId = typeof body.folderId === 'string' && body.folderId ? body.folderId : null;
  }
  if (typeof body.status === 'string') data.status = body.status;

  const updated = await prisma.studioDocument.update({
    where: { id: existing.id },
    data,
  });

  return NextResponse.json({ document: updated });
}

/** DELETE /api/studio/documents/[id] */
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await authUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const companyId = await resolveStudioCompanyId(
    user.id,
    req.nextUrl.searchParams.get('companyId'),
  );
  if (!companyId) return NextResponse.json({ error: 'No company' }, { status: 400 });

  const existing = await prisma.studioDocument.findFirst({
    where: { id: params.id, companyId },
  });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await prisma.studioDocument.delete({ where: { id: existing.id } });
  return NextResponse.json({ ok: true });
}
