import { prisma } from '@/lib/prisma';
import {
  canEditFolderContent,
  getFolderAccess,
  isWorkBoard,
  type WorkFolderAccess,
} from '@/lib/work/folder-access';

/** First active group on a board, or create a default section. */
export async function ensureBoardDefaultGroup(
  folderId: string,
  companyId: string,
  defaultName = 'General',
): Promise<string> {
  const existing = await prisma.taskGroup.findFirst({
    where: { folderId, companyId, isActive: true, ownerId: null },
    orderBy: [{ order: 'asc' }, { name: 'asc' }],
    select: { id: true },
  });
  if (existing) return existing.id;

  const max = await prisma.taskGroup.aggregate({
    where: { companyId, folderId, isActive: true, ownerId: null },
    _max: { order: true },
  });
  const group = await prisma.taskGroup.create({
    data: {
      companyId,
      folderId,
      name: defaultName,
      order: (max._max.order ?? -1) + 1,
      ownerId: null,
    },
    select: { id: true },
  });
  return group.id;
}

export async function getWritableBoard(
  folderId: string,
  userId: string,
  companyIds: string[],
): Promise<{ folder: { id: string; companyId: string; kind: string }; access: WorkFolderAccess } | null> {
  const access = await getFolderAccess(folderId, userId, companyIds);
  if (!access || !canEditFolderContent(access.access)) return null;
  if (!isWorkBoard(access.folder.kind)) return null;
  return access;
}
