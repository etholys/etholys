-- FundHub: memória de hosts visitados (cooldown ~7 dias por empresa)
CREATE TABLE IF NOT EXISTS "FundhubSourceVisit" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "host" TEXT NOT NULL,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastRunId" TEXT,
  "hitCount" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FundhubSourceVisit_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "FundhubSourceVisit_companyId_host_key"
  ON "FundhubSourceVisit"("companyId", "host");

CREATE INDEX IF NOT EXISTS "FundhubSourceVisit_companyId_lastSeenAt_idx"
  ON "FundhubSourceVisit"("companyId", "lastSeenAt");

DO $$ BEGIN
  ALTER TABLE "FundhubSourceVisit"
    ADD CONSTRAINT "FundhubSourceVisit_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
