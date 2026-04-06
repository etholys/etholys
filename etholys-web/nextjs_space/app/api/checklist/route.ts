export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';

export async function PUT(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const { id, completed } = await req.json();
    const item = await prisma.checklistItem.update({ where: { id }, data: { completed } });
    return NextResponse.json({ item });
  } catch (error: any) {
    console.error('Checklist error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const { taskId, text } = await req.json();
    const item = await prisma.checklistItem.create({ data: { taskId, text } });
    return NextResponse.json({ item });
  } catch (error: any) {
    console.error('Checklist create error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
