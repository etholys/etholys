-- Etholys Meet — salas permanentes + recorrência
-- Aplicar em produção se prisma migrate não estiver disponível.

ALTER TABLE "MeetSession" ADD COLUMN IF NOT EXISTS "isPermanent" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "MeetSession" ADD COLUMN IF NOT EXISTS "recurrence" TEXT NOT NULL DEFAULT 'none';
ALTER TABLE "MeetSession" ADD COLUMN IF NOT EXISTS "recurrenceUntil" TIMESTAMP(3);
ALTER TABLE "MeetSession" ADD COLUMN IF NOT EXISTS "seriesId" TEXT;
ALTER TABLE "MeetSession" ADD COLUMN IF NOT EXISTS "seriesParentId" TEXT;

CREATE INDEX IF NOT EXISTS "MeetSession_seriesId_idx" ON "MeetSession"("seriesId");
CREATE INDEX IF NOT EXISTS "MeetSession_seriesParentId_idx" ON "MeetSession"("seriesParentId");
CREATE INDEX IF NOT EXISTS "MeetSession_companyId_isPermanent_idx" ON "MeetSession"("companyId", "isPermanent");

DO $$ BEGIN
  ALTER TABLE "MeetSession" ADD CONSTRAINT "MeetSession_seriesParentId_fkey"
    FOREIGN KEY ("seriesParentId") REFERENCES "MeetSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
