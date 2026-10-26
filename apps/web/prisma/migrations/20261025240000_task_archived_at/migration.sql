-- Soft-archive for Work/eTask — hide from active board; list in Archivo under ACL.
ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3);
ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "archivedById" TEXT;

CREATE INDEX IF NOT EXISTS "Task_companyId_archivedAt_idx" ON "Task"("companyId", "archivedAt");
CREATE INDEX IF NOT EXISTS "Task_archivedAt_idx" ON "Task"("archivedAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Task_archivedById_fkey'
  ) THEN
    ALTER TABLE "Task"
      ADD CONSTRAINT "Task_archivedById_fkey"
      FOREIGN KEY ("archivedById") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
