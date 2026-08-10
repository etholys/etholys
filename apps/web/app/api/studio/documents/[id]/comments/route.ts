import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { recordStudioActivity } from '@/lib/studio/activity';
import {
  canEditStudioContent,
  canReadStudio,
  getDocumentAccess,
} from '@/lib/studio/share';

export const dynamic = 'force-dynamic';

async function authUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return null;
  return prisma.user.findUnique({ where: { email: session.user.email } });
}

const commentSelect = {
  id: true,
  body: true,
  blockId: true,
  createdAt: true,
  updatedAt: true,
  resolvedAt: true,
  authorId: true,
  resolvedById: true,
  author: { select: { id: true, name: true, email: true } },
  resolvedBy: { select: { id: true, name: true, email: true } },
} as const;

/** GET /api/studio/documents/[id]/comments */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await authUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const doc = await prisma.studioDocument.findFirst({ where: { id: params.id } });
  if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const access = await getDocumentAccess(user.id, doc);
  if (!canReadStudio(access)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const includeResolved = req.nextUrl.searchParams.get('resolved') === '1';

  try {
    const comments = await prisma.studioDocumentComment.findMany({
      where: {
        documentId: doc.id,
        ...(includeResolved ? {} : { resolvedAt: null }),
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: commentSelect,
    });
    return NextResponse.json({ comments, openCount: comments.filter((c) => !c.resolvedAt).length });
  } catch (e) {
    console.warn('[studio/comments] table missing?', e);
    return NextResponse.json({ comments: [], openCount: 0 });
  }
}

/** POST /api/studio/documents/[id]/comments — { body, blockId? } */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await authUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const doc = await prisma.studioDocument.findFirst({ where: { id: params.id } });
  if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const access = await getDocumentAccess(user.id, doc);
  // Quem pode ler pode comentar (colaboração); viewers included
  if (!canReadStudio(access)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const text = typeof body.body === 'string' ? body.body.trim() : '';
  if (!text) return NextResponse.json({ error: 'body required' }, { status: 400 });
  if (text.length > 4000) {
    return NextResponse.json({ error: 'Comentário demasiado longo' }, { status: 400 });
  }
  const blockId = typeof body.blockId === 'string' && body.blockId ? body.blockId : null;

  try {
    const comment = await prisma.studioDocumentComment.create({
      data: {
        documentId: doc.id,
        companyId: doc.companyId,
        body: text,
        blockId,
        authorId: user.id,
      },
      select: commentSelect,
    });

    await recordStudioActivity({
      documentId: doc.id,
      companyId: doc.companyId,
      kind: 'comment',
      summary: `${user.name?.trim() || user.email} comentou${blockId ? ' num bloco' : ''}`,
      actorUserId: user.id,
      meta: { type: 'comment', commentId: comment.id, blockId },
    });

    return NextResponse.json({ comment }, { status: 201 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[POST comments]', e);
    return NextResponse.json({ error: 'Falha ao criar comentário', detail: msg }, { status: 503 });
  }
}

/** PATCH /api/studio/documents/[id]/comments — { id, resolve?: boolean, body?: string } */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await authUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const doc = await prisma.studioDocument.findFirst({ where: { id: params.id } });
  if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const access = await getDocumentAccess(user.id, doc);
  if (!canReadStudio(access)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const id = typeof body.id === 'string' ? body.id : '';
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const existing = await prisma.studioDocumentComment.findFirst({
    where: { id, documentId: doc.id },
  });
  if (!existing) return NextResponse.json({ error: 'Comment not found' }, { status: 404 });

  const data: {
    body?: string;
    resolvedAt?: Date | null;
    resolvedById?: string | null;
  } = {};

  if (typeof body.body === 'string') {
    if (existing.authorId !== user.id && !canEditStudioContent(access)) {
      return NextResponse.json({ error: 'Só o autor pode editar' }, { status: 403 });
    }
    const text = body.body.trim();
    if (!text) return NextResponse.json({ error: 'body required' }, { status: 400 });
    data.body = text.slice(0, 4000);
  }

  if (body.resolve === true) {
    data.resolvedAt = new Date();
    data.resolvedById = user.id;
  } else if (body.resolve === false) {
    data.resolvedAt = null;
    data.resolvedById = null;
  }

  const comment = await prisma.studioDocumentComment.update({
    where: { id },
    data,
    select: commentSelect,
  });
  return NextResponse.json({ comment });
}

/** DELETE /api/studio/documents/[id]/comments?commentId= */
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await authUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const doc = await prisma.studioDocument.findFirst({ where: { id: params.id } });
  if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const access = await getDocumentAccess(user.id, doc);
  if (!canReadStudio(access)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const commentId = req.nextUrl.searchParams.get('commentId')?.trim() || '';
  if (!commentId) return NextResponse.json({ error: 'commentId required' }, { status: 400 });

  const existing = await prisma.studioDocumentComment.findFirst({
    where: { id: commentId, documentId: doc.id },
  });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (existing.authorId !== user.id && !canEditStudioContent(access)) {
    return NextResponse.json({ error: 'Só o autor ou editor pode apagar' }, { status: 403 });
  }

  await prisma.studioDocumentComment.delete({ where: { id: commentId } });
  return NextResponse.json({ ok: true });
}
