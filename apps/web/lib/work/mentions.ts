import { prisma } from '@/lib/prisma';

/** Extrai @Nome do texto e resolve IDs de utilizadores da empresa (match por nome). */
export async function resolveTaskCommentMentions(
  content: string,
  companyIds: string[],
  excludeUserId?: string,
): Promise<{ mentionIds: string[]; mentionedUsers: { id: string; name: string }[] }> {
  const raw = String(content || '');
  const matches = [...raw.matchAll(/@([^\s@][^@]*?)(?=\s|$|@)/g)].map((m) => m[1].trim()).filter(Boolean);
  if (!matches.length || !companyIds.length) return { mentionIds: [], mentionedUsers: [] };

  const users = await prisma.user.findMany({
    where: {
      isActive: true,
      companyUsers: { some: { companyId: { in: companyIds } } },
    },
    select: { id: true, name: true },
  });

  const mentionedUsers: { id: string; name: string }[] = [];
  const seen = new Set<string>();

  for (const token of matches) {
    const needle = token.toLowerCase();
    const hit =
      users.find((u) => u.name.toLowerCase() === needle) ||
      users.find((u) => u.name.toLowerCase().startsWith(needle)) ||
      users.find((u) => u.name.toLowerCase().includes(needle));
    if (!hit || hit.id === excludeUserId || seen.has(hit.id)) continue;
    seen.add(hit.id);
    mentionedUsers.push(hit);
  }

  return { mentionIds: mentionedUsers.map((u) => u.id), mentionedUsers };
}

export function highlightMentions(content: string): { type: 'text' | 'mention'; value: string }[] {
  const parts = String(content || '').split(/(@[^\s@][^@]*?)(?=\s|$|@)/g);
  return parts.filter(Boolean).map((part) =>
    part.startsWith('@')
      ? { type: 'mention' as const, value: part }
      : { type: 'text' as const, value: part },
  );
}
