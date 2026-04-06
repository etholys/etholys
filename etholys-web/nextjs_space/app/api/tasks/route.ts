export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserCompanyIds } from '@/lib/tenant';
import { createNotification } from '@/lib/notify';

export async function GET(req: Request) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get('projectId');
    const status = searchParams.get('status');
    const assigneeId = searchParams.get('assigneeId');
    const companyId = searchParams.get('companyId');
    const where: any = { isActive: true };
    if (projectId) where.projectId = projectId;
    if (status) where.status = status;
    if (assigneeId) where.assigneeId = assigneeId;
    // Tenant isolation: tasks from projects in user's companies OR direct companyId tasks
    if (companyId && tenant.companyIds.includes(companyId)) {
      where.OR = [{ project: { companyId } }, { companyId }];
    } else if (!projectId) {
      where.OR = [
        { project: { companyId: { in: tenant.companyIds } } },
        { companyId: { in: tenant.companyIds } },
      ];
    }
    // Department filter
    const departmentId = searchParams.get('departmentId');
    if (departmentId) where.departmentId = departmentId;
    // No-project filter (company tasks only)
    const noProject = searchParams.get('noProject');
    if (noProject === '1') where.projectId = null;

    const tasks = await prisma.task.findMany({
      where,
      include: {
        assignee: true,
        creator: true,
        project: { include: { company: true } },
        department: true,
        checklist: { orderBy: { order: 'asc' } },
        _count: { select: { comments: true, subtasks: true, attachments: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });
    return NextResponse.json({ tasks });
  } catch (error: any) {
    console.error('Tasks error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const body = await req.json();
    const { recurrenceCount, ...taskData } = body;

    // If recurring with count > 1, create multiple tasks with incremented due dates
    const count = body.isRecurring && recurrenceCount ? Math.min(parseInt(recurrenceCount) || 1, 60) : 1;
    const recMonths = body.isRecurring && body.recurrenceMonths ? parseInt(body.recurrenceMonths) || 1 : 1;

    if (count > 1 && body.dueDate) {
      const groupId = `rg_${Date.now()}`;
      const created = [];
      const baseDue = new Date(body.dueDate);
      const baseStart = body.startDate ? new Date(body.startDate) : null;
      for (let i = 0; i < count; i++) {
        const dueDate = new Date(baseDue);
        dueDate.setMonth(dueDate.getMonth() + (i * recMonths));
        let startDate: Date | null = null;
        if (baseStart) {
          startDate = new Date(baseStart);
          startDate.setMonth(startDate.getMonth() + (i * recMonths));
        }
        const tx = await prisma.task.create({
          data: {
            ...taskData,
            creatorId: tenant.userId,
            dueDate,
            startDate,
            isRecurring: true,
            recurrenceMonths: recMonths,
            recurrenceGroup: groupId,
            title: `${taskData.title} (${i + 1}/${count})`,
          },
          include: { assignee: true, project: true },
        });
        created.push(tx);
        if (tx.assigneeId && tx.assigneeId !== tenant.userId) {
          createNotification({
            userId: tx.assigneeId,
            type: 'task_assigned',
            title: 'Nueva tarea asignada',
            message: `Se te asigno la tarea: ${tx.title}`,
            link: tx.projectId ? `/projects/${tx.projectId}` : '/tasks',
          });
        }
      }
      return NextResponse.json({ tasks: created, count: created.length });
    }

    const task = await prisma.task.create({
      data: { ...taskData, creatorId: tenant.userId },
      include: { assignee: true, project: true },
    });
    // Notify assignee
    if (task.assigneeId && task.assigneeId !== tenant.userId) {
      createNotification({
        userId: task.assigneeId,
        type: 'task_assigned',
        title: 'Nueva tarea asignada',
        message: `Se te asigno la tarea: ${task.title}`,
        link: task.projectId ? `/projects/${task.projectId}` : '/tasks',
      });
    }
    return NextResponse.json({ task });
  } catch (error: any) {
    console.error('Create task error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
