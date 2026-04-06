export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no ambiguous chars
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

// GET: List all invites (Admin only)
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ invites: [] }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { role: true },
    });

    if (user?.role !== 'ADMIN') {
      return NextResponse.json({ invites: [] }, { status: 403 });
    }

    const invites = await prisma.labInvite.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        invitedBy: { select: { name: true } },
        user: { select: { name: true, email: true } },
      },
    });

    return NextResponse.json({ invites });
  } catch (error) {
    console.error('Lab invite list error:', error);
    return NextResponse.json({ invites: [] }, { status: 500 });
  }
}

// POST: Create a new invite (Admin only)
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const admin = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, role: true },
    });

    if (admin?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Solo administradores' }, { status: 403 });
    }

    const { email } = await req.json();
    if (!email) {
      return NextResponse.json({ error: 'Email requerido' }, { status: 400 });
    }

    // Check if there is already a pending invite for this email
    const existing = await prisma.labInvite.findFirst({
      where: { email: email.toLowerCase(), status: 'PENDING' },
    });
    if (existing) {
      return NextResponse.json({ error: 'Ya existe una invitaci\u00f3n pendiente para este correo', invite: existing });
    }

    // Generate unique code
    let code = generateCode();
    let attempts = 0;
    while (attempts < 10) {
      const exists = await prisma.labInvite.findUnique({ where: { code } });
      if (!exists) break;
      code = generateCode();
      attempts++;
    }

    const invite = await prisma.labInvite.create({
      data: {
        email: email.toLowerCase(),
        code,
        invitedById: admin.id,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      },
    });

    return NextResponse.json({ invite });
  } catch (error) {
    console.error('Lab invite create error:', error);
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
  }
}

// DELETE: Revoke an invite (Admin only)
export async function DELETE(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const admin = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { role: true },
    });

    if (admin?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Solo administradores' }, { status: 403 });
    }

    const { id } = await req.json();
    if (!id) {
      return NextResponse.json({ error: 'ID requerido' }, { status: 400 });
    }

    await prisma.labInvite.update({
      where: { id },
      data: { status: 'REVOKED' },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Lab invite revoke error:', error);
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
  }
}
