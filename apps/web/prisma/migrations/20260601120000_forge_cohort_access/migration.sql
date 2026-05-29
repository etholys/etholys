ALTER TABLE "ForgeCourse" ADD COLUMN IF NOT EXISTS "cohortMode" TEXT NOT NULL DEFAULT 'invite_only';

ALTER TABLE "ForgeEnrollment" ADD COLUMN IF NOT EXISTS "accessScope" TEXT NOT NULL DEFAULT 'course_only';
ALTER TABLE "ForgeEnrollment" ADD COLUMN IF NOT EXISTS "invitedById" TEXT;
