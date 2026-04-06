export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';

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
    const limit = parseInt(searchParams.get('limit') || '50');
    const where: any = { userId: user.id };
    if (unreadOnly) where.read = false;
    const notifications = await prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    const unreadCount = await prisma.notification.count({ where: { userId: user.id, read: false } });
    return NextResponse.json({ notifications, unreadCount });
  } catch (error: any) {
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
      await prisma.notification.updateMany({ where: { userId: user.id, read: false }, data: { read: true } });
      return NextResponse.json({ success: true });
    }
    if (id) {
      await prisma.notification.update({ where: { id, userId: user.id }, data: { read: true } });
      return NextResponse.json({ success: true });
    }
    return NextResponse.json({ error: 'ID requerido' }, { status: 400 });
  } catch (error: any) {
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
      await prisma.notification.delete({ where: { id, userId: user.id } });
    } else {
      await prisma.notification.deleteMany({ where: { userId: user.id, read: true } });
    }
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Notifications DELETE error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
