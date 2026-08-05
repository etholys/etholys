-- Etholys Studio shares / permissions — ADDITIVE (sem perda de dados)
-- Spec: docs/architecture/etholys-studio.md

ALTER TABLE "StudioFolder" ADD COLUMN IF NOT EXISTS "visibility" TEXT NOT NULL DEFAULT 'private';
ALTER TABLE "StudioDocument" ADD COLUMN IF NOT EXISTS "visibility" TEXT NOT NULL DEFAULT 'private';

-- Legado: nada passa a ser visível a toda a empresa.
-- Conteúdo existente fica PRIVADO (dono + convidados explícitos); partilha é sempre opt-in.
UPDATE "StudioFolder" SET "visibility" = 'private' WHERE "visibility" IS NULL OR "visibility" <> 'private';
UPDATE "StudioDocument" SET "visibility" = 'private' WHERE "visibility" IS NULL OR "visibility" <> 'private';

CREATE TABLE IF NOT EXISTS "StudioShare" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "targetType" TEXT NOT NULL,
  "folderId" TEXT,
  "documentId" TEXT,
  "role" TEXT NOT NULL DEFAULT 'viewer',
  "email" TEXT NOT NULL,
  "userId" TEXT,
  "accessMode" TEXT NOT NULL DEFAULT 'company_member',
  "token" TEXT NOT NULL,
  "magicLoginToken" TEXT,
  "magicLoginExpiresAt" TIMESTAMP(3),
  "status" TEXT NOT NULL DEFAULT 'active',
  "invitedById" TEXT,
  "acceptedAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StudioShare_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "StudioShare_token_key" ON "StudioShare"("token");
CREATE UNIQUE INDEX IF NOT EXISTS "StudioShare_magicLoginToken_key" ON "StudioShare"("magicLoginToken");
CREATE INDEX IF NOT EXISTS "StudioShare_companyId_idx" ON "StudioShare"("companyId");
CREATE INDEX IF NOT EXISTS "StudioShare_email_idx" ON "StudioShare"("email");
CREATE INDEX IF NOT EXISTS "StudioShare_userId_idx" ON "StudioShare"("userId");
CREATE INDEX IF NOT EXISTS "StudioShare_folderId_idx" ON "StudioShare"("folderId");
CREATE INDEX IF NOT EXISTS "StudioShare_documentId_idx" ON "StudioShare"("documentId");
CREATE INDEX IF NOT EXISTS "StudioShare_status_idx" ON "StudioShare"("status");

DO $$ BEGIN
  ALTER TABLE "StudioShare" ADD CONSTRAINT "StudioShare_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "StudioShare" ADD CONSTRAINT "StudioShare_folderId_fkey"
    FOREIGN KEY ("folderId") REFERENCES "StudioFolder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "StudioShare" ADD CONSTRAINT "StudioShare_documentId_fkey"
    FOREIGN KEY ("documentId") REFERENCES "StudioDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "StudioShare" ADD CONSTRAINT "StudioShare_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "StudioShare" ADD CONSTRAINT "StudioShare_invitedById_fkey"
    FOREIGN KEY ("invitedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
