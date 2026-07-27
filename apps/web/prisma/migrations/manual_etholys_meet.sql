-- Etholys Meet (transversal) — aplicar manualmente se prisma migrate não estiver disponível
-- Spec: docs/architecture/etholys-meet.md

CREATE TABLE IF NOT EXISTS "MeetSession" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "createdById" TEXT,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "mirror" TEXT NOT NULL DEFAULT 'loose',
  "status" TEXT NOT NULL DEFAULT 'scheduled',
  "scheduledAt" TIMESTAMP(3),
  "endsAt" TIMESTAMP(3),
  "startedAt" TIMESTAMP(3),
  "endedAt" TIMESTAMP(3),
  "roomSlug" TEXT NOT NULL,
  "meetingUrl" TEXT,
  "recordingUrl" TEXT,
  "transcriptText" TEXT,
  "summaryText" TEXT,
  "projectId" TEXT,
  "forgeLiveSessionId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MeetSession_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "MeetSession_roomSlug_key" ON "MeetSession"("roomSlug");
CREATE INDEX IF NOT EXISTS "MeetSession_companyId_scheduledAt_idx" ON "MeetSession"("companyId", "scheduledAt");
CREATE INDEX IF NOT EXISTS "MeetSession_projectId_idx" ON "MeetSession"("projectId");
CREATE INDEX IF NOT EXISTS "MeetSession_forgeLiveSessionId_idx" ON "MeetSession"("forgeLiveSessionId");
CREATE INDEX IF NOT EXISTS "MeetSession_status_idx" ON "MeetSession"("status");

CREATE TABLE IF NOT EXISTS "MeetParticipant" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "userId" TEXT,
  "email" TEXT,
  "displayName" TEXT,
  "role" TEXT NOT NULL DEFAULT 'guest',
  "invitedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "joinedAt" TIMESTAMP(3),
  "leftAt" TIMESTAMP(3),
  CONSTRAINT "MeetParticipant_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "MeetParticipant_sessionId_idx" ON "MeetParticipant"("sessionId");
CREATE INDEX IF NOT EXISTS "MeetParticipant_userId_idx" ON "MeetParticipant"("userId");
CREATE INDEX IF NOT EXISTS "MeetParticipant_email_idx" ON "MeetParticipant"("email");

CREATE TABLE IF NOT EXISTS "MeetActionItem" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "notes" TEXT,
  "assigneeHint" TEXT,
  "dueHint" TIMESTAMP(3),
  "status" TEXT NOT NULL DEFAULT 'draft',
  "taskId" TEXT,
  "sortOrder" INT NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MeetActionItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "MeetActionItem_sessionId_idx" ON "MeetActionItem"("sessionId");
CREATE INDEX IF NOT EXISTS "MeetActionItem_status_idx" ON "MeetActionItem"("status");
CREATE INDEX IF NOT EXISTS "MeetActionItem_taskId_idx" ON "MeetActionItem"("taskId");

DO $$ BEGIN
  ALTER TABLE "MeetSession" ADD CONSTRAINT "MeetSession_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "MeetSession" ADD CONSTRAINT "MeetSession_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "MeetSession" ADD CONSTRAINT "MeetSession_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "MeetSession" ADD CONSTRAINT "MeetSession_forgeLiveSessionId_fkey"
    FOREIGN KEY ("forgeLiveSessionId") REFERENCES "ForgeLiveSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "MeetParticipant" ADD CONSTRAINT "MeetParticipant_sessionId_fkey"
    FOREIGN KEY ("sessionId") REFERENCES "MeetSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "MeetParticipant" ADD CONSTRAINT "MeetParticipant_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "MeetActionItem" ADD CONSTRAINT "MeetActionItem_sessionId_fkey"
    FOREIGN KEY ("sessionId") REFERENCES "MeetSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "MeetActionItem" ADD CONSTRAINT "MeetActionItem_taskId_fkey"
    FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
