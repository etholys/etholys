-- SIEP Informe Editor: canvas state, period dates, SIEP_REPORT session kind

ALTER TABLE "MEReport" ADD COLUMN IF NOT EXISTS "canvasState" JSONB;
ALTER TABLE "MEReport" ADD COLUMN IF NOT EXISTS "canvasFormat" TEXT;
ALTER TABLE "MEReport" ADD COLUMN IF NOT EXISTS "aiSessionId" TEXT;
ALTER TABLE "MEReport" ADD COLUMN IF NOT EXISTS "periodStart" TIMESTAMP(3);
ALTER TABLE "MEReport" ADD COLUMN IF NOT EXISTS "periodEnd" TIMESTAMP(3);

ALTER TABLE "MEReportPackage" ADD COLUMN IF NOT EXISTS "periodStart" TIMESTAMP(3);
ALTER TABLE "MEReportPackage" ADD COLUMN IF NOT EXISTS "periodEnd" TIMESTAMP(3);

-- Add SIEP_REPORT to AiAdvisorSessionKind enum (PostgreSQL)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'AiAdvisorSessionKind' AND e.enumlabel = 'SIEP_REPORT'
  ) THEN
    ALTER TYPE "AiAdvisorSessionKind" ADD VALUE 'SIEP_REPORT';
  END IF;
END $$;
