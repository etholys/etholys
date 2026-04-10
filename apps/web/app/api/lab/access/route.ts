export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';

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

    // ADMIN always has access
    if (user.role === 'ADMIN') {
      return NextResponse.json({ hasAccess: true });
    }

    // Check for accepted invite
    const invite = await prisma.labInvite.findFirst({
      where: {
        OR: [
          { userId: user.id, status: 'ACCEPTED' },
          { email: user.email, status: 'ACCEPTED' },
        ],
      },
    });

    return NextResponse.json({ hasAccess: !!invite });
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
      return NextResponse.json({ success: false, error: 'C\u00f3digo requerido' });
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
      return NextResponse.json({ success: false, error: 'C\u00f3digo no v\u00e1lido' });
    }

    if (invite.status !== 'PENDING') {
      return NextResponse.json({ success: false, error: 'Invitaci\u00f3n ya utilizada o revocada' });
    }

    if (new Date() > invite.expiresAt) {
      return NextResponse.json({ success: false, error: 'Invitaci\u00f3n expirada' });
    }

    // Check email matches
    if (invite.email.toLowerCase() !== user.email.toLowerCase()) {
      return NextResponse.json({ success: false, error: 'Este c\u00f3digo no corresponde a tu correo' });
    }

    // Accept the invite
    await prisma.labInvite.update({
      where: { id: invite.id },
      data: { status: 'ACCEPTED', userId: user.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Lab access code error:', error);
    return NextResponse.json({ success: false, error: 'Error del servidor' }, { status: 500 });
  }
}
