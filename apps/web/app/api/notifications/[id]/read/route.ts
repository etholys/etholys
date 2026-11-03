export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { markNotificationsRead } from '@/lib/notify';

/** POST /api/notifications/:id/read — mark one as read (Forge bell compat). */
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const user = await prisma.user.findUnique({ where: { email: session.user.email } });
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    await markNotificationsRead({ userId: user.id, id: params.id });
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('Notification read error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
