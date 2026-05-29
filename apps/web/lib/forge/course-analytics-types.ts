export type ModuleHeatmapRow = {
  moduleId: string;
  title: string;
  sortOrder: number;
  activityCount: number;
  completionRate: number;
};

export type CourseAnalytics = {
  courseId: string;
  learnerCount: number;
  completedCount: number;
  avgProgress: number;
  activeLast7Days: number;
  atRisk: {
    userId: string;
    name: string | null;
    email: string | null;
    progressPercent: number;
    enrolledAt: string;
  }[];
  moduleHeatmap: ModuleHeatmapRow[];
  certificatesIssued: number;
};
