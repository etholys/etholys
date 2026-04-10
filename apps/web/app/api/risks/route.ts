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
    const { projectId, title, description, level, impact, mitigation } = body;
    if (!projectId || !title) return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 });
    const risk = await prisma.risk.create({
      data: { projectId, title, description: description || '', level: level || 'MEDIUM', impact: impact || '', mitigation: mitigation || '' },
    });
    return NextResponse.json({ risk });
  } catch (error: any) {
    console.error('Create risk error:', error);
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
    const risk = await prisma.risk.update({ where: { id }, data });
    return NextResponse.json({ risk });
  } catch (error: any) {
    console.error('Update risk error:', error);
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
    await prisma.risk.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Delete risk error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
