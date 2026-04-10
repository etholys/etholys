export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, password, name, inviteCode } = body ?? {};
    if (!email || !password || !name) {
      return NextResponse.json({ error: 'Campos requeridos: email, password, name' }, { status: 400 });
    }
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: 'El email ya está registrado' }, { status: 400 });
    }
    const hashed = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { email, password: hashed, name, role: 'COLLABORATOR' },
    });
    // If invite code provided, accept it
    if (inviteCode) {
      const invitation = await prisma.invitation.findUnique({ where: { code: inviteCode } });
      if (invitation && invitation.status === 'pending') {
        const notExpired = !invitation.expiresAt || new Date() <= invitation.expiresAt;
        if (notExpired) {
          await prisma.companyUser.create({ data: { userId: user.id, companyId: invitation.companyId, role: invitation.role } });
          await prisma.invitation.update({ where: { id: invitation.id }, data: { status: 'accepted', acceptedAt: new Date() } });
        }
      }
    }
    return NextResponse.json({ success: true, userId: user.id });
  } catch (error: any) {
    console.error('Signup error:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
