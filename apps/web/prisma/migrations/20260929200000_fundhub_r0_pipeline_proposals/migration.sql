-- FundHub R0/R1: colunas de mesa + draft JSON de propostas.
-- Idempotente (IF NOT EXISTS) — seguro em produção.

ALTER TABLE "Fund" ADD COLUMN IF NOT EXISTS "pipelineStatus" TEXT NOT NULL DEFAULT 'decide';
ALTER TABLE "Fund" ADD COLUMN IF NOT EXISTS "ownerUserId" TEXT;
ALTER TABLE "Fund" ADD COLUMN IF NOT EXISTS "watchOpen" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Fund" ADD COLUMN IF NOT EXISTS "fundHubMetaJson" JSONB;

CREATE INDEX IF NOT EXISTS "Fund_companyId_pipelineStatus_idx" ON "Fund"("companyId", "pipelineStatus");
CREATE INDEX IF NOT EXISTS "Fund_companyId_ownerUserId_idx" ON "Fund"("companyId", "ownerUserId");
CREATE INDEX IF NOT EXISTS "Fund_companyId_watchOpen_idx" ON "Fund"("companyId", "watchOpen");

DO $$ BEGIN
  ALTER TABLE "Fund" ADD CONSTRAINT "Fund_ownerUserId_fkey"
    FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "Proposal" ADD COLUMN IF NOT EXISTS "draftJson" JSONB;

ALTER TABLE "Fund" ADD COLUMN IF NOT EXISTS "amountRequested" DOUBLE PRECISION;
ALTER TABLE "Fund" ADD COLUMN IF NOT EXISTS "decisionOutcome" TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE "Fund" ADD COLUMN IF NOT EXISTS "decisionNote" TEXT;
