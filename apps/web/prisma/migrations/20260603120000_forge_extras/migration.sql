ALTER TABLE "ForgeProgram" ADD COLUMN IF NOT EXISTS "enforceOrder" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ForgeCourse" ADD COLUMN IF NOT EXISTS "programSortOrder" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "ForgeEnrollment" ADD COLUMN IF NOT EXISTS "magicLoginToken" TEXT;
ALTER TABLE "ForgeEnrollment" ADD COLUMN IF NOT EXISTS "magicLoginExpiresAt" TIMESTAMP(3);
ALTER TABLE "ForgeEnrollment" ADD COLUMN IF NOT EXISTS "passwordSetAt" TIMESTAMP(3);
CREATE UNIQUE INDEX IF NOT EXISTS "ForgeEnrollment_magicLoginToken_key" ON "ForgeEnrollment"("magicLoginToken");
CREATE INDEX IF NOT EXISTS "ForgeEnrollment_magicLoginToken_idx" ON "ForgeEnrollment"("magicLoginToken");

CREATE TABLE IF NOT EXISTS "ForgeCourseFacilitator" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'facilitator',
    CONSTRAINT "ForgeCourseFacilitator_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ForgeCourseFacilitator_courseId_userId_key" ON "ForgeCourseFacilitator"("courseId", "userId");
CREATE INDEX IF NOT EXISTS "ForgeCourseFacilitator_userId_idx" ON "ForgeCourseFacilitator"("userId");
ALTER TABLE "ForgeCourseFacilitator" ADD CONSTRAINT "ForgeCourseFacilitator_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "ForgeCourse"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ForgeCourseFacilitator" ADD CONSTRAINT "ForgeCourseFacilitator_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "ForgeLiveAttendance" (
    "id" TEXT NOT NULL,
    "liveSessionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" TIMESTAMP(3),
    CONSTRAINT "ForgeLiveAttendance_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ForgeLiveAttendance_liveSessionId_userId_key" ON "ForgeLiveAttendance"("liveSessionId", "userId");
CREATE INDEX IF NOT EXISTS "ForgeLiveAttendance_userId_idx" ON "ForgeLiveAttendance"("userId");
ALTER TABLE "ForgeLiveAttendance" ADD CONSTRAINT "ForgeLiveAttendance_liveSessionId_fkey" FOREIGN KEY ("liveSessionId") REFERENCES "ForgeLiveSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ForgeLiveAttendance" ADD CONSTRAINT "ForgeLiveAttendance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
