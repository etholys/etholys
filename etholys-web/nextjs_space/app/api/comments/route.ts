export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const { taskId, content } = await req.json();
    const userId = (session.user as any)?.id;
    const comment = await prisma.comment.create({ data: { taskId, userId, content } });
    return NextResponse.json({ comment });
  } catch (error: any) {
    console.error('Comment error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
