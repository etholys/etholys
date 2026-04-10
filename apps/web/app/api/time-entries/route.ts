export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const body = await req.json();
    const { taskId, hours, description, date } = body;
    if (!taskId || !hours) return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 });
    const userId = (session.user as any).id;
    const entry = await prisma.timeEntry.create({
      data: { taskId, userId, hours: parseFloat(hours), description: description || '', date: date ? new Date(date) : new Date() },
      include: { user: true },
    });
    return NextResponse.json({ entry });
  } catch (error: any) {
    console.error('Create time entry error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 });
    await prisma.timeEntry.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Delete time entry error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
