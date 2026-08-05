-- MUSE → ANVIL handoff — aplicar manualmente se prisma migrate não estiver disponível
-- Spec: docs/architecture/lab-muse.md F1

ALTER TABLE "MuseSuggestion"
  ADD COLUMN IF NOT EXISTS "anvilProjectId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "MuseSuggestion_anvilProjectId_key"
  ON "MuseSuggestion"("anvilProjectId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'MuseSuggestion_anvilProjectId_fkey'
  ) THEN
    ALTER TABLE "MuseSuggestion"
      ADD CONSTRAINT "MuseSuggestion_anvilProjectId_fkey"
      FOREIGN KEY ("anvilProjectId") REFERENCES "LabAnvilProject"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
