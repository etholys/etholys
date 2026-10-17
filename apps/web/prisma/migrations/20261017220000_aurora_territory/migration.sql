ALTER TABLE "RadarProperty" ADD COLUMN IF NOT EXISTS "polygonJson" JSONB;
ALTER TABLE "RadarProperty" ADD COLUMN IF NOT EXISTS "complianceJson" JSONB;
ALTER TABLE "AuroraFieldVisit" ADD COLUMN IF NOT EXISTS "indicatorValue" TEXT;

CREATE TABLE IF NOT EXISTS "AuroraDroneImage" (
    "id" TEXT NOT NULL,
    "operatorCompanyId" TEXT NOT NULL,
    "attendedCompanyId" TEXT NOT NULL,
    "engagementId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "authorUserId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "cloudStoragePath" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuroraDroneImage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "AuroraDroneImage_propertyId_createdAt_idx" ON "AuroraDroneImage"("propertyId", "createdAt");
CREATE INDEX IF NOT EXISTS "AuroraDroneImage_engagementId_idx" ON "AuroraDroneImage"("engagementId");

DO $$ BEGIN
  ALTER TABLE "AuroraDroneImage" ADD CONSTRAINT "AuroraDroneImage_operatorCompanyId_fkey" FOREIGN KEY ("operatorCompanyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "AuroraDroneImage" ADD CONSTRAINT "AuroraDroneImage_attendedCompanyId_fkey" FOREIGN KEY ("attendedCompanyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "AuroraDroneImage" ADD CONSTRAINT "AuroraDroneImage_engagementId_fkey" FOREIGN KEY ("engagementId") REFERENCES "NexusAtEngagement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "AuroraDroneImage" ADD CONSTRAINT "AuroraDroneImage_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "RadarProperty"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "AuroraDroneImage" ADD CONSTRAINT "AuroraDroneImage_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
