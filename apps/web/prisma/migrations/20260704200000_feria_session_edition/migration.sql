-- Vincular sessão feira/kiosk à turma (edição)

ALTER TABLE "ForgeFeriaSession" ADD COLUMN IF NOT EXISTS "editionId" TEXT;

CREATE INDEX IF NOT EXISTS "ForgeFeriaSession_editionId_idx" ON "ForgeFeriaSession"("editionId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ForgeFeriaSession_editionId_fkey'
  ) THEN
    ALTER TABLE "ForgeFeriaSession"
      ADD CONSTRAINT "ForgeFeriaSession_editionId_fkey"
      FOREIGN KEY ("editionId") REFERENCES "ForgeCourseEdition"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
