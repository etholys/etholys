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
    const { projectId, name, description, dueDate } = body;
    if (!projectId || !name) return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 });
    const count = await prisma.milestone.count({ where: { projectId } });
    const milestone = await prisma.milestone.create({
      data: { projectId, name, description: description || '', dueDate: dueDate ? new Date(dueDate) : null, order: count },
    });
    return NextResponse.json({ milestone });
  } catch (error: any) {
    console.error('Create milestone error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const body = await req.json();
    const { id, ...data } = body;
    if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 });
    if (data.completed === true && !data.completedAt) data.completedAt = new Date();
    if (data.completed === false) data.completedAt = null;
    if (data.dueDate) data.dueDate = new Date(data.dueDate);
    const milestone = await prisma.milestone.update({ where: { id }, data });
    return NextResponse.json({ milestone });
  } catch (error: any) {
    console.error('Update milestone error:', error);
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
    await prisma.milestone.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Delete milestone error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
