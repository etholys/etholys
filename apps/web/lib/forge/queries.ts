import type { Prisma } from '@prisma/client';

export const forgeCourseInclude = {
  modules: {
    orderBy: { sortOrder: 'asc' as const },
    include: {
      activities: {
        orderBy: { sortOrder: 'asc' as const },
        include: { gameSpec: true },
      },
    },
  },
} satisfies Prisma.ForgeCourseInclude;
