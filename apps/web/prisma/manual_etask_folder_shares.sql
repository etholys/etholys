CREATE TABLE IF NOT EXISTS "WorkFolderShare" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "folderId" TEXT NOT NULL,
  "role" TEXT NOT NULL DEFAULT 'viewer',
  "email" TEXT NOT NULL,
  "userId" TEXT,
  "accessMode" TEXT NOT NULL DEFAULT 'company_member',
  "token" TEXT NOT NULL,
  "magicLoginToken" TEXT,
  "magicLoginExpiresAt" TIMESTAMP(3),
  "status" TEXT NOT NULL DEFAULT 'active',
  "invitedById" TEXT,
  "acceptedAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WorkFolderShare_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "WorkFolderShare_token_key" ON "WorkFolderShare"("token");
CREATE UNIQUE INDEX IF NOT EXISTS "WorkFolderShare_magicLoginToken_key" ON "WorkFolderShare"("magicLoginToken");
CREATE INDEX IF NOT EXISTS "WorkFolderShare_folderId_status_idx" ON "WorkFolderShare"("folderId", "status");
CREATE INDEX IF NOT EXISTS "WorkFolderShare_email_idx" ON "WorkFolderShare"("email");
CREATE INDEX IF NOT EXISTS "WorkFolderShare_userId_idx" ON "WorkFolderShare"("userId");
CREATE INDEX IF NOT EXISTS "WorkFolderShare_companyId_idx" ON "WorkFolderShare"("companyId");
