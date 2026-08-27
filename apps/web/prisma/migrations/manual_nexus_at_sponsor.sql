-- NEXUS AT: cliente contratante (quem paga) ≠ empresas atendidas
-- Aplicar em prod antes / com o deploy do web.

ALTER TABLE "NexusAtEngagement"
  ADD COLUMN IF NOT EXISTS "sponsorCompanyId" TEXT;

CREATE INDEX IF NOT EXISTS "NexusAtEngagement_sponsorCompanyId_idx"
  ON "NexusAtEngagement"("sponsorCompanyId");

DO $$ BEGIN
  ALTER TABLE "NexusAtEngagement"
    ADD CONSTRAINT "NexusAtEngagement_sponsorCompanyId_fkey"
    FOREIGN KEY ("sponsorCompanyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
