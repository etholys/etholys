import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { getGuestCompanyIds } from '@/lib/siep/permissions';

/**
 * Gets the current user's company IDs for multi-tenant data isolation.
 * Inclui empresas onde o utilizador é só convidado de projeto (project_guest).
 * Returns null if not authenticated.
 */
export async function getUserCompanyIds(): Promise<{ userId: string; companyIds: string[] } | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;

  const userId = session.user.id;

  // Confiar no JWT em uso normal — a verificação extra de existência na BD
  // (pós-reset) acrescentava latência a cada pedido autenticado.
  const [companyUsers, guestIds] = await Promise.all([
    prisma.companyUser.findMany({
      where: { userId },
      select: { companyId: true },
    }),
    getGuestCompanyIds(userId),
  ]);
  const memberIds = companyUsers.map((cu) => cu.companyId);
  return {
    userId,
    companyIds: [...new Set([...memberIds, ...guestIds])],
  };
}

export async function requireAuth() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;
  return session;
}
