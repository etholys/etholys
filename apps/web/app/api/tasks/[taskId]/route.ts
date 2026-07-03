export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserCompanyIds } from '@/lib/tenant';

async function assertTaskAccess(taskId: string, tenant: { userId: string; companyIds: string[] }) {
  const task = await prisma.task.findFirst({
    where: { id: taskId, isActive: true },
    include: { project: { select: { companyId: true } } },
  });
  if (!task) return null;
  const companyId = task.project?.companyId || task.companyId;
  if (!companyId || !tenant.companyIds.includes(companyId)) return null;
  return task;
}

export async function PUT(req: Request, { params }: { params: { taskId: string } }) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const task = await assertTaskAccess(params.taskId, tenant);
    if (!task) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

    const body = await req.json();
    const data: Record<string, unknown> = {};
    if (body.title !== undefined) data.title = String(body.title);
    if (body.description !== undefined) data.description = body.description;
    if (body.status !== undefined) data.status = body.status;
    if (body.priority !== undefined) data.priority = body.priority;
    if (body.dueDate !== undefined) data.dueDate = body.dueDate ? new Date(body.dueDate) : null;
    if (body.startDate !== undefined) data.startDate = body.startDate ? new Date(body.startDate) : null;
    if (body.assigneeId !== undefined) data.assigneeId = body.assigneeId || null;
    if (body.status === 'DONE') data.completedAt = new Date();

    const updated = await prisma.task.update({
      where: { id: params.taskId },
      data,
      include: { assignee: true },
    });
    return NextResponse.json({ task: updated });
  } catch (error: unknown) {
    console.error('Update task error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: { taskId: string } }) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const task = await assertTaskAccess(params.taskId, tenant);
    if (!task) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

    await prisma.task.update({ where: { id: params.taskId }, data: { isActive: false } });
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('Delete task error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
