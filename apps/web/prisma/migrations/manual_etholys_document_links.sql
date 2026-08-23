-- Etholys document links (Studio + Core) — additive
CREATE TABLE IF NOT EXISTS "EtholysDocumentLink" (
  "id" TEXT NOT NULL,
  "targetType" TEXT NOT NULL,
  "studioDocumentId" TEXT,
  "coreDocumentId" TEXT,
  "companyId" TEXT NOT NULL,
  "systemKey" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "label" TEXT,
  "meta" JSONB,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EtholysDocumentLink_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "EtholysDocumentLink_companyId_idx" ON "EtholysDocumentLink"("companyId");
CREATE INDEX IF NOT EXISTS "EtholysDocumentLink_studioDocumentId_idx" ON "EtholysDocumentLink"("studioDocumentId");
CREATE INDEX IF NOT EXISTS "EtholysDocumentLink_coreDocumentId_idx" ON "EtholysDocumentLink"("coreDocumentId");
CREATE INDEX IF NOT EXISTS "EtholysDocumentLink_systemKey_entityType_entityId_idx"
  ON "EtholysDocumentLink"("systemKey", "entityType", "entityId");
CREATE INDEX IF NOT EXISTS "EtholysDocumentLink_targetType_companyId_idx"
  ON "EtholysDocumentLink"("targetType", "companyId");

DO $$ BEGIN
  ALTER TABLE "EtholysDocumentLink" ADD CONSTRAINT "EtholysDocumentLink_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "EtholysDocumentLink" ADD CONSTRAINT "EtholysDocumentLink_studioDocumentId_fkey"
    FOREIGN KEY ("studioDocumentId") REFERENCES "StudioDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "EtholysDocumentLink" ADD CONSTRAINT "EtholysDocumentLink_coreDocumentId_fkey"
    FOREIGN KEY ("coreDocumentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
