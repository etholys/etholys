-- Avances periódicos por línea de Reporting Tool
CREATE TABLE IF NOT EXISTS "ProjectReportingToolProgress" (
  "id" TEXT NOT NULL,
  "lineId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "periodLabel" TEXT NOT NULL,
  "periodStart" TIMESTAMP(3),
  "periodEnd" TIMESTAMP(3),
  "cumulativeBefore" TEXT,
  "progressDuring" TEXT,
  "totalCumulative" TEXT,
  "status" TEXT NOT NULL DEFAULT 'Not started',
  "comments" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProjectReportingToolProgress_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "ProjectReportingToolProgress"
    ADD CONSTRAINT "ProjectReportingToolProgress_lineId_fkey"
    FOREIGN KEY ("lineId") REFERENCES "ProjectReportingToolLine"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "ProjectReportingToolProgress_lineId_idx" ON "ProjectReportingToolProgress"("lineId");
CREATE INDEX IF NOT EXISTS "ProjectReportingToolProgress_projectId_idx" ON "ProjectReportingToolProgress"("projectId");
CREATE INDEX IF NOT EXISTS "ProjectReportingToolProgress_lineId_createdAt_idx" ON "ProjectReportingToolProgress"("lineId", "createdAt");
