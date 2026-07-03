-- SIEP: informes de actividade + permissões granulares
-- Executar manualmente se prisma migrate não estiver disponível

ALTER TABLE "CompanyUser" ADD COLUMN IF NOT EXISTS "siepPermissions" JSONB;
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "contentLocale" TEXT DEFAULT 'es';

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
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProjectReportGuide_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ProjectReportGuide_projectId_idx" ON "ProjectReportGuide"("projectId");
ALTER TABLE "ProjectReportGuide" ADD CONSTRAINT "ProjectReportGuide_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectReportGuide" ADD CONSTRAINT "ProjectReportGuide_uploadedById_fkey"
  FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "TaskActivityReport" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "taskId" TEXT NOT NULL,
  "authorId" TEXT NOT NULL,
  "reportDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "narrative" TEXT NOT NULL DEFAULT '',
  "progressPct" INTEGER,
  "status" TEXT NOT NULL DEFAULT 'draft',
  "budgetLineId" TEXT,
  "photoUrls" JSONB NOT NULL DEFAULT '[]',
  "deliverableUrls" JSONB NOT NULL DEFAULT '[]',
  "includesTravel" BOOLEAN NOT NULL DEFAULT false,
  "reviewedById" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "reviewNotes" TEXT,
  "transactionId" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TaskActivityReport_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "TaskActivityReport_transactionId_key" ON "TaskActivityReport"("transactionId");
CREATE INDEX IF NOT EXISTS "TaskActivityReport_projectId_taskId_idx" ON "TaskActivityReport"("projectId", "taskId");
CREATE INDEX IF NOT EXISTS "TaskActivityReport_authorId_idx" ON "TaskActivityReport"("authorId");
CREATE INDEX IF NOT EXISTS "TaskActivityReport_status_idx" ON "TaskActivityReport"("status");

CREATE TABLE IF NOT EXISTS "TaskMileageClaim" (
  "id" TEXT NOT NULL,
  "reportId" TEXT NOT NULL,
  "odometerStart" DOUBLE PRECISION NOT NULL,
  "odometerEnd" DOUBLE PRECISION NOT NULL,
  "distanceKm" DOUBLE PRECISION NOT NULL,
  "fromPlace" TEXT NOT NULL,
  "toPlace" TEXT NOT NULL,
  "city" TEXT NOT NULL,
  "country" TEXT NOT NULL,
  "odometerStartPhoto" TEXT,
  "odometerEndPhoto" TEXT,
  "receiptUrls" JSONB NOT NULL DEFAULT '[]',
  "fuelPriceUsdPerLiter" DOUBLE PRECISION,
  "fuelLitersEstimated" DOUBLE PRECISION,
  "reimbursementUsd" DOUBLE PRECISION,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "aiEstimateNotes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TaskMileageClaim_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "TaskMileageClaim_reportId_key" ON "TaskMileageClaim"("reportId");

ALTER TABLE "TaskActivityReport" ADD CONSTRAINT "TaskActivityReport_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TaskActivityReport" ADD CONSTRAINT "TaskActivityReport_taskId_fkey"
  FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TaskActivityReport" ADD CONSTRAINT "TaskActivityReport_authorId_fkey"
  FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TaskActivityReport" ADD CONSTRAINT "TaskActivityReport_reviewedById_fkey"
  FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TaskActivityReport" ADD CONSTRAINT "TaskActivityReport_budgetLineId_fkey"
  FOREIGN KEY ("budgetLineId") REFERENCES "BudgetLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TaskActivityReport" ADD CONSTRAINT "TaskActivityReport_transactionId_fkey"
  FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TaskMileageClaim" ADD CONSTRAINT "TaskMileageClaim_reportId_fkey"
  FOREIGN KEY ("reportId") REFERENCES "TaskActivityReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;
