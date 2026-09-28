-- CreateTable
CREATE TABLE IF NOT EXISTS "RadarLot" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "publicToken" TEXT NOT NULL,
    "unitId" TEXT,
    "crop" TEXT,
    "qty" DOUBLE PRECISION,
    "unitLabel" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "currentStage" TEXT NOT NULL DEFAULT 'harvest',
    "harvestEntryId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RadarLot_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "RadarLot_publicToken_key" ON "RadarLot"("publicToken");
CREATE UNIQUE INDEX IF NOT EXISTS "RadarLot_companyId_code_key" ON "RadarLot"("companyId", "code");
CREATE INDEX IF NOT EXISTS "RadarLot_companyId_createdAt_idx" ON "RadarLot"("companyId", "createdAt");
CREATE INDEX IF NOT EXISTS "RadarLot_companyId_status_idx" ON "RadarLot"("companyId", "status");

-- CreateTable
CREATE TABLE IF NOT EXISTS "RadarLotEvent" (
    "id" TEXT NOT NULL,
    "lotId" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "payloadJson" JSONB NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'app',
    "authorUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RadarLotEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "RadarLotEvent_lotId_occurredAt_idx" ON "RadarLotEvent"("lotId", "occurredAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'RadarLot_companyId_fkey'
  ) THEN
    ALTER TABLE "RadarLot"
      ADD CONSTRAINT "RadarLot_companyId_fkey"
      FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'RadarLot_unitId_fkey'
  ) THEN
    ALTER TABLE "RadarLot"
      ADD CONSTRAINT "RadarLot_unitId_fkey"
      FOREIGN KEY ("unitId") REFERENCES "NexusOpsUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'RadarLotEvent_lotId_fkey'
  ) THEN
    ALTER TABLE "RadarLotEvent"
      ADD CONSTRAINT "RadarLotEvent_lotId_fkey"
      FOREIGN KEY ("lotId") REFERENCES "RadarLot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'RadarLotEvent_authorUserId_fkey'
  ) THEN
    ALTER TABLE "RadarLotEvent"
      ADD CONSTRAINT "RadarLotEvent_authorUserId_fkey"
      FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
