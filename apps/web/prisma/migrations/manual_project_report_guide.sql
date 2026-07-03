-- Cria tabela de manuais de reporte (se ainda não existir) + coluna domain

CREATE TABLE IF NOT EXISTS "ProjectReportGuide" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "cloudStoragePath" TEXT NOT NULL,
  "mimeType" TEXT,
  "fileSizeBytes" INTEGER NOT NULL DEFAULT 0,
  "extractedText" TEXT,
  "extractionStatus" TEXT NOT NULL DEFAULT 'pending',
  "uploadedById" TEXT,
  "order" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "domain" TEXT NOT NULL DEFAULT 'general',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProjectReportGuide_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ProjectReportGuide_projectId_idx" ON "ProjectReportGuide"("projectId");

DO $$ BEGIN
  ALTER TABLE "ProjectReportGuide" ADD CONSTRAINT "ProjectReportGuide_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "ProjectReportGuide" ADD CONSTRAINT "ProjectReportGuide_uploadedById_fkey"
    FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "ProjectReportGuide" ADD COLUMN IF NOT EXISTS "domain" TEXT NOT NULL DEFAULT 'general';
