-- Etholys Work: user-managed folders (personal + shared)
-- Safe additive migration for Contabo / manual apply.

CREATE TABLE IF NOT EXISTS "WorkFolder" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "color" TEXT,
  "visibility" TEXT NOT NULL DEFAULT 'PERSONAL',
  "ownerId" TEXT NOT NULL,
  "order" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WorkFolder_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "WorkFolderMember" (
  "id" TEXT NOT NULL,
  "folderId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "role" TEXT NOT NULL DEFAULT 'member',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WorkFolderMember_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "WorkFolder"
    ADD CONSTRAINT "WorkFolder_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "WorkFolder"
    ADD CONSTRAINT "WorkFolder_ownerId_fkey"
    FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "WorkFolderMember"
    ADD CONSTRAINT "WorkFolderMember_folderId_fkey"
    FOREIGN KEY ("folderId") REFERENCES "WorkFolder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "WorkFolderMember"
    ADD CONSTRAINT "WorkFolderMember_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "WorkFolderMember_folderId_userId_key" ON "WorkFolderMember"("folderId", "userId");
CREATE INDEX IF NOT EXISTS "WorkFolder_companyId_ownerId_idx" ON "WorkFolder"("companyId", "ownerId");
CREATE INDEX IF NOT EXISTS "WorkFolder_companyId_visibility_idx" ON "WorkFolder"("companyId", "visibility");
CREATE INDEX IF NOT EXISTS "WorkFolderMember_userId_idx" ON "WorkFolderMember"("userId");

DO $$ BEGIN
  ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "folderId" TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "Task"
    ADD CONSTRAINT "Task_folderId_fkey"
    FOREIGN KEY ("folderId") REFERENCES "WorkFolder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "Task_folderId_idx" ON "Task"("folderId");
