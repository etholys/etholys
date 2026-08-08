-- Etholys Work F3/F4: comment mentions + task approval requests (CARTA bridge)
-- Additive / safe for Contabo.

DO $$ BEGIN
  ALTER TABLE "Comment" ADD COLUMN IF NOT EXISTS "mentions" TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "TaskApprovalRequest" (
  "id" TEXT NOT NULL,
  "taskId" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "requesterId" TEXT NOT NULL,
  "approverId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "note" TEXT,
  "decisionNote" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "decidedAt" TIMESTAMP(3),
  CONSTRAINT "TaskApprovalRequest_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "TaskApprovalRequest"
    ADD CONSTRAINT "TaskApprovalRequest_taskId_fkey"
    FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "TaskApprovalRequest"
    ADD CONSTRAINT "TaskApprovalRequest_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "TaskApprovalRequest"
    ADD CONSTRAINT "TaskApprovalRequest_requesterId_fkey"
    FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "TaskApprovalRequest"
    ADD CONSTRAINT "TaskApprovalRequest_approverId_fkey"
    FOREIGN KEY ("approverId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "TaskApprovalRequest_companyId_status_idx" ON "TaskApprovalRequest"("companyId", "status");
CREATE INDEX IF NOT EXISTS "TaskApprovalRequest_approverId_status_idx" ON "TaskApprovalRequest"("approverId", "status");
CREATE INDEX IF NOT EXISTS "TaskApprovalRequest_taskId_idx" ON "TaskApprovalRequest"("taskId");
