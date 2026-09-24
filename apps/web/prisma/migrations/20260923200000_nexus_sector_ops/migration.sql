-- CreateTable
CREATE TABLE IF NOT EXISTS "NexusDiagnosis" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "engagementId" TEXT,
    "sectorIds" JSONB NOT NULL,
    "overall" INTEGER NOT NULL DEFAULT 0,
    "scoresJson" JSONB NOT NULL,
    "answersJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "NexusDiagnosis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "NexusOpsUnit" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "sectorId" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'generic',
    "name" TEXT NOT NULL,
    "areaHa" DOUBLE PRECISION,
    "crop" TEXT,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "NexusOpsUnit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "NexusFieldEntry" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "unitId" TEXT,
    "kind" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "payloadJson" JSONB NOT NULL,
    "authorUserId" TEXT NOT NULL,
    "engagementId" TEXT,
    "taskId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "NexusFieldEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "NexusSensor" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "unitId" TEXT,
    "name" TEXT NOT NULL,
    "metric" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "lastSeenAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "NexusSensor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "NexusReading" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "sensorId" TEXT,
    "unitId" TEXT,
    "metric" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "NexusReading_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "NexusSensor_tokenHash_key" ON "NexusSensor"("tokenHash");

CREATE INDEX IF NOT EXISTS "NexusDiagnosis_companyId_createdAt_idx" ON "NexusDiagnosis"("companyId", "createdAt");
CREATE INDEX IF NOT EXISTS "NexusDiagnosis_engagementId_idx" ON "NexusDiagnosis"("engagementId");
CREATE INDEX IF NOT EXISTS "NexusDiagnosis_createdByUserId_idx" ON "NexusDiagnosis"("createdByUserId");

CREATE INDEX IF NOT EXISTS "NexusOpsUnit_companyId_isActive_idx" ON "NexusOpsUnit"("companyId", "isActive");
CREATE INDEX IF NOT EXISTS "NexusOpsUnit_companyId_sectorId_idx" ON "NexusOpsUnit"("companyId", "sectorId");

CREATE INDEX IF NOT EXISTS "NexusFieldEntry_companyId_occurredAt_idx" ON "NexusFieldEntry"("companyId", "occurredAt");
CREATE INDEX IF NOT EXISTS "NexusFieldEntry_unitId_occurredAt_idx" ON "NexusFieldEntry"("unitId", "occurredAt");
CREATE INDEX IF NOT EXISTS "NexusFieldEntry_engagementId_idx" ON "NexusFieldEntry"("engagementId");

CREATE INDEX IF NOT EXISTS "NexusSensor_companyId_isActive_idx" ON "NexusSensor"("companyId", "isActive");
CREATE INDEX IF NOT EXISTS "NexusSensor_unitId_idx" ON "NexusSensor"("unitId");

CREATE INDEX IF NOT EXISTS "NexusReading_companyId_recordedAt_idx" ON "NexusReading"("companyId", "recordedAt");
CREATE INDEX IF NOT EXISTS "NexusReading_sensorId_recordedAt_idx" ON "NexusReading"("sensorId", "recordedAt");
CREATE INDEX IF NOT EXISTS "NexusReading_unitId_recordedAt_idx" ON "NexusReading"("unitId", "recordedAt");

ALTER TABLE "NexusDiagnosis" ADD CONSTRAINT "NexusDiagnosis_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NexusDiagnosis" ADD CONSTRAINT "NexusDiagnosis_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "NexusOpsUnit" ADD CONSTRAINT "NexusOpsUnit_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "NexusFieldEntry" ADD CONSTRAINT "NexusFieldEntry_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NexusFieldEntry" ADD CONSTRAINT "NexusFieldEntry_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "NexusOpsUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "NexusFieldEntry" ADD CONSTRAINT "NexusFieldEntry_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "NexusSensor" ADD CONSTRAINT "NexusSensor_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NexusSensor" ADD CONSTRAINT "NexusSensor_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "NexusOpsUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "NexusReading" ADD CONSTRAINT "NexusReading_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NexusReading" ADD CONSTRAINT "NexusReading_sensorId_fkey" FOREIGN KEY ("sensorId") REFERENCES "NexusSensor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "NexusReading" ADD CONSTRAINT "NexusReading_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "NexusOpsUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;
