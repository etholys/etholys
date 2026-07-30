-- Pré-comercial: convites por função (sistemas)
ALTER TABLE "Invitation" ADD COLUMN IF NOT EXISTS "systems" JSONB;
