-- Contabo / prod apply (idempotent): soft-archive columns for RADAR.
ALTER TABLE "RadarClient" ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3);
ALTER TABLE "RadarProperty" ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "RadarClient_providerCompanyId_archivedAt_idx"
  ON "RadarClient"("providerCompanyId", "archivedAt");

CREATE INDEX IF NOT EXISTS "RadarProperty_companyId_archivedAt_idx"
  ON "RadarProperty"("companyId", "archivedAt");
