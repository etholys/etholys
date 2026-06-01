-- Turmas / grupos (empresa ou sessão) + salas de jogo por grupo

CREATE TABLE IF NOT EXISTS "ForgePlayGroup" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "liveSessionId" TEXT,
    "name" TEXT NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'live_team',
    "inviteToken" TEXT,
    "inviteExpiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ForgePlayGroup_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ForgePlayGroup_inviteToken_key" ON "ForgePlayGroup"("inviteToken");
CREATE INDEX IF NOT EXISTS "ForgePlayGroup_courseId_idx" ON "ForgePlayGroup"("courseId");
CREATE INDEX IF NOT EXISTS "ForgePlayGroup_liveSessionId_idx" ON "ForgePlayGroup"("liveSessionId");

DO $$ BEGIN
  ALTER TABLE "ForgePlayGroup" ADD CONSTRAINT "ForgePlayGroup_courseId_fkey"
    FOREIGN KEY ("courseId") REFERENCES "ForgeCourse"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "ForgePlayGroup" ADD CONSTRAINT "ForgePlayGroup_liveSessionId_fkey"
    FOREIGN KEY ("liveSessionId") REFERENCES "ForgeLiveSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "ForgeEnrollment" ADD COLUMN IF NOT EXISTS "playGroupId" TEXT;
CREATE INDEX IF NOT EXISTS "ForgeEnrollment_playGroupId_idx" ON "ForgeEnrollment"("playGroupId");

DO $$ BEGIN
  ALTER TABLE "ForgeEnrollment" ADD CONSTRAINT "ForgeEnrollment_playGroupId_fkey"
    FOREIGN KEY ("playGroupId") REFERENCES "ForgePlayGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "ForgeSharedGameRoom" ADD COLUMN IF NOT EXISTS "playGroupId" TEXT;
CREATE INDEX IF NOT EXISTS "ForgeSharedGameRoom_playGroupId_idx" ON "ForgeSharedGameRoom"("playGroupId");

DO $$ BEGIN
  ALTER TABLE "ForgeSharedGameRoom" ADD CONSTRAINT "ForgeSharedGameRoom_playGroupId_fkey"
    FOREIGN KEY ("playGroupId") REFERENCES "ForgePlayGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
