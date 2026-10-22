ALTER TABLE "TaskGroup" ADD COLUMN IF NOT EXISTS "folderId" TEXT;
CREATE INDEX IF NOT EXISTS "TaskGroup_folderId_idx" ON "TaskGroup"("folderId");

CREATE TABLE IF NOT EXISTS "WorkBoardLayout" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "scopeKey" TEXT NOT NULL,
  "layoutJson" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WorkBoardLayout_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "WorkBoardLayout_companyId_scopeKey_key"
  ON "WorkBoardLayout"("companyId", "scopeKey");

CREATE INDEX IF NOT EXISTS "WorkBoardLayout_companyId_idx"
  ON "WorkBoardLayout"("companyId");
