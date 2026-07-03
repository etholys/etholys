-- SIEP: pacotes de informe donante + vínculo indicador-actividade (schema MEReport*)
-- Executar manualmente se prisma db push não for possível no ambiente.

ALTER TABLE "MEReport" ADD COLUMN IF NOT EXISTS "cadence" TEXT;
ALTER TABLE "MEReport" ADD COLUMN IF NOT EXISTS "component" TEXT;
ALTER TABLE "MEReport" ADD COLUMN IF NOT EXISTS "donorFormat" TEXT;
ALTER TABLE "MEReport" ADD COLUMN IF NOT EXISTS "packageId" TEXT;
ALTER TABLE "MEReport" ADD COLUMN IF NOT EXISTS "parentReportId" TEXT;

CREATE TABLE IF NOT EXISTS "MEReportPackage" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "cadence" TEXT NOT NULL DEFAULT 'quarterly',
  "period" TEXT,
  "status" TEXT NOT NULL DEFAULT 'draft',
  "donorFormat" TEXT NOT NULL DEFAULT 'generic',
  "notes" TEXT,
  "parentPackageId" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MEReportPackage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "MEReportFile" (
  "id" TEXT NOT NULL,
  "packageId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "cloudStoragePath" TEXT NOT NULL,
  "mimeType" TEXT,
  "fileSizeBytes" INTEGER NOT NULL DEFAULT 0,
  "component" TEXT NOT NULL DEFAULT 'other',
  "cadence" TEXT,
  "aiDetectedComponent" TEXT,
  "aiDetectedCadence" TEXT,
  "aiValidation" JSONB,
  "userConfirmed" BOOLEAN NOT NULL DEFAULT false,
  "order" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MEReportFile_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "MEReport_packageId_idx" ON "MEReport"("packageId");
CREATE INDEX IF NOT EXISTS "MEReport_parentReportId_idx" ON "MEReport"("parentReportId");
CREATE INDEX IF NOT EXISTS "MEReportPackage_projectId_idx" ON "MEReportPackage"("projectId");
CREATE INDEX IF NOT EXISTS "MEReportPackage_projectId_cadence_idx" ON "MEReportPackage"("projectId", "cadence");
CREATE INDEX IF NOT EXISTS "MEReportPackage_parentPackageId_idx" ON "MEReportPackage"("parentPackageId");
CREATE INDEX IF NOT EXISTS "MEReportFile_packageId_idx" ON "MEReportFile"("packageId");
CREATE INDEX IF NOT EXISTS "MEReportFile_projectId_idx" ON "MEReportFile"("projectId");

DO $$ BEGIN
  ALTER TABLE "MEReport" ADD CONSTRAINT "MEReport_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "MEReportPackage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "MEReport" ADD CONSTRAINT "MEReport_parentReportId_fkey" FOREIGN KEY ("parentReportId") REFERENCES "MEReport"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "MEReportPackage" ADD CONSTRAINT "MEReportPackage_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "MEReportPackage" ADD CONSTRAINT "MEReportPackage_parentPackageId_fkey" FOREIGN KEY ("parentPackageId") REFERENCES "MEReportPackage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "MEReportFile" ADD CONSTRAINT "MEReportFile_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "MEReportPackage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "MEReportFile" ADD CONSTRAINT "MEReportFile_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
