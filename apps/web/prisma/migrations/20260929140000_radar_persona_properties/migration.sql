-- RADAR persona + clients → properties hierarchy
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "radarOrgRole" TEXT;

ALTER TABLE "NexusOpsUnit" ADD COLUMN IF NOT EXISTS "propertyId" TEXT;

CREATE TABLE IF NOT EXISTS "RadarClient" (
    "id" TEXT NOT NULL,
    "providerCompanyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contactName" TEXT,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RadarClient_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "RadarClient_providerCompanyId_createdAt_idx"
  ON "RadarClient"("providerCompanyId", "createdAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'RadarClient_providerCompanyId_fkey'
  ) THEN
    ALTER TABLE "RadarClient"
      ADD CONSTRAINT "RadarClient_providerCompanyId_fkey"
      FOREIGN KEY ("providerCompanyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "RadarProperty" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "clientId" TEXT,
    "name" TEXT NOT NULL,
    "moduleId" TEXT,
    "crop" TEXT,
    "areaHa" DOUBLE PRECISION,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "layoutJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RadarProperty_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "RadarProperty_companyId_createdAt_idx"
  ON "RadarProperty"("companyId", "createdAt");

CREATE INDEX IF NOT EXISTS "RadarProperty_clientId_idx"
  ON "RadarProperty"("clientId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'RadarProperty_companyId_fkey'
  ) THEN
    ALTER TABLE "RadarProperty"
      ADD CONSTRAINT "RadarProperty_companyId_fkey"
      FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'RadarProperty_clientId_fkey'
  ) THEN
    ALTER TABLE "RadarProperty"
      ADD CONSTRAINT "RadarProperty_clientId_fkey"
      FOREIGN KEY ("clientId") REFERENCES "RadarClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "NexusOpsUnit_propertyId_idx" ON "NexusOpsUnit"("propertyId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'NexusOpsUnit_propertyId_fkey'
  ) THEN
    ALTER TABLE "NexusOpsUnit"
      ADD CONSTRAINT "NexusOpsUnit_propertyId_fkey"
      FOREIGN KEY ("propertyId") REFERENCES "RadarProperty"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
