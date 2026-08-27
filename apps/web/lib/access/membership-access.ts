import 'server-only';

import { prisma } from '@/lib/prisma';

/** Membro da empresa com acesso expirado (temporário) não deve ver módulos. */
export async function isCompanyMembershipExpired(
  userId: string,
  companyId: string,
): Promise<boolean> {
  const row = await prisma.companyUser.findUnique({
    where: { userId_companyId: { userId, companyId } },
    select: { accessUntil: true },
  });
  if (!row?.accessUntil) return false;
  return new Date() > row.accessUntil;
}
