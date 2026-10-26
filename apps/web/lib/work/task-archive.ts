import { prisma } from '@/lib/prisma';

/** Soft-archive a task and its active subtasks (keeps group/folder for restore). */
export async function archiveTaskTree(taskId: string, userId: string) {
  const now = new Date();
  await prisma.$transaction([
    prisma.task.update({
      where: { id: taskId },
      data: { archivedAt: now, archivedById: userId },
    }),
    prisma.task.updateMany({
      where: { parentId: taskId, isActive: true, archivedAt: null },
      data: { archivedAt: now, archivedById: userId },
    }),
  ]);
}

/** Restore a task and subtasks that were archived with it. */
export async function restoreTaskTree(taskId: string) {
  await prisma.$transaction([
    prisma.task.update({
      where: { id: taskId },
      data: { archivedAt: null, archivedById: null },
    }),
    prisma.task.updateMany({
      where: { parentId: taskId, isActive: true, archivedAt: { not: null } },
      data: { archivedAt: null, archivedById: null },
    }),
  ]);
}
