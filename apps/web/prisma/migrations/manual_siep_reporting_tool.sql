-- SIEP Reporting Tool (camada oficial de reporte, paralela ao logframe)
-- Safe additive migration for local / Contabo.

CREATE TABLE IF NOT EXISTS "ProjectReportingTool" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "version" TEXT,
  "sourceFileName" TEXT,
  "notes" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProjectReportingTool_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ProjectReportingToolLine" (
  "id" TEXT NOT NULL,
  "toolId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "order" INTEGER NOT NULL DEFAULT 0,
  "block" TEXT NOT NULL DEFAULT 'project_results',
  "resultContext" TEXT,
  "indicatorText" TEXT NOT NULL,
  "isDos" BOOLEAN NOT NULL DEFAULT false,
  "tag" TEXT NOT NULL,
  "baseline" TEXT,
  "target" TEXT,
  "linkedObjectiveId" TEXT,
  "notes" TEXT,
  "siepHint" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProjectReportingToolLine_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "ProjectReportingTool"
    ADD CONSTRAINT "ProjectReportingTool_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "ProjectReportingToolLine"
    ADD CONSTRAINT "ProjectReportingToolLine_toolId_fkey"
    FOREIGN KEY ("toolId") REFERENCES "ProjectReportingTool"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "ProjectReportingTool_projectId_idx" ON "ProjectReportingTool"("projectId");
CREATE INDEX IF NOT EXISTS "ProjectReportingToolLine_toolId_idx" ON "ProjectReportingToolLine"("toolId");
CREATE INDEX IF NOT EXISTS "ProjectReportingToolLine_projectId_idx" ON "ProjectReportingToolLine"("projectId");
CREATE INDEX IF NOT EXISTS "ProjectReportingToolLine_linkedObjectiveId_idx" ON "ProjectReportingToolLine"("linkedObjectiveId");
CREATE INDEX IF NOT EXISTS "ProjectReportingToolLine_projectId_tag_idx" ON "ProjectReportingToolLine"("projectId", "tag");
