import { prisma } from '@/lib/prisma';

export type AnvilAccess = {
  userId: string;
  email: string;
  role: string;
  isOwner: boolean;
  hasAccess: boolean;
};

function ownerEmailsFromEnv(): string[] {
  return (process.env.LAB_ANVIL_OWNER_EMAILS || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function isAnvilOwnerEmail(email: string, userRole?: string): boolean {
  const owners = ownerEmailsFromEnv();
  const normalized = email.trim().toLowerCase();
  if (owners.length > 0) return owners.includes(normalized);
  // Bootstrap: sem env, ADMIN conta como owner
  return userRole === 'ADMIN';
}

export async function resolveAnvilAccess(userId: string, email: string, role: string): Promise<AnvilAccess> {
  const isOwner = isAnvilOwnerEmail(email, role);
  if (isOwner) {
    return { userId, email, role, isOwner: true, hasAccess: true };
  }

  const member = await prisma.labAnvilMember.findFirst({
    where: {
      status: 'active',
      OR: [{ userId }, { email: email.toLowerCase() }],
    },
  });

  return {
    userId,
    email,
    role,
    isOwner: false,
    hasAccess: !!member,
  };
}

export async function requireAnvilAccess(): Promise<AnvilAccess | null> {
  const { getServerSession } = await import('next-auth');
  const { authOptions } = await import('@/lib/auth-options');
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return null;

  let userId = session.user.id as string | undefined;
  const email = session.user.email;

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, role: true, email: true },
  });
  if (!user) return null;
  userId = user.id;

  return resolveAnvilAccess(userId, user.email, user.role);
}

export async function canAccessProject(
  access: AnvilAccess,
  projectId: string,
): Promise<boolean> {
  if (access.isOwner) return true;

  const member = await prisma.labAnvilProjectMember.findFirst({
    where: {
      projectId,
      status: 'active',
      OR: [{ userId: access.userId }, { email: access.email.toLowerCase() }],
    },
  });
  return !!member;
}

export function generateInviteCode(length = 8): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < length; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}
