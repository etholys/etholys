import { prisma } from '@/lib/prisma';

/** True if `candidateAncestorId` is on the path from `folderId` up to root. */
export async function studioFolderIsDescendantOf(
  folderId: string,
  candidateAncestorId: string,
): Promise<boolean> {
  if (folderId === candidateAncestorId) return true;
  const seen = new Set<string>();
  let cur: string | null = folderId;
  while (cur && !seen.has(cur)) {
    seen.add(cur);
    const row = await prisma.studioFolder.findFirst({
      where: { id: cur },
      select: { parentId: true },
    });
    if (!row) break;
    if (row.parentId === candidateAncestorId) return true;
    cur = row.parentId;
  }
  return false;
}
