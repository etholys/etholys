import { prisma } from '@/lib/prisma';

/** member (legacy) maps to viewer. */
export type WorkFolderRole = 'viewer' | 'editor' | 'owner';
export type WorkFolderAccess = 'none' | 'viewer' | 'editor' | 'owner';

const RANK: Record<WorkFolderAccess, number> = {
  none: 0,
  viewer: 1,
  editor: 2,
  owner: 3,
};

export function parseWorkFolderRole(raw: unknown, fallback: WorkFolderRole = 'viewer'): WorkFolderRole {
  if (raw === 'editor') return 'editor';
  if (raw === 'viewer' || raw === 'member') return 'viewer';
  if (raw === 'owner') return 'owner';
  return fallback;
}

export function memberRoleToAccess(role: string): WorkFolderAccess {
  if (role === 'editor') return 'editor';
  if (role === 'owner') return 'owner';
  // member (legacy) + viewer
  return 'viewer';
}

export function canReadFolder(access: WorkFolderAccess): boolean {
  return access !== 'none';
}

export function canEditFolderContent(access: WorkFolderAccess): boolean {
  return access === 'editor' || access === 'owner';
}

export function canManageFolder(access: WorkFolderAccess): boolean {
  return access === 'owner';
}

export function canManageFolderShares(access: WorkFolderAccess): boolean {
  return access === 'owner';
}

type FolderWithMembers = {
  id: string;
  companyId: string;
  ownerId: string;
  visibility: string;
  isActive: boolean;
  members: { userId: string; role: string }[];
};

export async function loadWorkFolder(folderId: string): Promise<FolderWithMembers | null> {
  return prisma.workFolder.findFirst({
    where: { id: folderId, isActive: true },
    select: {
      id: true,
      companyId: true,
      ownerId: true,
      visibility: true,
      isActive: true,
      members: { select: { userId: true, role: true } },
    },
  });
}

/** Drive-like: owner or explicit member only (SHARED is not company-wide). */
export function resolveFolderAccess(
  folder: FolderWithMembers,
  userId: string,
  companyIds: string[],
): WorkFolderAccess {
  if (!companyIds.includes(folder.companyId)) return 'none';
  if (folder.ownerId === userId) return 'owner';
  const membership = folder.members.find((m) => m.userId === userId);
  if (!membership) return 'none';
  return memberRoleToAccess(membership.role);
}

export async function getFolderAccess(
  folderId: string,
  userId: string,
  companyIds: string[],
): Promise<{ folder: FolderWithMembers; access: WorkFolderAccess } | null> {
  const folder = await loadWorkFolder(folderId);
  if (!folder) return null;
  const access = resolveFolderAccess(folder, userId, companyIds);
  if (!canReadFolder(access)) return null;
  return { folder, access };
}

/**
 * Prisma where: tasks the user may see in Work (Monday-like).
 * - Always: tasks you own/are on, plus boards you own or were invited to, plus SIEP projects you belong to.
 * - Company ADMIN also sees every SHARED / membered team board (management overview).
 * - Never dumps another person's private board or unfoldered Mi trabajo into the company view.
 */
export function folderVisibleTaskFilter(
  userId: string,
  opts?: { companyAdmin?: boolean; projectIds?: string[] },
) {
  const or: Record<string, unknown>[] = [
    { assigneeId: userId },
    { creatorId: userId },
    { responsibleId: userId },
    { reviewerId: userId },
    { folder: { ownerId: userId } },
    { folder: { members: { some: { userId } } } },
  ];
  if (opts?.projectIds?.length) {
    or.push({ projectId: { in: opts.projectIds } });
  }
  if (opts?.companyAdmin) {
    // Management overview = boards shared with the company or with members — not private pools
    or.push({
      folder: {
        OR: [{ visibility: 'SHARED' }, { members: { some: {} } }],
      },
    });
  }
  return { OR: or };
}

export function accessibleFoldersWhere(userId: string, companyId: string) {
  return {
    companyId,
    isActive: true,
    OR: [
      { ownerId: userId },
      { members: { some: { userId } } },
      { shares: { some: { status: 'active', userId } } },
    ],
  };
}

export function assertMinAccess(access: WorkFolderAccess, min: WorkFolderAccess): boolean {
  return RANK[access] >= RANK[min];
}
