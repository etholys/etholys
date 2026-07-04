export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { token?: string; password?: string };
    const token = body.token?.trim();
    const password = body.password;

    if (!token || !password || password.length < 8) {
      return NextResponse.json(
        { error: 'Token y contraseña (mín. 8 caracteres) requeridos' },
        { status: 400 }
      );
    }

    const vt = await prisma.verificationToken.findUnique({ where: { token } });
    if (!vt || vt.expires < new Date()) {
      return NextResponse.json({ error: 'Enlace inválido o expirado' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { email: vt.identifier } });
    if (!user || !user.isActive) {
      return NextResponse.json({ error: 'Cuenta no encontrada' }, { status: 404 });
    }

    const hash = await bcrypt.hash(password, 10);
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hash },
    });
    await prisma.verificationToken.delete({ where: { token } });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Reset password error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
