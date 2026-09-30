export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserCompanyIds } from '@/lib/tenant';
import { createNotification } from '@/lib/notify';
import { getGuestProjectIds, requireProjectPermission } from '@/lib/siep/permissions';
import {
  canEditFolderContent,
  folderVisibleTaskFilter,
  getFolderAccess,
} from '@/lib/work/folder-access';

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

    const [companyMemberRows, guestProjectIds] = await Promise.all([
      prisma.companyUser.findMany({
        where: { userId: tenant.userId },
        select: { companyId: true },
      }),
      getGuestProjectIds(tenant.userId),
    ]);
    const companyMemberIds = companyMemberRows.map((r) => r.companyId);

    if (projectId) {
      const gate = await requireProjectPermission(tenant.userId, projectId, [
        'siep.tasks.view',
        'siep.tasks.edit',
        'siep.project.view',
        'siep.activities.report',
      ]);
      if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });
    } else if (companyId && companyMemberIds.includes(companyId)) {
      where.OR = [{ project: { companyId } }, { companyId }];
    } else if (companyMemberIds.length) {
      where.OR = [
        { project: { companyId: { in: companyMemberIds } } },
        { companyId: { in: companyMemberIds } },
        ...(guestProjectIds.length ? [{ projectId: { in: guestProjectIds } }] : []),
      ];
    } else if (guestProjectIds.length) {
      where.projectId = { in: guestProjectIds };
    } else {
      return NextResponse.json({ tasks: [] });
    }

    // Department filter
    const departmentId = searchParams.get('departmentId');
    if (departmentId) where.departmentId = departmentId;
    const folderId = searchParams.get('folderId');
    if (folderId) {
      const folderAccess = await getFolderAccess(folderId, tenant.userId, tenant.companyIds);
      if (!folderAccess) return NextResponse.json({ error: 'Carpeta no encontrada' }, { status: 404 });
      where.folderId = folderId;
    }
    // No-project filter (company tasks only) — guests cannot list company-wide tasks
    const noProject = searchParams.get('noProject');
    if (noProject === '1') {
      if (!companyMemberIds.length) return NextResponse.json({ tasks: [] });
      where.projectId = null;
    }

    // Drive ACL: hide tasks in folders the user cannot access
    const folderGate = folderVisibleTaskFilter(tenant.userId);
    where.AND = [...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []), folderGate];

    const tasks = await prisma.task.findMany({
      where,
      select: {
        id: true,
        title: true,
        description: true,
        status: true,
        priority: true,
        dueDate: true,
        startDate: true,
        order: true,
        projectId: true,
        companyId: true,
        departmentId: true,
        groupId: true,
        folderId: true,
        assigneeId: true,
        creatorId: true,
        parentId: true,
        isActive: true,
        updatedAt: true,
        createdAt: true,
        assignee: { select: { id: true, name: true, email: true, avatar: true } },
        creator: { select: { id: true, name: true } },
        project: {
          select: {
            id: true,
            name: true,
            companyId: true,
            company: { select: { id: true, shortName: true, color: true } },
          },
        },
        department: { select: { id: true, name: true } },
        group: { select: { id: true, name: true, color: true } },
        folder: { select: { id: true, name: true } },
        checklist: {
          select: { id: true, text: true, completed: true, order: true },
          orderBy: { order: 'asc' },
        },
        _count: { select: { comments: true, subtasks: true, attachments: true } },
      },
      orderBy: [{ order: 'asc' }, { updatedAt: 'desc' }],
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
    const { recurrenceCount, ...rawTaskData } = body;

    if (rawTaskData.projectId) {
      const gate = await requireProjectPermission(tenant.userId, String(rawTaskData.projectId), [
        'siep.tasks.edit',
      ]);
      if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });
    } else {
      // Tarefas sem projeto = Work/ATLAS — convidados SIEP não podem
      const cu = await prisma.companyUser.findFirst({ where: { userId: tenant.userId } });
      if (!cu) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
      }
    }

    const normalizeTags = (tags: unknown): string | null => {
      if (tags == null || tags === '') return null;
      const raw = Array.isArray(tags)
        ? tags.map((t) => String(t).trim()).filter(Boolean)
        : String(tags)
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean);
      return raw.length ? raw.join(',') : null;
    };

    const taskData: Record<string, unknown> = { ...rawTaskData };
    if ('tags' in taskData) taskData.tags = normalizeTags(taskData.tags);
    if (!taskData.assigneeId) delete taskData.assigneeId;
    if (!taskData.departmentId) delete taskData.departmentId;
    if (!taskData.projectId) delete taskData.projectId;
    if (!taskData.parentId) delete taskData.parentId;
    if (!taskData.groupId) delete taskData.groupId;
    if (!taskData.folderId) delete taskData.folderId;
    else {
      const folderAccess = await getFolderAccess(String(taskData.folderId), tenant.userId, tenant.companyIds);
      if (!folderAccess || !canEditFolderContent(folderAccess.access)) {
        return NextResponse.json({ error: 'Carpeta no encontrada' }, { status: 404 });
      }
    }
    if (taskData.dueDate) taskData.dueDate = new Date(String(taskData.dueDate));
    if (taskData.startDate) taskData.startDate = new Date(String(taskData.startDate));
    if (taskData.estimatedHours !== undefined && taskData.estimatedHours !== '') {
      taskData.estimatedHours = parseFloat(String(taskData.estimatedHours));
    } else {
      delete taskData.estimatedHours;
    }

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
          } as any,
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
      data: { ...taskData, creatorId: tenant.userId } as any,
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
