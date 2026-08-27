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

/** Bulk update tasks — Monday/ClickUp-style multi-select actions. */
export async function PUT(req: Request) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const body = await req.json();
    const ids: string[] = Array.isArray(body.ids) ? body.ids.map(String).filter(Boolean) : [];
    const patch = body.patch && typeof body.patch === 'object' ? body.patch : {};
    if (!ids.length) return NextResponse.json({ error: 'ids required' }, { status: 400 });
    if (ids.length > 100) return NextResponse.json({ error: 'max 100 tasks' }, { status: 400 });

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
