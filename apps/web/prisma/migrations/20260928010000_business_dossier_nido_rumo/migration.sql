CREATE TABLE IF NOT EXISTS "BusinessDossier" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "portraitText" TEXT NOT NULL DEFAULT '',
    "hypothesis" TEXT NOT NULL DEFAULT '',
    "hypothesisAccepted" BOOLEAN NOT NULL DEFAULT false,
    "gapsJson" JSONB NOT NULL DEFAULT '[]',
    "potentialsJson" JSONB NOT NULL DEFAULT '[]',
    "interviewJson" JSONB NOT NULL DEFAULT '{}',
    "pulsoModule" TEXT,
    "updatedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BusinessDossier_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "BusinessDossier_companyId_key" ON "BusinessDossier"("companyId");
CREATE INDEX IF NOT EXISTS "BusinessDossier_updatedAt_idx" ON "BusinessDossier"("updatedAt");

CREATE TABLE IF NOT EXISTS "BusinessBet" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "why" TEXT NOT NULL DEFAULT '',
    "ownerLabel" TEXT,
    "dueAt" TIMESTAMP(3),
    "indicator" TEXT,
    "status" TEXT NOT NULL DEFAULT 'proposed',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BusinessBet_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "BusinessBet_companyId_status_idx" ON "BusinessBet"("companyId", "status");

CREATE TABLE IF NOT EXISTS "BusinessRhythmNote" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "happened" TEXT NOT NULL DEFAULT '',
    "blocked" TEXT NOT NULL DEFAULT '',
    "nextStep" TEXT NOT NULL DEFAULT '',
    "source" TEXT NOT NULL DEFAULT 'app',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BusinessRhythmNote_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "BusinessRhythmNote_companyId_createdAt_idx" ON "BusinessRhythmNote"("companyId", "createdAt");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'BusinessDossier_companyId_fkey') THEN
    ALTER TABLE "BusinessDossier" ADD CONSTRAINT "BusinessDossier_companyId_fkey"
      FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'BusinessBet_companyId_fkey') THEN
    ALTER TABLE "BusinessBet" ADD CONSTRAINT "BusinessBet_companyId_fkey"
      FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'BusinessRhythmNote_companyId_fkey') THEN
    ALTER TABLE "BusinessRhythmNote" ADD CONSTRAINT "BusinessRhythmNote_companyId_fkey"
      FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
