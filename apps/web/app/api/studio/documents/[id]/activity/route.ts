import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { canReadStudio, getDocumentAccess } from '@/lib/studio/share';

export const dynamic = 'force-dynamic';

async function authUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return null;
  return prisma.user.findUnique({ where: { email: session.user.email } });
}

/** GET /api/studio/documents/[id]/activity — trilha quem/quando (IA + edições) */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await authUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const doc = await prisma.studioDocument.findFirst({
    where: { id: params.id },
    select: {
      id: true,
      companyId: true,
      createdById: true,
      folderId: true,
      visibility: true,
      updatedById: true,
      updatedAt: true,
      createdAt: true,
      createdBy: { select: { id: true, name: true, email: true } },
      updatedBy: { select: { id: true, name: true, email: true } },
    },
  });
  if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const access = await getDocumentAccess(user.id, doc);
  if (!canReadStudio(access)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const take = Math.min(100, Math.max(1, Number(req.nextUrl.searchParams.get('limit')) || 60));

  let activities: Array<{
    id: string;
    kind: string;
    summary: string;
    meta: unknown;
    createdAt: Date;
    actorUserId: string | null;
    actor: { id: string; name: string | null; email: string } | null;
  }> = [];

  try {
    activities = await prisma.studioDocumentActivity.findMany({
      where: { documentId: doc.id },
      orderBy: { createdAt: 'desc' },
      take,
      select: {
        id: true,
        kind: true,
        summary: true,
        meta: true,
        createdAt: true,
        actorUserId: true,
        actor: { select: { id: true, name: true, email: true } },
      },
    });
  } catch (e) {
    console.warn('[studio/activity] table missing?', e);
  }

  return NextResponse.json({
    document: {
      id: doc.id,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
      createdBy: doc.createdBy,
      updatedBy: doc.updatedBy,
    },
    activities,
  });
}
