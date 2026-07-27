-- ETHOLYS Lab ANVIL — aplicar manualmente se prisma migrate não estiver disponível
-- Spec: docs/architecture/lab-anvil.md

CREATE TABLE IF NOT EXISTS "LabAnvilProject" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "visibility" TEXT NOT NULL DEFAULT 'private',
  "relation" TEXT NOT NULL DEFAULT 'standalone',
  "workspaceKind" TEXT NOT NULL DEFAULT 'sandbox',
  "repoUrl" TEXT,
  "repoPath" TEXT,
  "defaultBranch" TEXT NOT NULL DEFAULT 'main',
  "allowedReuse" JSONB NOT NULL DEFAULT '[]',
  "parentProjectId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'active',
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LabAnvilProject_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "LabAnvilProject_slug_key" ON "LabAnvilProject"("slug");
CREATE INDEX IF NOT EXISTS "LabAnvilProject_status_idx" ON "LabAnvilProject"("status");
CREATE INDEX IF NOT EXISTS "LabAnvilProject_visibility_idx" ON "LabAnvilProject"("visibility");
CREATE INDEX IF NOT EXISTS "LabAnvilProject_relation_idx" ON "LabAnvilProject"("relation");
CREATE INDEX IF NOT EXISTS "LabAnvilProject_parentProjectId_idx" ON "LabAnvilProject"("parentProjectId");

CREATE TABLE IF NOT EXISTS "LabAnvilAgent" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "systemPromptExtra" TEXT,
  "memoryJson" JSONB,
  "status" TEXT NOT NULL DEFAULT 'idle',
  "lastRunAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LabAnvilAgent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "LabAnvilAgent_projectId_key" ON "LabAnvilAgent"("projectId");

CREATE TABLE IF NOT EXISTS "LabAnvilDeployTarget" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "configJson" JSONB,
  "status" TEXT NOT NULL DEFAULT 'idle',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LabAnvilDeployTarget_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "LabAnvilDeployTarget_projectId_idx" ON "LabAnvilDeployTarget"("projectId");

CREATE TABLE IF NOT EXISTS "LabAnvilMember" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "userId" TEXT,
  "role" TEXT NOT NULL DEFAULT 'member',
  "status" TEXT NOT NULL DEFAULT 'pending',
  "inviteCode" TEXT NOT NULL,
  "invitedById" TEXT,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LabAnvilMember_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "LabAnvilMember_inviteCode_key" ON "LabAnvilMember"("inviteCode");
CREATE INDEX IF NOT EXISTS "LabAnvilMember_email_idx" ON "LabAnvilMember"("email");
CREATE INDEX IF NOT EXISTS "LabAnvilMember_status_idx" ON "LabAnvilMember"("status");

CREATE TABLE IF NOT EXISTS "LabAnvilProjectMember" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "userId" TEXT,
  "role" TEXT NOT NULL DEFAULT 'collaborator',
  "status" TEXT NOT NULL DEFAULT 'pending',
  "invitedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LabAnvilProjectMember_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "LabAnvilProjectMember_projectId_email_key" ON "LabAnvilProjectMember"("projectId", "email");
CREATE INDEX IF NOT EXISTS "LabAnvilProjectMember_projectId_idx" ON "LabAnvilProjectMember"("projectId");
CREATE INDEX IF NOT EXISTS "LabAnvilProjectMember_userId_idx" ON "LabAnvilProjectMember"("userId");

CREATE TABLE IF NOT EXISTS "LabAnvilSession" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "createdById" TEXT,
  "title" TEXT,
  "status" TEXT NOT NULL DEFAULT 'open',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LabAnvilSession_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "LabAnvilSession_projectId_idx" ON "LabAnvilSession"("projectId");

CREATE TABLE IF NOT EXISTS "LabAnvilMessage" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "metaJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LabAnvilMessage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "LabAnvilMessage_sessionId_idx" ON "LabAnvilMessage"("sessionId");

-- FKs (idempotente parcial)
DO $$ BEGIN
  ALTER TABLE "LabAnvilProject" ADD CONSTRAINT "LabAnvilProject_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "LabAnvilProject" ADD CONSTRAINT "LabAnvilProject_parentProjectId_fkey"
    FOREIGN KEY ("parentProjectId") REFERENCES "LabAnvilProject"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "LabAnvilAgent" ADD CONSTRAINT "LabAnvilAgent_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "LabAnvilProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "LabAnvilDeployTarget" ADD CONSTRAINT "LabAnvilDeployTarget_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "LabAnvilProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "LabAnvilMember" ADD CONSTRAINT "LabAnvilMember_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "LabAnvilMember" ADD CONSTRAINT "LabAnvilMember_invitedById_fkey"
    FOREIGN KEY ("invitedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "LabAnvilProjectMember" ADD CONSTRAINT "LabAnvilProjectMember_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "LabAnvilProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "LabAnvilProjectMember" ADD CONSTRAINT "LabAnvilProjectMember_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "LabAnvilProjectMember" ADD CONSTRAINT "LabAnvilProjectMember_invitedById_fkey"
    FOREIGN KEY ("invitedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "LabAnvilSession" ADD CONSTRAINT "LabAnvilSession_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "LabAnvilProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "LabAnvilSession" ADD CONSTRAINT "LabAnvilSession_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "LabAnvilMessage" ADD CONSTRAINT "LabAnvilMessage_sessionId_fkey"
    FOREIGN KEY ("sessionId") REFERENCES "LabAnvilSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
