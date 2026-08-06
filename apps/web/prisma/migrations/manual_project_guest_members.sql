-- Project guests + permissões por projeto
ALTER TABLE "ProjectMember" ADD COLUMN IF NOT EXISTS "accessMode" TEXT NOT NULL DEFAULT 'company_staff';
ALTER TABLE "ProjectMember" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'active';
ALTER TABLE "ProjectMember" ADD COLUMN IF NOT EXISTS "permissions" JSONB;

CREATE INDEX IF NOT EXISTS "ProjectMember_userId_idx" ON "ProjectMember"("userId");
CREATE INDEX IF NOT EXISTS "ProjectMember_accessMode_status_idx" ON "ProjectMember"("accessMode", "status");

ALTER TABLE "Invitation" ADD COLUMN IF NOT EXISTS "projectId" TEXT;
ALTER TABLE "Invitation" ADD COLUMN IF NOT EXISTS "accessMode" TEXT NOT NULL DEFAULT 'company';
ALTER TABLE "Invitation" ADD COLUMN IF NOT EXISTS "projectPermissions" JSONB;

CREATE INDEX IF NOT EXISTS "Invitation_projectId_idx" ON "Invitation"("projectId");
CREATE INDEX IF NOT EXISTS "Invitation_email_status_idx" ON "Invitation"("email", "status");

DO $$ BEGIN
  ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
