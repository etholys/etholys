export type MyProgramCourse = {
  id: string;
  title: string;
  coverEmoji: string;
  progressPercent: number;
  status: string;
};

export type MyProgram = {
  id: string;
  title: string;
  description: string | null;
  courses: MyProgramCourse[];
  overallProgress: number;
};
