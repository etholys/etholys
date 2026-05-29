-- AlterTable
ALTER TABLE "ForgeCourse" ADD COLUMN IF NOT EXISTS "deliveryMode" TEXT NOT NULL DEFAULT 'async';
ALTER TABLE "ForgeCourse" ADD COLUMN IF NOT EXISTS "liveConfig" JSONB;
