-- ETHOLYS Lab ANVIL F2 — sandbox de ficheiros
-- Spec: docs/architecture/lab-anvil.md
-- Handoff MUSE (anvilProjectId): ver manual_muse_anvil_handoff.sql
-- Aplicar manualmente se prisma migrate não estiver disponível

CREATE TABLE IF NOT EXISTS "LabAnvilFile" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "path" TEXT NOT NULL,
  "contentText" TEXT,
  "storageKey" TEXT,
  "size" INTEGER NOT NULL DEFAULT 0,
  "sha256" TEXT,
  "mimeType" TEXT,
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LabAnvilFile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "LabAnvilFile_projectId_path_key" ON "LabAnvilFile"("projectId", "path");
CREATE INDEX IF NOT EXISTS "LabAnvilFile_projectId_idx" ON "LabAnvilFile"("projectId");

DO $$ BEGIN
  ALTER TABLE "LabAnvilFile" ADD CONSTRAINT "LabAnvilFile_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "LabAnvilProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
