export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { hasLabAccess } from '@/lib/lab/access';
import { isSystemAdmin } from '@/lib/platform-access';

// GET: Check if current user has Lab access
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ hasAccess: false }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, role: true, email: true },
    });

    if (!user) return NextResponse.json({ hasAccess: false });

    const ok = await hasLabAccess({ userId: user.id, email: user.email });
    return NextResponse.json({
      hasAccess: ok,
      isSystemAdmin: isSystemAdmin(user.email),
    });
  } catch (error) {
    console.error('Lab access check error:', error);
    return NextResponse.json({ hasAccess: false }, { status: 500 });
  }
}

// POST: Validate an invite code and grant access
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
    }

    const { code } = await req.json();
    if (!code) {
      return NextResponse.json({ success: false, error: 'Código requerido' });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, email: true },
    });

    if (!user) {
      return NextResponse.json({ success: false, error: 'Usuario no encontrado' });
    }

    const invite = await prisma.labInvite.findUnique({ where: { code: code.toUpperCase() } });

    if (!invite) {
      return NextResponse.json({ success: false, error: 'Código no válido' });
    }

    if (invite.status !== 'PENDING') {
      return NextResponse.json({ success: false, error: 'Invitación ya utilizada o revocada' });
    }

    if (new Date() > invite.expiresAt) {
      return NextResponse.json({ success: false, error: 'Invitación expirada' });
    }

    await prisma.labInvite.update({
      where: { id: invite.id },
      data: { status: 'ACCEPTED', userId: user.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Lab access POST error:', error);
    return NextResponse.json({ success: false, error: 'Error interno' }, { status: 500 });
  }
}
