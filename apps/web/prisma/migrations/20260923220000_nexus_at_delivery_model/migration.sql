-- Modalidade de prestação AT no contrato (permanente / multi / collective)
ALTER TABLE "NexusAtEngagement"
  ADD COLUMN IF NOT EXISTS "deliveryModel" TEXT NOT NULL DEFAULT 'MULTI';
