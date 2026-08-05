export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserCompanyIds } from '@/lib/tenant';

async function assertTaskAccess(taskId: string, companyIds: string[]) {
  const task = await prisma.task.findFirst({
    where: { id: taskId, isActive: true },
    include: { project: { select: { companyId: true } } },
  });
  if (!task) return null;
  const companyId = task.project?.companyId || task.companyId;
  if (!companyId || !companyIds.includes(companyId)) return null;
  return task;
}

export async function GET(req: Request) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const taskId = new URL(req.url).searchParams.get('taskId');
    if (!taskId) return NextResponse.json({ error: 'taskId requerido' }, { status: 400 });

    const access = await assertTaskAccess(taskId, tenant.companyIds);
    if (!access) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

    const comments = await prisma.comment.findMany({
      where: { taskId },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: 'asc' },
    });
    return NextResponse.json({ comments });
  } catch (error: unknown) {
    console.error('Comment list error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const { taskId, content } = await req.json();
    if (!taskId || !String(content || '').trim()) {
      return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 });
    }

    const access = await assertTaskAccess(taskId, tenant.companyIds);
    if (!access) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

    const comment = await prisma.comment.create({
      data: { taskId, userId: tenant.userId, content: String(content).trim() },
      include: { user: { select: { id: true, name: true, email: true } } },
    });
    return NextResponse.json({ comment });
  } catch (error: unknown) {
    console.error('Comment error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
