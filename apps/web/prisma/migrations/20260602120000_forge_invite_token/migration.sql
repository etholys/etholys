ALTER TABLE "ForgeEnrollment" ADD COLUMN IF NOT EXISTS "inviteToken" TEXT;
ALTER TABLE "ForgeEnrollment" ADD COLUMN IF NOT EXISTS "inviteExpiresAt" TIMESTAMP(3);
CREATE UNIQUE INDEX IF NOT EXISTS "ForgeEnrollment_inviteToken_key" ON "ForgeEnrollment"("inviteToken");
CREATE INDEX IF NOT EXISTS "ForgeEnrollment_inviteToken_idx" ON "ForgeEnrollment"("inviteToken");
