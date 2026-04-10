import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';

/**
 * Gets the current user's company IDs for multi-tenant data isolation.
 * Returns null if not authenticated.
 */
export async function getUserCompanyIds(): Promise<{ userId: string; companyIds: string[] } | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;

  let userId = session.user.id;

  // Check if JWT userId still exists in DB (may be stale after DB reset)
  const userExists = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!userExists && session.user.email) {
    // Fallback: find user by email
    const userByEmail = await prisma.user.findUnique({ where: { email: session.user.email }, select: { id: true } });
    if (!userByEmail) return null;
    userId = userByEmail.id;
  }

  const companyUsers = await prisma.companyUser.findMany({
    where: { userId },
    select: { companyId: true },
  });
  return {
    userId,
    companyIds: companyUsers.map(cu => cu.companyId),
  };
}

export async function requireAuth() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;
  return session;
}
