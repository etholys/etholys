import { randomBytes } from 'crypto';
import { getForgeDb } from '@/lib/forge/db';

export function generateVerifyCode(): string {
  return `FG-${randomBytes(6).toString('hex').toUpperCase()}`;
}

export async function issueForgeCertificate(opts: {
  companyId: string;
  courseId: string;
  userId: string;
  courseTitle: string;
}) {
  const existing = await getForgeDb().forgeCertificate.findUnique({
    where: { courseId_userId: { courseId: opts.courseId, userId: opts.userId } },
  });
  if (existing) return existing;

  return getForgeDb().forgeCertificate.create({
    data: {
      companyId: opts.companyId,
      courseId: opts.courseId,
      userId: opts.userId,
      title: opts.courseTitle,
      verifyCode: generateVerifyCode(),
      metadata: { issuedBy: 'forge-auto' },
    },
  });
}
