export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

// GET - get current user profile
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, name: true, email: true, role: true, phone: true, avatar: true, locale: true, createdAt: true },
    });
    if (!user) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
    return NextResponse.json({ user });
  } catch (error: any) {
    console.error('Account GET error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

// PUT - update profile
export async function PUT(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const body = await req.json();
    const data: any = {};
    if (body.name) data.name = body.name;
    if (body.phone !== undefined) data.phone = body.phone;
    if (body.locale) data.locale = body.locale;
    if (body.newPassword && body.currentPassword) {
      const user = await prisma.user.findUnique({ where: { id: session.user.id } });
      if (!user?.password) return NextResponse.json({ error: 'Cuenta sin contraseña local' }, { status: 400 });
      const valid = await bcrypt.compare(body.currentPassword, user.password);
      if (!valid) return NextResponse.json({ error: 'Contraseña actual incorrecta' }, { status: 400 });
      data.password = await bcrypt.hash(body.newPassword, 10);
    }
    const user = await prisma.user.update({ where: { id: session.user.id }, data });
    return NextResponse.json({ user: { id: user.id, name: user.name, email: user.email } });
  } catch (error: any) {
    console.error('Account PUT error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

// DELETE - delete own account
export async function DELETE(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    
    const body = await req.json().catch(() => ({}));
    
    // Require confirmation text
    if (body.confirm !== 'ELIMINAR') {
      return NextResponse.json({ error: 'Confirmación requerida: escriba ELIMINAR' }, { status: 400 });
    }
    
    // Delete the user (cascades will clean up related data)
    await prisma.user.delete({ where: { id: session.user.id } });
    
    return NextResponse.json({ success: true, message: 'Cuenta eliminada exitosamente' });
  } catch (error: any) {
    console.error('Account DELETE error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
