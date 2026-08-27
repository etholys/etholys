export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserCompanyIds } from '@/lib/tenant';
import { requireProjectPermission } from '@/lib/siep/permissions';
import {
  canEditFolderContent,
  canReadFolder,
  getFolderAccess,
} from '@/lib/work/folder-access';
import { notifyTaskAssigned } from '@/lib/work/task-notify';

async function assertTaskAccess(
  taskId: string,
  tenant: { userId: string; companyIds: string[] },
  opts?: { requireEdit?: boolean },
) {
  const task = await prisma.task.findFirst({
    where: { id: taskId, isActive: true },
    include: { project: { select: { companyId: true } } },
  });
  if (!task) return null;

  const companyId = task.project?.companyId || task.companyId;
  const isCompanyMember = !!(companyId && tenant.companyIds.includes(companyId));

  if (task.folderId) {
    const folderAccess = await getFolderAccess(task.folderId, tenant.userId, tenant.companyIds);
    if (!folderAccess || !canReadFolder(folderAccess.access)) return null;
    if (opts?.requireEdit && !canEditFolderContent(folderAccess.access)) return null;
  }

  if (task.projectId) {
    const needed = opts?.requireEdit
      ? (['siep.tasks.edit'] as const)
      : (['siep.tasks.view', 'siep.tasks.edit', 'siep.project.view', 'siep.activities.report'] as const);
    const gate = await requireProjectPermission(tenant.userId, task.projectId, [...needed]);
    // Integrated Workspace: company members can use Work as a mirror even without a SIEP key;
    // project guests still need ProjectMember permissions.
    if (!gate.ok && !isCompanyMember) return null;
  } else if (!isCompanyMember) {
    return null;
  }

  return task;
}

const detailInclude = {
  assignee: true,
  creator: true,
  project: { include: { company: true } },
  department: true,
  group: true,
  folder: true,
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
  approvalRequests: {
    orderBy: { createdAt: 'desc' as const },
    take: 10,
    include: {
      requester: { select: { id: true, name: true } },
      approver: { select: { id: true, name: true } },
    },
  },
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

    const task = await assertTaskAccess(params.taskId, tenant, { requireEdit: true });
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
    if (body.groupId !== undefined) {
      if (body.groupId === null || body.groupId === '') {
        data.groupId = null;
      } else {
        const group = await prisma.taskGroup.findFirst({
          where: { id: String(body.groupId), isActive: true, companyId: { in: tenant.companyIds } },
        });
        if (!group) return NextResponse.json({ error: 'Grupo no encontrado' }, { status: 404 });
        data.groupId = group.id;
      }
    }
    if (body.folderId !== undefined) {
      if (body.folderId === null || body.folderId === '') {
        data.folderId = null;
      } else {
        const folderAccess = await getFolderAccess(String(body.folderId), tenant.userId, tenant.companyIds);
        if (!folderAccess || !canEditFolderContent(folderAccess.access)) {
          return NextResponse.json({ error: 'Carpeta no encontrada' }, { status: 404 });
        }
        data.folderId = folderAccess.folder.id;
      }
    }
    if (body.order !== undefined) {
      const n = parseInt(String(body.order), 10);
      if (!Number.isNaN(n)) data.order = n;
    }
    if (body.status === 'DONE') data.completedAt = new Date();
    else if (body.status !== undefined) data.completedAt = null;

    const prevAssignee = task.assigneeId;
    const updated = await prisma.task.update({
      where: { id: params.taskId },
      data,
      include: detailInclude,
    });

    if (body.assigneeId !== undefined) {
      notifyTaskAssigned({
        assigneeId: updated.assigneeId,
        actorId: tenant.userId,
        title: updated.title,
        projectId: updated.projectId,
        prevAssigneeId: prevAssignee,
      });
    }

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

    const task = await assertTaskAccess(params.taskId, tenant, { requireEdit: true });
    if (!task) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

    await prisma.task.update({ where: { id: params.taskId }, data: { isActive: false } });
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('Delete task error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
