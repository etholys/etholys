import type { CourseAnalytics } from '@/lib/forge/course-analytics-types';

export type ProgramCourseStat = CourseAnalytics & { title: string; coverEmoji: string };

export type ProgramAnalytics = {
  programId: string;
  title: string;
  courseCount: number;
  totalLearners: number;
  avgProgressAcrossCourses: number;
  courses: ProgramCourseStat[];
};
