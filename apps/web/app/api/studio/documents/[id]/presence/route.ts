import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { canReadStudio, getDocumentAccess } from '@/lib/studio/share';

export const dynamic = 'force-dynamic';

const ACTIVE_MS = 45_000;

async function authUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return null;
  return prisma.user.findUnique({ where: { email: session.user.email } });
}

function initials(name: string | null, email: string) {
  const base = (name || email || '?').trim();
  const parts = base.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
  return base.slice(0, 2).toUpperCase();
}

/** GET /api/studio/documents/[id]/presence — quem está ativo */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
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
      updatedAt: true,
      updatedById: true,
      updatedBy: { select: { id: true, name: true, email: true } },
    },
  });
  if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const access = await getDocumentAccess(user.id, doc);
  if (!canReadStudio(access)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const since = new Date(Date.now() - ACTIVE_MS);
  let presence: Array<{
    userId: string;
    status: string;
    lastSeenAt: Date;
    user: { id: string; name: string | null; email: string };
  }> = [];

  try {
    // Limpeza leve de heartbeats antigos
    await prisma.studioDocumentPresence.deleteMany({
      where: { documentId: doc.id, lastSeenAt: { lt: new Date(Date.now() - 10 * 60_000) } },
    });

    const rows = await prisma.studioDocumentPresence.findMany({
      where: { documentId: doc.id, lastSeenAt: { gte: since } },
      orderBy: { lastSeenAt: 'desc' },
      include: { user: { select: { id: true, name: true, email: true } } },
    });

    // Agregar por utilizador (status editing ganha a viewing)
    const byUser = new Map<
      string,
      { userId: string; status: string; lastSeenAt: Date; user: { id: string; name: string | null; email: string } }
    >();
    for (const r of rows) {
      const prev = byUser.get(r.userId);
      if (!prev) {
        byUser.set(r.userId, {
          userId: r.userId,
          status: r.status,
          lastSeenAt: r.lastSeenAt,
          user: r.user,
        });
        continue;
      }
      if (r.status === 'editing' || prev.status !== 'editing') {
        byUser.set(r.userId, {
          userId: r.userId,
          status: r.status === 'editing' ? 'editing' : prev.status,
          lastSeenAt: r.lastSeenAt > prev.lastSeenAt ? r.lastSeenAt : prev.lastSeenAt,
          user: r.user,
        });
      }
    }
    presence = Array.from(byUser.values());
  } catch (e) {
    console.warn('[studio/presence] table missing?', e);
  }

  return NextResponse.json({
    presence: presence.map((p) => ({
      userId: p.userId,
      status: p.status,
      lastSeenAt: p.lastSeenAt,
      name: p.user.name,
      email: p.user.email,
      initials: initials(p.user.name, p.user.email),
      isSelf: p.userId === user.id,
    })),
    document: {
      updatedAt: doc.updatedAt,
      updatedById: doc.updatedById,
      updatedBy: doc.updatedBy,
    },
    selfUserId: user.id,
  });
}

/** POST /api/studio/documents/[id]/presence — heartbeat { clientId, status?, leave? } */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await authUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const doc = await prisma.studioDocument.findFirst({ where: { id: params.id } });
  if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const access = await getDocumentAccess(user.id, doc);
  if (!canReadStudio(access)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const clientId =
    typeof body.clientId === 'string' && body.clientId.trim()
      ? body.clientId.trim().slice(0, 64)
      : 'default';
  const leave = body.leave === true;
  const status = body.status === 'editing' ? 'editing' : 'viewing';

  try {
    if (leave) {
      await prisma.studioDocumentPresence.deleteMany({
        where: { documentId: doc.id, userId: user.id, clientId },
      });
      return NextResponse.json({ ok: true, left: true });
    }

    await prisma.studioDocumentPresence.upsert({
      where: {
        documentId_userId_clientId: {
          documentId: doc.id,
          userId: user.id,
          clientId,
        },
      },
      create: {
        documentId: doc.id,
        companyId: doc.companyId,
        userId: user.id,
        clientId,
        status,
        lastSeenAt: new Date(),
      },
      update: {
        status,
        lastSeenAt: new Date(),
        companyId: doc.companyId,
      },
    });

    return NextResponse.json({ ok: true, status });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn('[studio/presence] heartbeat failed', e);
    return NextResponse.json({ ok: false, error: msg }, { status: 503 });
  }
}
