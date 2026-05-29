-- CreateTable
CREATE TABLE IF NOT EXISTS "ForgeLiveSession" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3),
    "meetingUrl" TEXT,
    "activityId" TEXT,
    "facilitatorNotes" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ForgeLiveSession_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ForgeLiveSession_courseId_startsAt_idx" ON "ForgeLiveSession"("courseId", "startsAt");
CREATE INDEX IF NOT EXISTS "ForgeLiveSession_activityId_idx" ON "ForgeLiveSession"("activityId");

ALTER TABLE "ForgeLiveSession" DROP CONSTRAINT IF EXISTS "ForgeLiveSession_courseId_fkey";
ALTER TABLE "ForgeLiveSession" ADD CONSTRAINT "ForgeLiveSession_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "ForgeCourse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ForgeLiveSession" DROP CONSTRAINT IF EXISTS "ForgeLiveSession_activityId_fkey";
ALTER TABLE "ForgeLiveSession" ADD CONSTRAINT "ForgeLiveSession_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "ForgeLearningActivity"("id") ON DELETE SET NULL ON UPDATE CASCADE;
