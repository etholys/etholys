-- Agenda pública CHORUS (reservas)

CREATE TABLE IF NOT EXISTS "MeetBookingPage" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "publicCode" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "timeZone" TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
    "slotMinutes" INTEGER NOT NULL DEFAULT 30,
    "locationText" TEXT,
    "allowVirtual" BOOLEAN NOT NULL DEFAULT true,
    "allowInPerson" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MeetBookingPage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "MeetBookingPage_publicCode_key" ON "MeetBookingPage"("publicCode");
CREATE UNIQUE INDEX IF NOT EXISTS "MeetBookingPage_companyId_ownerId_key" ON "MeetBookingPage"("companyId", "ownerId");
CREATE INDEX IF NOT EXISTS "MeetBookingPage_companyId_idx" ON "MeetBookingPage"("companyId");
CREATE INDEX IF NOT EXISTS "MeetBookingPage_ownerId_idx" ON "MeetBookingPage"("ownerId");

CREATE TABLE IF NOT EXISTS "MeetBookingWindow" (
    "id" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "weekday" INTEGER NOT NULL,
    "startMin" INTEGER NOT NULL,
    "endMin" INTEGER NOT NULL,
    CONSTRAINT "MeetBookingWindow_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "MeetBookingWindow_pageId_weekday_idx" ON "MeetBookingWindow"("pageId", "weekday");

CREATE TABLE IF NOT EXISTS "MeetBookingBlock" (
    "id" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MeetBookingBlock_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "MeetBookingBlock_pageId_startsAt_idx" ON "MeetBookingBlock"("pageId", "startsAt");

CREATE TABLE IF NOT EXISTS "MeetBookingRequest" (
    "id" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "publicToken" TEXT NOT NULL,
    "bookerName" TEXT NOT NULL,
    "bookerEmail" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "proposedStartsAt" TIMESTAMP(3),
    "proposedEndsAt" TIMESTAMP(3),
    "locationText" TEXT,
    "note" TEXT,
    "meetSessionId" TEXT,
    "googleCalendarEventId" TEXT,
    "googleCalendarHtmlLink" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MeetBookingRequest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "MeetBookingRequest_publicToken_key" ON "MeetBookingRequest"("publicToken");
CREATE UNIQUE INDEX IF NOT EXISTS "MeetBookingRequest_meetSessionId_key" ON "MeetBookingRequest"("meetSessionId");
CREATE INDEX IF NOT EXISTS "MeetBookingRequest_pageId_startsAt_idx" ON "MeetBookingRequest"("pageId", "startsAt");
CREATE INDEX IF NOT EXISTS "MeetBookingRequest_companyId_status_idx" ON "MeetBookingRequest"("companyId", "status");
CREATE INDEX IF NOT EXISTS "MeetBookingRequest_bookerEmail_idx" ON "MeetBookingRequest"("bookerEmail");

CREATE TABLE IF NOT EXISTS "MeetBookingGuest" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT NOT NULL,
    CONSTRAINT "MeetBookingGuest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "MeetBookingGuest_requestId_idx" ON "MeetBookingGuest"("requestId");
CREATE INDEX IF NOT EXISTS "MeetBookingGuest_email_idx" ON "MeetBookingGuest"("email");

DO $$ BEGIN
  ALTER TABLE "MeetBookingPage" ADD CONSTRAINT "MeetBookingPage_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "MeetBookingPage" ADD CONSTRAINT "MeetBookingPage_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "MeetBookingWindow" ADD CONSTRAINT "MeetBookingWindow_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "MeetBookingPage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "MeetBookingBlock" ADD CONSTRAINT "MeetBookingBlock_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "MeetBookingPage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "MeetBookingRequest" ADD CONSTRAINT "MeetBookingRequest_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "MeetBookingPage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "MeetBookingRequest" ADD CONSTRAINT "MeetBookingRequest_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "MeetBookingRequest" ADD CONSTRAINT "MeetBookingRequest_meetSessionId_fkey" FOREIGN KEY ("meetSessionId") REFERENCES "MeetSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "MeetBookingGuest" ADD CONSTRAINT "MeetBookingGuest_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "MeetBookingRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
