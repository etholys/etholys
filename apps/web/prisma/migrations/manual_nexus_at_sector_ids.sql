-- Setores económicos múltiplos no programa AT
ALTER TABLE "NexusAtEngagement"
  ADD COLUMN IF NOT EXISTS "sectorIds" JSONB;
