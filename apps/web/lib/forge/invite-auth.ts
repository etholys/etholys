import 'server-only';

import { randomBytes } from 'crypto';
import { getForgeDb } from '@/lib/forge/db';

const MAGIC_TTL_HOURS = 48;

export function generateMagicLoginToken(): string {
  return randomBytes(32).toString('base64url');
}

export function magicLoginExpiresAt(): Date {
  const d = new Date();
  d.setHours(d.getHours() + MAGIC_TTL_HOURS);
  return d;
}

export async function refreshEnrollmentMagicToken(enrollmentId: string): Promise<string> {
  const token = generateMagicLoginToken();
  await getForgeDb().forgeEnrollment.update({
    where: { id: enrollmentId },
    data: {
      magicLoginToken: token,
      magicLoginExpiresAt: magicLoginExpiresAt(),
    },
  });
  return token;
}

export async function findEnrollmentByMagicToken(token: string) {
  const now = new Date();
  return getForgeDb().forgeEnrollment.findFirst({
    where: {
      OR: [
        { magicLoginToken: token, magicLoginExpiresAt: { gt: now } },
        { inviteToken: token, inviteExpiresAt: { gt: now } },
      ],
    },
    include: {
      user: { select: { id: true, email: true, name: true, isActive: true, password: true } },
      course: { select: { id: true, title: true } },
    },
  });
}
