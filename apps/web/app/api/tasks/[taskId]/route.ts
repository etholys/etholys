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
import {
  buildTaskContextLine,
  compactTitle,
  notifyTaskAssigned,
  notifyTaskWatchers,
  statusLabel,
  taskRoleUserIds,
  wantsWorkEmail,
  wantsWorkNotify,
} from '@/lib/work/task-notify';
import { archiveTaskTree, restoreTaskTree } from '@/lib/work/task-archive';
import {
  executorIdsFromTask,
  peopleSelect,
  replaceTaskRolePeople,
  responsibleIdsFromTask,
  reviewerIdsFromTask,
  withRoleIdArrays,
} from '@/lib/work/task-people';

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

const detailIncludeBase = {
  assignee: true,
  responsible: { select: { id: true, name: true, email: true } },
  reviewer: { select: { id: true, name: true, email: true } },
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
    where: { isActive: true, archivedAt: null },
    include: { assignee: { select: { id: true, name: true } } },
    orderBy: { order: 'asc' as const },
  },
  archivedBy: { select: { id: true, name: true } },
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

const detailInclude = {
  ...detailIncludeBase,
  people: { select: peopleSelect, orderBy: [{ role: 'asc' as const }, { sortOrder: 'asc' as const }] },
};

async function loadTaskDetail(taskId: string) {
  try {
    return await prisma.task.findFirst({
      where: { id: taskId, isActive: true },
      include: detailInclude,
    });
  } catch {
    return prisma.task.findFirst({
      where: { id: taskId, isActive: true },
      include: detailIncludeBase,
    });
  }
}

export async function GET(_req: Request, { params }: { params: { taskId: string } }) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const access = await assertTaskAccess(params.taskId, tenant);
    if (!access) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

    const task = await loadTaskDetail(params.taskId);
    if (!task) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

    return NextResponse.json({ task: withRoleIdArrays(task) });
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
    // Single-FK patches still supported; multi-arrays take precedence via replaceTaskRolePeople below.
    if (body.assigneeId !== undefined && body.assigneeIds === undefined) data.assigneeId = body.assigneeId || null;
    if (body.responsibleId !== undefined && body.responsibleIds === undefined) {
      data.responsibleId = body.responsibleId || null;
    }
    if (body.reviewerId !== undefined && body.reviewerIds === undefined) data.reviewerId = body.reviewerId || null;
    if (Array.isArray(body.collaboratorIds) && body.assigneeIds === undefined) {
      const wanted = [...new Set(body.collaboratorIds.map((id: unknown) => String(id)).filter(Boolean))].slice(0, 12);
      const members = wanted.length
        ? await prisma.user.findMany({
            where: { id: { in: wanted }, companyUsers: { some: { companyId: { in: tenant.companyIds } } } },
            select: { id: true },
          })
        : [];
      const primary = body.assigneeId !== undefined ? body.assigneeId || null : task.assigneeId;
      data.collaboratorIds = members.map((u) => u.id).filter((id) => id !== primary);
    }
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
    if (body.projectId !== undefined) {
      if (body.projectId === null || body.projectId === '') {
        data.projectId = null;
      } else {
        const project = await prisma.project.findFirst({
          where: { id: String(body.projectId), companyId: { in: tenant.companyIds } },
          select: { id: true },
        });
        if (!project) return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 });
        data.projectId = project.id;
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
    if (body.customFields !== undefined && body.customFields && typeof body.customFields === 'object') {
      const prev =
        task.customFields && typeof task.customFields === 'object' && !Array.isArray(task.customFields)
          ? (task.customFields as Record<string, unknown>)
          : {};
      data.customFields = { ...prev, ...(body.customFields as Record<string, unknown>) };
    }
    if (body.order !== undefined) {
      const n = parseInt(String(body.order), 10);
      if (!Number.isNaN(n)) data.order = n;
    }
    if (body.status === 'DONE') data.completedAt = new Date();
    else if (body.status !== undefined) data.completedAt = null;

    const wantArchive = body.archived === true;
    const wantRestore = body.archived === false;
    if (wantArchive || wantRestore) {
      if (wantArchive) await archiveTaskTree(params.taskId, tenant.userId);
      else await restoreTaskTree(params.taskId);
      const refreshed = await loadTaskDetail(params.taskId);
      return NextResponse.json({ task: refreshed ? withRoleIdArrays(refreshed) : refreshed });
    }

    const prevExecutors = executorIdsFromTask(task);
    const prevResponsible = responsibleIdsFromTask(task);
    const prevReviewers = reviewerIdsFromTask(task);

    if (Object.keys(data).length) {
      await prisma.task.update({ where: { id: params.taskId }, data });
    }

    // Multi-role arrays (preferred) — also sync when single FK / collaboratorIds change
    if (Array.isArray(body.assigneeIds)) {
      await replaceTaskRolePeople({
        taskId: params.taskId,
        role: 'EXECUTOR',
        userIds: body.assigneeIds,
        companyIds: tenant.companyIds,
      });
    } else if (body.assigneeId !== undefined || Array.isArray(body.collaboratorIds)) {
      const primary =
        body.assigneeId !== undefined ? body.assigneeId || null : task.assigneeId;
      const extras = Array.isArray(body.collaboratorIds)
        ? body.collaboratorIds.map((id: unknown) => String(id)).filter(Boolean)
        : Array.isArray(task.collaboratorIds)
          ? task.collaboratorIds.map((id) => String(id))
          : [];
      await replaceTaskRolePeople({
        taskId: params.taskId,
        role: 'EXECUTOR',
        userIds: [...(primary ? [String(primary)] : []), ...extras.filter((id) => id !== primary)],
        companyIds: tenant.companyIds,
      });
    }

    if (Array.isArray(body.responsibleIds)) {
      await replaceTaskRolePeople({
        taskId: params.taskId,
        role: 'RESPONSIBLE',
        userIds: body.responsibleIds,
        companyIds: tenant.companyIds,
      });
    } else if (body.responsibleId !== undefined) {
      await replaceTaskRolePeople({
        taskId: params.taskId,
        role: 'RESPONSIBLE',
        userIds: body.responsibleId ? [String(body.responsibleId)] : [],
        companyIds: tenant.companyIds,
      });
    }

    if (Array.isArray(body.reviewerIds)) {
      await replaceTaskRolePeople({
        taskId: params.taskId,
        role: 'REVIEWER',
        userIds: body.reviewerIds,
        companyIds: tenant.companyIds,
      });
    } else if (body.reviewerId !== undefined) {
      await replaceTaskRolePeople({
        taskId: params.taskId,
        role: 'REVIEWER',
        userIds: body.reviewerId ? [String(body.reviewerId)] : [],
        companyIds: tenant.companyIds,
      });
    }

    const updated = await loadTaskDetail(params.taskId);
    if (!updated) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
    const enriched = withRoleIdArrays(updated);

    const companyId = updated.companyId || updated.project?.companyId || null;
    const company = companyId
      ? await prisma.company.findUnique({ where: { id: companyId }, select: { workBoardJson: true } })
      : null;
    const emailOn = wantsWorkEmail(company?.workBoardJson);
    const actor = await prisma.user.findUnique({
      where: { id: tenant.userId },
      select: { name: true, email: true },
    });
    const actorName = actor?.name || actor?.email || 'Alguien';
    const whereLine = buildTaskContextLine({
      taskTitle: updated.title,
      folderName: updated.folder?.name,
      groupName: updated.group?.name,
      projectName: updated.project?.name,
    });
    const taskLink = '/hub/work';

    if (wantsWorkNotify(company?.workBoardJson, 'assign')) {
      const nextExecutors = enriched.assigneeIds;
      const nextResponsible = enriched.responsibleIds;
      const nextReviewers = enriched.reviewerIds;
      for (const id of nextExecutors) {
        if (prevExecutors.includes(id)) continue;
        notifyTaskAssigned({
          assigneeId: id,
          actorId: tenant.userId,
          title: updated.title,
          projectId: updated.projectId,
          prevAssigneeId: null,
          email: emailOn,
          roleLabel: 'asignó como ejecutor',
          actorName,
          where: whereLine,
        });
      }
      for (const id of nextResponsible) {
        if (prevResponsible.includes(id)) continue;
        notifyTaskAssigned({
          assigneeId: id,
          actorId: tenant.userId,
          title: updated.title,
          projectId: updated.projectId,
          prevAssigneeId: null,
          email: emailOn,
          roleLabel: 'asignó como responsable',
          actorName,
          where: whereLine,
        });
      }
      for (const id of nextReviewers) {
        if (prevReviewers.includes(id)) continue;
        notifyTaskAssigned({
          assigneeId: id,
          actorId: tenant.userId,
          title: updated.title,
          projectId: updated.projectId,
          prevAssigneeId: null,
          email: emailOn,
          roleLabel: 'asignó como supervisor',
          actorName,
          where: whereLine,
        });
      }
    }
    if (body.status !== undefined && body.status !== task.status) {
      const fromLabel = statusLabel(String(task.status));
      const toLabel = statusLabel(String(body.status));
      notifyTaskWatchers({
        actorId: tenant.userId,
        type: 'task_status',
        title: 'Estado actualizado',
        message: `${compactTitle(updated.title)}: ${fromLabel} → ${toLabel}`,
        userIds: taskRoleUserIds(enriched),
        enabled: wantsWorkNotify(company?.workBoardJson, 'status'),
        email: emailOn,
        link: taskLink,
        mail: {
          subjectPhrase: 'Estado actualizado',
          headline: 'Estado actualizado',
          where: whereLine,
          what: `Estado: ${fromLabel} → ${toLabel}`,
          who: actorName,
          when: new Date(),
          link: taskLink,
        },
      });
    }

    return NextResponse.json({ task: enriched });
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
