import { prisma } from '../lib/prisma';
import { forgeCourseInclude } from '../lib/forge/queries';
import { getCourseProgressPercent } from '../lib/forge/progress';
import { serializeForgeCourse } from '../lib/forge/serialize';

async function main() {
  console.log('forgeCourse?', typeof prisma.forgeCourse?.findMany);
  const companyId = process.argv[2];
  if (!companyId) {
    console.log('usage: npx tsx scripts/test-forge-courses-api.ts <companyId>');
    process.exit(1);
  }

  const courses = await prisma.forgeCourse.findMany({
    where: { companyId },
    include: forgeCourseInclude,
    orderBy: { updatedAt: 'desc' },
  });
  console.log('courses found:', courses.length);

  if (courses[0]) {
    const c = courses[0];
    const progressPercent = await getCourseProgressPercent(c.id, 'test-user');
    const profile = await prisma.forgeLearnerProfile.findUnique({
      where: { courseId_userId: { courseId: c.id, userId: 'test-user' } },
    });
    serializeForgeCourse(c, { progressPercent, xp: profile?.xp, level: profile?.level });
    console.log('serialize ok');
  }
  console.log('ALL OK');
}

main()
  .catch((e) => {
    console.error('FAILED:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
