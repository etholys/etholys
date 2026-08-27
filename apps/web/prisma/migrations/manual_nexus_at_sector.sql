-- Setor económico principal do programa/contrato AT
ALTER TABLE "NexusAtEngagement"
  ADD COLUMN IF NOT EXISTS "primarySectorId" TEXT;

CREATE INDEX IF NOT EXISTS "NexusAtEngagement_primarySectorId_idx"
  ON "NexusAtEngagement"("primarySectorId");
