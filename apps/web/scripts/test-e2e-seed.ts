import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

async function main() {
  const stamp = Date.now();
  const hash = await bcrypt.hash('E2eTest123!', 10);
  const email = `e2e-forge-${stamp}@etholys.test`;

  const company = await db.company.create({
    data: { name: `E2E Forge ${stamp}`, shortName: 'E2E', color: '#6366f1' },
  });

  const facilitator = await db.user.create({
    data: { email: `e2e-facil-${stamp}@etholys.test`, name: 'E2E Facilitator', password: hash, isActive: true },
  });

  await db.companyUser.create({
    data: { userId: facilitator.id, companyId: company.id, role: 'ADMIN', isDefault: true },
  });

  const learner = await db.user.create({
    data: { email, name: 'E2E Learner', password: hash, isActive: true },
  });

  const course = await db.forgeCourse.create({
    data: {
      companyId: company.id,
      title: `E2E Curso ${stamp}`,
      status: 'published',
      createdById: facilitator.id,
      cohortMode: 'invite_only',
    },
  });

  await db.forgeEnrollment.create({
    data: {
      courseId: course.id,
      userId: learner.id,
      status: 'active',
      accessScope: 'course_only',
      invitedById: facilitator.id,
      inviteToken: 'test-token-' + stamp,
      inviteExpiresAt: new Date(Date.now() + 86400000),
      magicLoginToken: 'magic-' + stamp,
      magicLoginExpiresAt: new Date(Date.now() + 86400000),
    },
  });

  await db.forgeLearnerProfile.create({
    data: { courseId: course.id, userId: learner.id },
  });

  console.log('OK', { courseId: course.id, email });
}

main()
  .catch((e) => {
    console.error('FAIL', e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
