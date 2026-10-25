-- Soft-archive for RADAR clients and properties (hide from active lists / selector).
ALTER TABLE "RadarClient" ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3);
ALTER TABLE "RadarProperty" ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "RadarClient_providerCompanyId_archivedAt_idx"
  ON "RadarClient"("providerCompanyId", "archivedAt");

CREATE INDEX IF NOT EXISTS "RadarProperty_companyId_archivedAt_idx"
  ON "RadarProperty"("companyId", "archivedAt");
