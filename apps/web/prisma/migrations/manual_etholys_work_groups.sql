-- Etholys Work F1: task groups / sections (Monday-style)
-- Safe additive migration for Contabo / manual apply.

CREATE TABLE IF NOT EXISTS "TaskGroup" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "color" TEXT,
  "order" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TaskGroup_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "TaskGroup"
    ADD CONSTRAINT "TaskGroup_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "TaskGroup_companyId_order_idx" ON "TaskGroup"("companyId", "order");

DO $$ BEGIN
  ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "groupId" TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "Task"
    ADD CONSTRAINT "Task_groupId_fkey"
    FOREIGN KEY ("groupId") REFERENCES "TaskGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "Task_groupId_idx" ON "Task"("groupId");
CREATE INDEX IF NOT EXISTS "Task_companyId_idx" ON "Task"("companyId");
