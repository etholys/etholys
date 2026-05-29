/** Tipos do percurso do aluno — sem Prisma (safe para Client Components). */

export type JourneyTimelineEntry = {
  id: string;
  at: string;
  type: string;
  title: string;
  detail?: string;
  activityId?: string;
  moduleTitle?: string;
  payload?: Record<string, unknown>;
};

export type JourneyMaterial = {
  id: string;
  at: string;
  kind: 'ficha' | 'insight' | 'quiz' | 'lesson' | 'certificate' | 'game';
  title: string;
  body?: string;
  activityId?: string;
  score?: number;
};

export type JourneyStation = {
  moduleId: string;
  title: string;
  sortOrder: number;
  completed: boolean;
  activityTotal: number;
  activityDone: number;
};

export type JourneyMapState = {
  stations: JourneyStation[];
  board?: {
    position?: number;
    ecoCredits?: number;
    impactPoints?: number;
    insightsCount?: number;
    finished?: boolean;
    activityId?: string;
    updatedAt?: string;
  };
  progressPercent: number;
};
