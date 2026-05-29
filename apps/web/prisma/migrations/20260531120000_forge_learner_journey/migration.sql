ALTER TABLE "ForgeCourse" ADD COLUMN IF NOT EXISTS "gamePlayMode" TEXT NOT NULL DEFAULT 'personal';

CREATE TABLE IF NOT EXISTS "ForgeLearnerJourney" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "mapState" JSONB NOT NULL DEFAULT '{}',
    "materials" JSONB NOT NULL DEFAULT '[]',
    "timeline" JSONB NOT NULL DEFAULT '[]',
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ForgeLearnerJourney_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ForgeLearnerJourney_courseId_userId_key" ON "ForgeLearnerJourney"("courseId", "userId");
CREATE INDEX IF NOT EXISTS "ForgeLearnerJourney_courseId_idx" ON "ForgeLearnerJourney"("courseId");
CREATE INDEX IF NOT EXISTS "ForgeLearnerJourney_userId_idx" ON "ForgeLearnerJourney"("userId");

ALTER TABLE "ForgeLearnerJourney" DROP CONSTRAINT IF EXISTS "ForgeLearnerJourney_courseId_fkey";
ALTER TABLE "ForgeLearnerJourney" ADD CONSTRAINT "ForgeLearnerJourney_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "ForgeCourse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ForgeLearnerJourney" DROP CONSTRAINT IF EXISTS "ForgeLearnerJourney_userId_fkey";
ALTER TABLE "ForgeLearnerJourney" ADD CONSTRAINT "ForgeLearnerJourney_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
