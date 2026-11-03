export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { getVapidPublicKey } from '@/lib/web-push';

async function getUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return null;
  return prisma.user.findUnique({ where: { email: session.user.email } });
}

export async function POST(req: Request) {
  try {
    const user = await getUser();
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    if (!getVapidPublicKey()) {
      return NextResponse.json({ error: 'Web Push no configurado (VAPID)' }, { status: 503 });
    }

    const body = await req.json().catch(() => ({}));
    const endpoint = String(body?.endpoint || '').trim();
    const p256dh = String(body?.keys?.p256dh || body?.p256dh || '').trim();
    const auth = String(body?.keys?.auth || body?.auth || '').trim();
    if (!endpoint || !p256dh || !auth) {
      return NextResponse.json({ error: 'Suscripción incompleta' }, { status: 400 });
    }

    const userAgent = req.headers.get('user-agent')?.slice(0, 240) || null;

    await prisma.pushSubscription.upsert({
      where: { endpoint },
      create: {
        userId: user.id,
        endpoint,
        p256dh,
        auth,
        userAgent,
      },
      update: {
        userId: user.id,
        p256dh,
        auth,
        userAgent,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    console.error('Push subscribe error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const user = await getUser();
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const body = await req.json().catch(() => ({}));
    const endpoint = String(body?.endpoint || '').trim();
    if (!endpoint) return NextResponse.json({ error: 'endpoint requerido' }, { status: 400 });
    await prisma.pushSubscription.deleteMany({ where: { userId: user.id, endpoint } });
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    console.error('Push unsubscribe error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
