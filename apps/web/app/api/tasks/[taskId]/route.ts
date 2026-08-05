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

const detailInclude = {
  assignee: true,
  creator: true,
  project: { include: { company: true } },
  department: true,
  checklist: { orderBy: { order: 'asc' as const } },
  comments: {
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: 'asc' as const },
  },
  timeEntries: {
    include: { user: { select: { id: true, name: true } } },
    orderBy: { date: 'desc' as const },
  },
  subtasks: {
    where: { isActive: true },
    include: { assignee: { select: { id: true, name: true } } },
    orderBy: { order: 'asc' as const },
  },
  parent: { select: { id: true, title: true } },
  _count: { select: { comments: true, subtasks: true, attachments: true } },
};

export async function GET(_req: Request, { params }: { params: { taskId: string } }) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const access = await assertTaskAccess(params.taskId, tenant);
    if (!access) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

    const task = await prisma.task.findFirst({
      where: { id: params.taskId, isActive: true },
      include: detailInclude,
    });
    if (!task) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

    return NextResponse.json({ task });
  } catch (error: unknown) {
    console.error('Get task error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
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
    if (body.departmentId !== undefined) data.departmentId = body.departmentId || null;
    if (body.estimatedHours !== undefined) {
      data.estimatedHours =
        body.estimatedHours === null || body.estimatedHours === ''
          ? null
          : parseFloat(String(body.estimatedHours));
    }
    if (body.tags !== undefined) {
      const raw = Array.isArray(body.tags)
        ? body.tags.map((t: unknown) => String(t).trim()).filter(Boolean)
        : String(body.tags || '')
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean);
      data.tags = raw.length ? raw.join(',') : null;
    }
    if (body.parentId !== undefined) {
      if (body.parentId === null || body.parentId === '') {
        data.parentId = null;
      } else if (body.parentId === params.taskId) {
        return NextResponse.json({ error: 'Una tarea no puede ser subtarea de sí misma' }, { status: 400 });
      } else {
        const parent = await assertTaskAccess(String(body.parentId), tenant);
        if (!parent) return NextResponse.json({ error: 'Tarea padre no encontrada' }, { status: 404 });
        data.parentId = body.parentId;
      }
    }
    if (body.status === 'DONE') data.completedAt = new Date();
    else if (body.status !== undefined) data.completedAt = null;

    const updated = await prisma.task.update({
      where: { id: params.taskId },
      data,
      include: detailInclude,
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
