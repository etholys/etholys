-- Etholys Studio (ferramenta transversal) � aplicar manualmente se prisma migrate n�o estiver dispon�vel
-- Spec: docs/architecture/etholys-studio.md

DO $$ BEGIN
  ALTER TYPE "AiAdvisorSessionKind" ADD VALUE IF NOT EXISTS 'STUDIO_DOC';
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "StudioFolder" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "parentId" TEXT,
  "name" TEXT NOT NULL,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StudioFolder_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "StudioFolder_companyId_idx" ON "StudioFolder"("companyId");
CREATE INDEX IF NOT EXISTS "StudioFolder_parentId_idx" ON "StudioFolder"("parentId");

CREATE TABLE IF NOT EXISTS "StudioDocument" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "folderId" TEXT,
  "title" TEXT NOT NULL,
  "format" TEXT NOT NULL DEFAULT 'report',
  "status" TEXT NOT NULL DEFAULT 'draft',
  "canvasState" JSONB NOT NULL,
  "brandKitJson" JSONB,
  "templateKey" TEXT,
  "aiSessionId" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StudioDocument_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "StudioDocument_companyId_idx" ON "StudioDocument"("companyId");
CREATE INDEX IF NOT EXISTS "StudioDocument_folderId_idx" ON "StudioDocument"("folderId");
CREATE INDEX IF NOT EXISTS "StudioDocument_companyId_updatedAt_idx" ON "StudioDocument"("companyId", "updatedAt");

CREATE TABLE IF NOT EXISTS "StudioTemplate" (
  "id" TEXT NOT NULL,
  "companyId" TEXT,
  "key" TEXT NOT NULL,
  "nameEs" TEXT NOT NULL,
  "namePt" TEXT NOT NULL,
  "nameEn" TEXT NOT NULL,
  "descriptionEs" TEXT,
  "descriptionPt" TEXT,
  "descriptionEn" TEXT,
  "format" TEXT NOT NULL DEFAULT 'report',
  "canvasSeed" JSONB NOT NULL,
  "isSystem" BOOLEAN NOT NULL DEFAULT false,
  "sortOrder" INT NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StudioTemplate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "StudioTemplate_companyId_key_key" ON "StudioTemplate"("companyId", "key");
CREATE INDEX IF NOT EXISTS "StudioTemplate_companyId_idx" ON "StudioTemplate"("companyId");
CREATE INDEX IF NOT EXISTS "StudioTemplate_isSystem_sortOrder_idx" ON "StudioTemplate"("isSystem", "sortOrder");

DO $$ BEGIN
  ALTER TABLE "StudioFolder" ADD CONSTRAINT "StudioFolder_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "StudioFolder" ADD CONSTRAINT "StudioFolder_parentId_fkey"
    FOREIGN KEY ("parentId") REFERENCES "StudioFolder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "StudioFolder" ADD CONSTRAINT "StudioFolder_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "StudioDocument" ADD CONSTRAINT "StudioDocument_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "StudioDocument" ADD CONSTRAINT "StudioDocument_folderId_fkey"
    FOREIGN KEY ("folderId") REFERENCES "StudioFolder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "StudioDocument" ADD CONSTRAINT "StudioDocument_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "StudioTemplate" ADD CONSTRAINT "StudioTemplate_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Contexto IA (pastas + documentos) � additive
CREATE TABLE IF NOT EXISTS "StudioContextAsset" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "scope" TEXT NOT NULL,
  "folderId" TEXT,
  "documentId" TEXT,
  "name" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "sizeBytes" INT NOT NULL DEFAULT 0,
  "storagePath" TEXT NOT NULL,
  "extractedText" TEXT,
  "label" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StudioContextAsset_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "StudioContextAsset_companyId_idx" ON "StudioContextAsset"("companyId");
CREATE INDEX IF NOT EXISTS "StudioContextAsset_folderId_idx" ON "StudioContextAsset"("folderId");
CREATE INDEX IF NOT EXISTS "StudioContextAsset_documentId_idx" ON "StudioContextAsset"("documentId");
CREATE INDEX IF NOT EXISTS "StudioContextAsset_scope_idx" ON "StudioContextAsset"("scope");

DO $$ BEGIN
  ALTER TABLE "StudioContextAsset" ADD CONSTRAINT "StudioContextAsset_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "StudioContextAsset" ADD CONSTRAINT "StudioContextAsset_folderId_fkey"
    FOREIGN KEY ("folderId") REFERENCES "StudioFolder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "StudioContextAsset" ADD CONSTRAINT "StudioContextAsset_documentId_fkey"
    FOREIGN KEY ("documentId") REFERENCES "StudioDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "StudioContextAsset" ADD CONSTRAINT "StudioContextAsset_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "StudioDocumentVersion" (
  "id" TEXT NOT NULL,
  "documentId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "canvasState" JSONB NOT NULL,
  "label" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StudioDocumentVersion_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "StudioDocumentVersion_documentId_createdAt_idx" ON "StudioDocumentVersion"("documentId", "createdAt");

CREATE TABLE IF NOT EXISTS "StudioPageMold" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "pageSize" TEXT NOT NULL DEFAULT 'A4',
  "imagePath" TEXT NOT NULL,
  "notes" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StudioPageMold_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "StudioPageMold_companyId_idx" ON "StudioPageMold"("companyId");

DO $$ BEGIN
  ALTER TABLE "StudioDocumentVersion" ADD CONSTRAINT "StudioDocumentVersion_documentId_fkey"
    FOREIGN KEY ("documentId") REFERENCES "StudioDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "StudioDocumentVersion" ADD CONSTRAINT "StudioDocumentVersion_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "StudioPageMold" ADD CONSTRAINT "StudioPageMold_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "StudioPageMold" ADD CONSTRAINT "StudioPageMold_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Rastreabilidade: �ltimo editor + trilha de atividade (IA + edi��es)
DO $$ BEGIN
  ALTER TABLE "StudioDocument" ADD COLUMN "updatedById" TEXT;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "StudioDocument_updatedById_idx" ON "StudioDocument"("updatedById");

DO $$ BEGIN
  ALTER TABLE "StudioDocument" ADD CONSTRAINT "StudioDocument_updatedById_fkey"
    FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "StudioDocumentActivity" (
  "id" TEXT NOT NULL,
  "documentId" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "meta" JSONB,
  "actorUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StudioDocumentActivity_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "StudioDocumentActivity_documentId_createdAt_idx"
  ON "StudioDocumentActivity"("documentId", "createdAt");
CREATE INDEX IF NOT EXISTS "StudioDocumentActivity_companyId_createdAt_idx"
  ON "StudioDocumentActivity"("companyId", "createdAt");
CREATE INDEX IF NOT EXISTS "StudioDocumentActivity_actorUserId_idx"
  ON "StudioDocumentActivity"("actorUserId");

DO $$ BEGIN
  ALTER TABLE "StudioDocumentActivity" ADD CONSTRAINT "StudioDocumentActivity_documentId_fkey"
    FOREIGN KEY ("documentId") REFERENCES "StudioDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "StudioDocumentActivity" ADD CONSTRAINT "StudioDocumentActivity_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "StudioDocumentActivity" ADD CONSTRAINT "StudioDocumentActivity_actorUserId_fkey"
    FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Coment�rios colaborativos (F4)
CREATE TABLE IF NOT EXISTS "StudioDocumentComment" (
  "id" TEXT NOT NULL,
  "documentId" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "blockId" TEXT,
  "body" TEXT NOT NULL,
  "authorId" TEXT,
  "resolvedAt" TIMESTAMP(3),
  "resolvedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StudioDocumentComment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "StudioDocumentComment_documentId_createdAt_idx"
  ON "StudioDocumentComment"("documentId", "createdAt");
CREATE INDEX IF NOT EXISTS "StudioDocumentComment_documentId_resolvedAt_idx"
  ON "StudioDocumentComment"("documentId", "resolvedAt");
CREATE INDEX IF NOT EXISTS "StudioDocumentComment_companyId_idx"
  ON "StudioDocumentComment"("companyId");
CREATE INDEX IF NOT EXISTS "StudioDocumentComment_authorId_idx"
  ON "StudioDocumentComment"("authorId");

DO $$ BEGIN
  ALTER TABLE "StudioDocumentComment" ADD CONSTRAINT "StudioDocumentComment_documentId_fkey"
    FOREIGN KEY ("documentId") REFERENCES "StudioDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "StudioDocumentComment" ADD CONSTRAINT "StudioDocumentComment_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "StudioDocumentComment" ADD CONSTRAINT "StudioDocumentComment_authorId_fkey"
    FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "StudioDocumentComment" ADD CONSTRAINT "StudioDocumentComment_resolvedById_fkey"
    FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Presen�a colaborativa (F5) � heartbeat
CREATE TABLE IF NOT EXISTS "StudioDocumentPresence" (
  "id" TEXT NOT NULL,
  "documentId" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'viewing',
  "clientId" TEXT NOT NULL,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StudioDocumentPresence_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "StudioDocumentPresence_documentId_userId_clientId_key"
  ON "StudioDocumentPresence"("documentId", "userId", "clientId");
CREATE INDEX IF NOT EXISTS "StudioDocumentPresence_documentId_lastSeenAt_idx"
  ON "StudioDocumentPresence"("documentId", "lastSeenAt");
CREATE INDEX IF NOT EXISTS "StudioDocumentPresence_companyId_idx"
  ON "StudioDocumentPresence"("companyId");

DO $$ BEGIN
  ALTER TABLE "StudioDocumentPresence" ADD CONSTRAINT "StudioDocumentPresence_documentId_fkey"
    FOREIGN KEY ("documentId") REFERENCES "StudioDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "StudioDocumentPresence" ADD CONSTRAINT "StudioDocumentPresence_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "StudioDocumentPresence" ADD CONSTRAINT "StudioDocumentPresence_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
