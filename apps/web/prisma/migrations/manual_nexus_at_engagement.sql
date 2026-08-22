-- NEXUS — Assistência Técnica: Serviço → Projeto → Empresa
-- Aplicar manualmente se prisma migrate não estiver disponível.

CREATE TABLE IF NOT EXISTS "NexusAtEngagement" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "kind" TEXT NOT NULL DEFAULT 'CONTRACT',
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "operatorCompanyId" TEXT NOT NULL,
  "networkId" TEXT,
  "siepProjectId" TEXT,
  "description" TEXT,
  "contractRef" TEXT,
  "startDate" TIMESTAMP(3),
  "endDate" TIMESTAMP(3),
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "NexusAtEngagement_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "NexusAtEngagement_operatorCompanyId_idx" ON "NexusAtEngagement"("operatorCompanyId");
CREATE INDEX IF NOT EXISTS "NexusAtEngagement_networkId_idx" ON "NexusAtEngagement"("networkId");
CREATE INDEX IF NOT EXISTS "NexusAtEngagement_siepProjectId_idx" ON "NexusAtEngagement"("siepProjectId");
CREATE INDEX IF NOT EXISTS "NexusAtEngagement_status_isActive_idx" ON "NexusAtEngagement"("status", "isActive");

CREATE TABLE IF NOT EXISTS "NexusAtEngagementMember" (
  "id" TEXT NOT NULL,
  "engagementId" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "memberRole" TEXT NOT NULL DEFAULT 'client',
  "notes" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "NexusAtEngagementMember_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "NexusAtEngagementMember_engagementId_companyId_key"
  ON "NexusAtEngagementMember"("engagementId", "companyId");
CREATE INDEX IF NOT EXISTS "NexusAtEngagementMember_companyId_idx" ON "NexusAtEngagementMember"("companyId");
CREATE INDEX IF NOT EXISTS "NexusAtEngagementMember_engagementId_memberRole_idx"
  ON "NexusAtEngagementMember"("engagementId", "memberRole");

CREATE TABLE IF NOT EXISTS "NexusAtProject" (
  "id" TEXT NOT NULL,
  "engagementId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "siepProjectId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "NexusAtProject_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "NexusAtProject_engagementId_idx" ON "NexusAtProject"("engagementId");
CREATE INDEX IF NOT EXISTS "NexusAtProject_siepProjectId_idx" ON "NexusAtProject"("siepProjectId");
CREATE INDEX IF NOT EXISTS "NexusAtProject_engagementId_isActive_idx" ON "NexusAtProject"("engagementId", "isActive");

DO $$ BEGIN
  ALTER TABLE "NexusAtEngagement"
    ADD CONSTRAINT "NexusAtEngagement_operatorCompanyId_fkey"
    FOREIGN KEY ("operatorCompanyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "NexusAtEngagement"
    ADD CONSTRAINT "NexusAtEngagement_networkId_fkey"
    FOREIGN KEY ("networkId") REFERENCES "NexusNetwork"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "NexusAtEngagement"
    ADD CONSTRAINT "NexusAtEngagement_siepProjectId_fkey"
    FOREIGN KEY ("siepProjectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "NexusAtEngagementMember"
    ADD CONSTRAINT "NexusAtEngagementMember_engagementId_fkey"
    FOREIGN KEY ("engagementId") REFERENCES "NexusAtEngagement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "NexusAtEngagementMember"
    ADD CONSTRAINT "NexusAtEngagementMember_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "NexusAtProject"
    ADD CONSTRAINT "NexusAtProject_engagementId_fkey"
    FOREIGN KEY ("engagementId") REFERENCES "NexusAtEngagement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "NexusAtProject"
    ADD CONSTRAINT "NexusAtProject_siepProjectId_fkey"
    FOREIGN KEY ("siepProjectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
