-- Operative RADAR field tasks (status + progress), separate from eTask/Work.
CREATE TABLE IF NOT EXISTS "RadarTask" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "propertyId" TEXT,
    "unitId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'todo',
    "severity" TEXT NOT NULL DEFAULT 'info',
    "sourceKey" TEXT,
    "dueAt" TIMESTAMP(3),
    "progressJson" JSONB,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RadarTask_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "RadarTask_companyId_sourceKey_key"
  ON "RadarTask"("companyId", "sourceKey");

CREATE INDEX IF NOT EXISTS "RadarTask_companyId_status_archivedAt_idx"
  ON "RadarTask"("companyId", "status", "archivedAt");

CREATE INDEX IF NOT EXISTS "RadarTask_companyId_unitId_idx"
  ON "RadarTask"("companyId", "unitId");

CREATE INDEX IF NOT EXISTS "RadarTask_companyId_propertyId_idx"
  ON "RadarTask"("companyId", "propertyId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'RadarTask_companyId_fkey'
  ) THEN
    ALTER TABLE "RadarTask"
      ADD CONSTRAINT "RadarTask_companyId_fkey"
      FOREIGN KEY ("companyId") REFERENCES "Company"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
