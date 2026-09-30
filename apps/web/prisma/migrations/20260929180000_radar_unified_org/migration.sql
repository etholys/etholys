-- RADAR unified org: link AURORA company on clients + technicians
ALTER TABLE "RadarClient" ADD COLUMN IF NOT EXISTS "linkedCompanyId" TEXT;

CREATE INDEX IF NOT EXISTS "RadarClient_linkedCompanyId_idx" ON "RadarClient"("linkedCompanyId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'RadarClient_linkedCompanyId_fkey'
  ) THEN
    ALTER TABLE "RadarClient"
      ADD CONSTRAINT "RadarClient_linkedCompanyId_fkey"
      FOREIGN KEY ("linkedCompanyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "RadarTechnician" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "canSeeAll" BOOLEAN NOT NULL DEFAULT false,
    "canCreateClients" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RadarTechnician_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "RadarTechnician_companyId_userId_key" ON "RadarTechnician"("companyId", "userId");
CREATE INDEX IF NOT EXISTS "RadarTechnician_companyId_idx" ON "RadarTechnician"("companyId");

CREATE TABLE IF NOT EXISTS "RadarTechnicianScope" (
    "id" TEXT NOT NULL,
    "technicianId" TEXT NOT NULL,
    "clientId" TEXT,
    "propertyId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RadarTechnicianScope_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "RadarTechnicianScope_technicianId_idx" ON "RadarTechnicianScope"("technicianId");
CREATE INDEX IF NOT EXISTS "RadarTechnicianScope_clientId_idx" ON "RadarTechnicianScope"("clientId");
CREATE INDEX IF NOT EXISTS "RadarTechnicianScope_propertyId_idx" ON "RadarTechnicianScope"("propertyId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'RadarTechnician_companyId_fkey') THEN
    ALTER TABLE "RadarTechnician"
      ADD CONSTRAINT "RadarTechnician_companyId_fkey"
      FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'RadarTechnician_userId_fkey') THEN
    ALTER TABLE "RadarTechnician"
      ADD CONSTRAINT "RadarTechnician_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'RadarTechnicianScope_technicianId_fkey') THEN
    ALTER TABLE "RadarTechnicianScope"
      ADD CONSTRAINT "RadarTechnicianScope_technicianId_fkey"
      FOREIGN KEY ("technicianId") REFERENCES "RadarTechnician"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'RadarTechnicianScope_clientId_fkey') THEN
    ALTER TABLE "RadarTechnicianScope"
      ADD CONSTRAINT "RadarTechnicianScope_clientId_fkey"
      FOREIGN KEY ("clientId") REFERENCES "RadarClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'RadarTechnicianScope_propertyId_fkey') THEN
    ALTER TABLE "RadarTechnicianScope"
      ADD CONSTRAINT "RadarTechnicianScope_propertyId_fkey"
      FOREIGN KEY ("propertyId") REFERENCES "RadarProperty"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
