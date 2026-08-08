import 'server-only';

import { prisma } from '@/lib/prisma';
import { isSystemAdmin } from '@/lib/platform-access';

/**
 * Acesso ao Etholys Lab (/lab, MUSE, …).
 * System admin OU LabInvite aceite. Não usa User.role=ADMIN (admin de empresa).
 */
export async function hasLabAccess(opts: {
  userId: string;
  email: string;
}): Promise<boolean> {
  if (isSystemAdmin(opts.email)) return true;

  const invite = await prisma.labInvite.findFirst({
    where: {
      status: 'ACCEPTED',
      OR: [{ userId: opts.userId }, { email: opts.email.toLowerCase() }],
    },
    select: { id: true },
  });
  return !!invite;
}

export async function requireLabAccessForSession(): Promise<{
  userId: string;
  email: string;
  role: string;
  isSystemAdmin: boolean;
} | null> {
  const { getServerSession } = await import('next-auth');
  const { authOptions } = await import('@/lib/auth-options');
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return null;

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true, role: true, email: true },
  });
  if (!user) return null;

  const ok = await hasLabAccess({ userId: user.id, email: user.email });
  if (!ok) return null;

  return {
    userId: user.id,
    email: user.email,
    role: user.role,
    isSystemAdmin: isSystemAdmin(user.email),
  };
}
