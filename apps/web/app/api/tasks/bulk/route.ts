export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserCompanyIds } from '@/lib/tenant';
import { createNotification } from '@/lib/notify';
import { requireProjectPermission } from '@/lib/siep/permissions';
import {
  canEditFolderContent,
  canReadFolder,
  getFolderAccess,
} from '@/lib/work/folder-access';
import { archiveTaskTree, restoreTaskTree } from '@/lib/work/task-archive';
import { replaceTaskRolePeople } from '@/lib/work/task-people';
import { ensureBoardDefaultGroup, getWritableBoard } from '@/lib/work/board-group';

const PATCHABLE = new Set([
  'status',
  'priority',
  'assigneeId',
  'dueDate',
  'groupId',
  'folderId',
  'departmentId',
]);

async function assertEditable(
  taskId: string,
  tenant: { userId: string; companyIds: string[] },
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
    if (!canEditFolderContent(folderAccess.access)) return null;
  }

  if (task.projectId) {
    const gate = await requireProjectPermission(tenant.userId, task.projectId, ['siep.tasks.edit']);
    if (!gate.ok && !isCompanyMember) return null;
  } else if (!isCompanyMember) {
    return null;
  }

  return task;
}

async function duplicateTaskTree(
  sourceId: string,
  opts: {
    tenant: { userId: string; companyIds: string[] };
    targetFolderId: string;
    targetGroupId: string | null;
    companyId: string;
    parentId?: string | null;
    includeSubtasks: boolean;
  },
): Promise<string | null> {
  const source = await prisma.task.findFirst({
    where: { id: sourceId, isActive: true },
    include: {
      checklist: { orderBy: { order: 'asc' } },
      subtasks: opts.includeSubtasks
        ? { where: { isActive: true }, select: { id: true } }
        : false,
    },
  });
  if (!source) return null;

  const created = await prisma.task.create({
    data: {
      title: source.title,
      description: source.description,
      projectId: source.projectId,
      companyId: opts.companyId,
      assigneeId: source.assigneeId,
      responsibleId: source.responsibleId,
      reviewerId: source.reviewerId,
      creatorId: opts.tenant.userId,
      parentId: opts.parentId ?? null,
      status: source.status === 'DONE' ? 'TODO' : source.status,
      priority: source.priority,
      startDate: source.startDate,
      dueDate: source.dueDate,
      completedAt: null,
      estimatedHours: source.estimatedHours,
      order: source.order,
      tags: source.tags,
      customFields: source.customFields ?? undefined,
      collaboratorIds: source.collaboratorIds ?? undefined,
      roleMemberIds: source.roleMemberIds ?? undefined,
      isRecurring: false,
      recurrenceMonths: null,
      recurrenceGroup: null,
      departmentId: source.departmentId,
      groupId: opts.parentId ? null : opts.targetGroupId,
      folderId: opts.targetFolderId,
      checklist: source.checklist.length
        ? {
            create: source.checklist.map((c) => ({
              text: c.text,
              completed: false,
              order: c.order,
            })),
          }
        : undefined,
    },
    select: { id: true },
  });

  if (opts.includeSubtasks && Array.isArray(source.subtasks)) {
    for (const child of source.subtasks) {
      await duplicateTaskTree(child.id, {
        ...opts,
        parentId: created.id,
      });
    }
  }

  return created.id;
}

/** Bulk update tasks — Monday/ClickUp-style multi-select actions. */
export async function PUT(req: Request) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const body = await req.json();
    const ids: string[] = Array.isArray(body.ids) ? body.ids.map(String).filter(Boolean) : [];
    const patch = body.patch && typeof body.patch === 'object' ? body.patch : {};
    const remove = body.delete === true;
    const archive = body.archive === true;
    const restore = body.restore === true;
    const duplicate = body.duplicate === true;
    if (!ids.length) return NextResponse.json({ error: 'ids required' }, { status: 400 });
    if (ids.length > 100) return NextResponse.json({ error: 'max 100 tasks' }, { status: 400 });

    if (duplicate) {
      const targetFolderId = String(body.targetFolderId || '');
      if (!targetFolderId) {
        return NextResponse.json({ error: 'targetFolderId required' }, { status: 400 });
      }
      const target = await getWritableBoard(targetFolderId, tenant.userId, tenant.companyIds);
      if (!target) {
        return NextResponse.json({ error: 'Tablero destino no encontrado' }, { status: 404 });
      }
      const includeSubtasks = body.includeSubtasks !== false;
      let targetGroupId: string | null =
        body.groupId !== undefined && body.groupId !== null && body.groupId !== ''
          ? String(body.groupId)
          : null;
      if (!targetGroupId) {
        targetGroupId = await ensureBoardDefaultGroup(target.folder.id, target.folder.companyId);
      } else {
        const g = await prisma.taskGroup.findFirst({
          where: {
            id: targetGroupId,
            folderId: target.folder.id,
            companyId: target.folder.companyId,
            isActive: true,
          },
          select: { id: true },
        });
        if (!g) {
          return NextResponse.json({ error: 'Grupo destino inválido' }, { status: 400 });
        }
      }

      const idSet = new Set(ids);
      const created: string[] = [];
      const skipped: string[] = [];
      for (const id of ids) {
        const task = await assertEditable(id, tenant);
        if (!task) {
          skipped.push(id);
          continue;
        }
        // Parent already in selection → child is copied with includeSubtasks.
        if (task.parentId && idSet.has(task.parentId) && includeSubtasks) {
          skipped.push(id);
          continue;
        }
        const newId = await duplicateTaskTree(id, {
          tenant,
          targetFolderId: target.folder.id,
          targetGroupId,
          companyId: target.folder.companyId,
          // Standalone subtask selection becomes a top-level task on the target.
          parentId: null,
          includeSubtasks,
        });
        if (newId) created.push(newId);
        else skipped.push(id);
      }
      return NextResponse.json({
        duplicated: created.length,
        skipped: skipped.length,
        ids: created,
      });
    }

    if (remove || archive || restore) {
      const updated: string[] = [];
      const skipped: string[] = [];
      for (const id of ids) {
        const task = await assertEditable(id, tenant);
        if (!task) {
          skipped.push(id);
          continue;
        }
        if (remove) {
          await prisma.task.update({ where: { id }, data: { isActive: false } });
        } else if (archive) {
          await archiveTaskTree(id, tenant.userId);
        } else {
          await restoreTaskTree(id);
        }
        updated.push(id);
      }
      return NextResponse.json({ updated: updated.length, skipped: skipped.length, ids: updated });
    }

    const data: Record<string, unknown> = {};
    for (const key of Object.keys(patch)) {
      if (!PATCHABLE.has(key)) continue;
      const val = patch[key];
      if (key === 'dueDate') {
        data.dueDate = val ? new Date(String(val)) : null;
      } else if (key === 'assigneeId' || key === 'groupId' || key === 'folderId' || key === 'departmentId') {
        data[key] = val || null;
      } else {
        data[key] = val;
      }
    }
    if (data.status === 'DONE') data.completedAt = new Date();
    else if (data.status !== undefined) data.completedAt = null;

    if (!Object.keys(data).length) {
      return NextResponse.json({ error: 'empty patch' }, { status: 400 });
    }

    // Moving boards: remap group to a section on the target board.
    let resolvedTargetGroupId: string | null | undefined;
    if (data.folderId) {
      const target = await getWritableBoard(String(data.folderId), tenant.userId, tenant.companyIds);
      if (!target) {
        return NextResponse.json({ error: 'Tablero destino no encontrado' }, { status: 404 });
      }
      data.folderId = target.folder.id;
      if (data.groupId === undefined) {
        resolvedTargetGroupId = await ensureBoardDefaultGroup(
          target.folder.id,
          target.folder.companyId,
        );
        data.groupId = resolvedTargetGroupId;
      } else if (data.groupId) {
        const g = await prisma.taskGroup.findFirst({
          where: {
            id: String(data.groupId),
            folderId: target.folder.id,
            companyId: target.folder.companyId,
            isActive: true,
          },
          select: { id: true },
        });
        if (!g) {
          return NextResponse.json({ error: 'Grupo destino inválido' }, { status: 400 });
        }
      }
    }

    const updated: string[] = [];
    const skipped: string[] = [];

    for (const id of ids) {
      const task = await assertEditable(id, tenant);
      if (!task) {
        skipped.push(id);
        continue;
      }

      if (data.folderId) {
        const folderAccess = await getFolderAccess(String(data.folderId), tenant.userId, tenant.companyIds);
        if (!folderAccess || !canEditFolderContent(folderAccess.access)) {
          skipped.push(id);
          continue;
        }
      }

      const prevAssignee = task.assigneeId;
      await prisma.task.update({ where: { id }, data });

      // Keep subtasks on the same board when moving a parent.
      if (data.folderId && !task.parentId) {
        await prisma.task.updateMany({
          where: { parentId: id, isActive: true },
          data: {
            folderId: String(data.folderId),
            groupId: null,
          },
        });
      }

      if (data.assigneeId !== undefined) {
        await replaceTaskRolePeople({
          taskId: id,
          role: 'EXECUTOR',
          userIds: data.assigneeId ? [String(data.assigneeId)] : [],
          companyIds: tenant.companyIds,
        });
      }
      updated.push(id);

      if (
        data.assigneeId &&
        data.assigneeId !== prevAssignee &&
        data.assigneeId !== tenant.userId
      ) {
        createNotification({
          userId: String(data.assigneeId),
          type: 'task_assigned',
          title: 'Nueva tarea asignada',
          message: `Se te asignó: ${task.title}`,
          link: task.projectId ? `/projects/${task.projectId}` : '/hub/work',
        });
      }
    }

    return NextResponse.json({ updated: updated.length, skipped: skipped.length, ids: updated });
  } catch (error: unknown) {
    console.error('Bulk tasks error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
