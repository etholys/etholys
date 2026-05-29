-- CreateTable
CREATE TABLE IF NOT EXISTS "ForgeSharedGameRoom" (
    "id" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "liveSessionId" TEXT,
    "facilitatorUserId" TEXT NOT NULL,
    "state" JSONB NOT NULL DEFAULT '{}',
    "lastEvents" JSONB,
    "status" TEXT NOT NULL DEFAULT 'open',
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ForgeSharedGameRoom_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ForgeSharedGameRoom_activityId_status_idx" ON "ForgeSharedGameRoom"("activityId", "status");
CREATE INDEX IF NOT EXISTS "ForgeSharedGameRoom_courseId_status_idx" ON "ForgeSharedGameRoom"("courseId", "status");

ALTER TABLE "ForgeSharedGameRoom" DROP CONSTRAINT IF EXISTS "ForgeSharedGameRoom_activityId_fkey";
ALTER TABLE "ForgeSharedGameRoom" ADD CONSTRAINT "ForgeSharedGameRoom_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "ForgeLearningActivity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ForgeSharedGameRoom" DROP CONSTRAINT IF EXISTS "ForgeSharedGameRoom_courseId_fkey";
ALTER TABLE "ForgeSharedGameRoom" ADD CONSTRAINT "ForgeSharedGameRoom_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "ForgeCourse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ForgeSharedGameRoom" DROP CONSTRAINT IF EXISTS "ForgeSharedGameRoom_liveSessionId_fkey";
ALTER TABLE "ForgeSharedGameRoom" ADD CONSTRAINT "ForgeSharedGameRoom_liveSessionId_fkey" FOREIGN KEY ("liveSessionId") REFERENCES "ForgeLiveSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ForgeSharedGameRoom" DROP CONSTRAINT IF EXISTS "ForgeSharedGameRoom_facilitatorUserId_fkey";
ALTER TABLE "ForgeSharedGameRoom" ADD CONSTRAINT "ForgeSharedGameRoom_facilitatorUserId_fkey" FOREIGN KEY ("facilitatorUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
