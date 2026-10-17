-- Visita de ATER com evidência de GPS, ligada ou não a um indicador de projeto.
CREATE TABLE "AuroraFieldVisit" (
    "id" TEXT NOT NULL,
    "operatorCompanyId" TEXT NOT NULL,
    "attendedCompanyId" TEXT NOT NULL,
    "engagementId" TEXT NOT NULL,
    "propertyId" TEXT,
    "authorUserId" TEXT NOT NULL,
    "siepProjectId" TEXT,
    "objectiveId" TEXT,
    "activityLabel" TEXT NOT NULL,
    "whatDone" TEXT NOT NULL DEFAULT '',
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "accuracyM" DOUBLE PRECISION,
    "distanceM" DOUBLE PRECISION,
    "onSite" BOOLEAN NOT NULL DEFAULT false,
    "photoData" TEXT,
    "polygonJson" JSONB,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuroraFieldVisit_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AuroraFieldVisit_attendedCompanyId_occurredAt_idx" ON "AuroraFieldVisit"("attendedCompanyId", "occurredAt");
CREATE INDEX "AuroraFieldVisit_engagementId_occurredAt_idx" ON "AuroraFieldVisit"("engagementId", "occurredAt");
CREATE INDEX "AuroraFieldVisit_siepProjectId_idx" ON "AuroraFieldVisit"("siepProjectId");
CREATE INDEX "AuroraFieldVisit_objectiveId_idx" ON "AuroraFieldVisit"("objectiveId");

ALTER TABLE "AuroraFieldVisit" ADD CONSTRAINT "AuroraFieldVisit_operatorCompanyId_fkey" FOREIGN KEY ("operatorCompanyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AuroraFieldVisit" ADD CONSTRAINT "AuroraFieldVisit_attendedCompanyId_fkey" FOREIGN KEY ("attendedCompanyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AuroraFieldVisit" ADD CONSTRAINT "AuroraFieldVisit_engagementId_fkey" FOREIGN KEY ("engagementId") REFERENCES "NexusAtEngagement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AuroraFieldVisit" ADD CONSTRAINT "AuroraFieldVisit_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "RadarProperty"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AuroraFieldVisit" ADD CONSTRAINT "AuroraFieldVisit_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AuroraFieldVisit" ADD CONSTRAINT "AuroraFieldVisit_siepProjectId_fkey" FOREIGN KEY ("siepProjectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AuroraFieldVisit" ADD CONSTRAINT "AuroraFieldVisit_objectiveId_fkey" FOREIGN KEY ("objectiveId") REFERENCES "Objective"("id") ON DELETE SET NULL ON UPDATE CASCADE;
