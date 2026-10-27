-- Etholys Work: folder tree (FOLDER | BOARD) + personal dashboard layout
-- Safe additive migration for Contabo / manual apply.

DO $$ BEGIN
  ALTER TABLE "WorkFolder" ADD COLUMN IF NOT EXISTS "kind" TEXT NOT NULL DEFAULT 'BOARD';
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "WorkFolder" ADD COLUMN IF NOT EXISTS "parentId" TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "WorkFolder"
    ADD CONSTRAINT "WorkFolder_parentId_fkey"
    FOREIGN KEY ("parentId") REFERENCES "WorkFolder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "WorkFolder_parentId_idx" ON "WorkFolder"("parentId");
CREATE INDEX IF NOT EXISTS "WorkFolder_companyId_kind_idx" ON "WorkFolder"("companyId", "kind");

-- Existing rows are boards (task containers).
UPDATE "WorkFolder" SET "kind" = 'BOARD' WHERE "kind" IS NULL OR "kind" = '';

CREATE TABLE IF NOT EXISTS "WorkDashboardLayout" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "layoutJson" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WorkDashboardLayout_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "WorkDashboardLayout"
    ADD CONSTRAINT "WorkDashboardLayout_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "WorkDashboardLayout"
    ADD CONSTRAINT "WorkDashboardLayout_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "WorkDashboardLayout_companyId_userId_key"
  ON "WorkDashboardLayout"("companyId", "userId");
CREATE INDEX IF NOT EXISTS "WorkDashboardLayout_userId_idx" ON "WorkDashboardLayout"("userId");
