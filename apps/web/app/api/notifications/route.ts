export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { markNotificationsRead } from '@/lib/notify';

async function getUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return null;
  return prisma.user.findUnique({ where: { email: session.user.email } });
}

export async function GET(req: Request) {
  try {
    const user = await getUser();
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const { searchParams } = new URL(req.url);
    const unreadOnly = searchParams.get('unread') === 'true';
    const sinceRaw = searchParams.get('since');
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50', 10) || 50));
    const where: {
      userId: string;
      read?: boolean;
      createdAt?: { gt: Date };
    } = { userId: user.id };
    if (unreadOnly) where.read = false;
    if (sinceRaw) {
      const since = new Date(sinceRaw);
      if (!Number.isNaN(since.getTime())) where.createdAt = { gt: since };
    }
    const [notifications, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        select: {
          id: true,
          title: true,
          message: true,
          link: true,
          read: true,
          readAt: true,
          createdAt: true,
          type: true,
          companyId: true,
          taskId: true,
        },
      }),
      prisma.notification.count({ where: { userId: user.id, read: false } }),
    ]);
    return NextResponse.json({ notifications, unreadCount, serverTime: new Date().toISOString() });
  } catch (error: unknown) {
    console.error('Notifications GET error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const user = await getUser();
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const body = await req.json();
    const { id, markAllRead } = body;
    if (markAllRead) {
      await markNotificationsRead({ userId: user.id, markAll: true });
      return NextResponse.json({ success: true });
    }
    if (id) {
      await markNotificationsRead({ userId: user.id, id: String(id) });
      return NextResponse.json({ success: true });
    }
    return NextResponse.json({ error: 'ID requerido' }, { status: 400 });
  } catch (error: unknown) {
    console.error('Notifications PUT error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const user = await getUser();
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (id) {
      await prisma.notification.deleteMany({ where: { id, userId: user.id } });
    } else {
      await prisma.notification.deleteMany({ where: { userId: user.id, read: true } });
    }
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('Notifications DELETE error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
