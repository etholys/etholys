-- Tipos de unidad presupuestaria + dominios de reporte (manual)

ALTER TABLE "BudgetLine" ADD COLUMN IF NOT EXISTS "unitType" TEXT NOT NULL DEFAULT 'fixed';

UPDATE "BudgetLine"
SET "unitType" = 'percent_of_direct'
WHERE "isActive" = true
  AND (
    "category" = 'indirect'
    OR LOWER(COALESCE("unit", '')) LIKE '%percent%'
    OR COALESCE("unit", '') LIKE '%\%%'
  );

ALTER TABLE "ProjectReportGuide" ADD COLUMN IF NOT EXISTS "domain" TEXT NOT NULL DEFAULT 'general';

ALTER TABLE "MEReportPackage" ADD COLUMN IF NOT EXISTS "domain" TEXT NOT NULL DEFAULT 'me';
