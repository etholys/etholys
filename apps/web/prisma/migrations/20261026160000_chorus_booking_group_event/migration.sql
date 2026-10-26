-- Evento grupal / capacitação — inscrição no mesmo bloco (/a/e/{code})

CREATE TABLE IF NOT EXISTS "MeetBookingGroupEvent" (
    "id" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "publicCode" TEXT NOT NULL,
    "dayYmd" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "locationText" TEXT,
    "startMin" INTEGER NOT NULL,
    "endMin" INTEGER NOT NULL,
    "allowVirtual" BOOLEAN NOT NULL DEFAULT true,
    "allowInPerson" BOOLEAN NOT NULL DEFAULT true,
    "capacity" INTEGER,
    "forgeCourseId" TEXT,
    "projectId" TEXT,
    "meetSessionId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MeetBookingGroupEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "MeetBookingGroupEvent_publicCode_key" ON "MeetBookingGroupEvent"("publicCode");
CREATE INDEX IF NOT EXISTS "MeetBookingGroupEvent_pageId_dayYmd_idx" ON "MeetBookingGroupEvent"("pageId", "dayYmd");
CREATE INDEX IF NOT EXISTS "MeetBookingGroupEvent_pageId_active_idx" ON "MeetBookingGroupEvent"("pageId", "active");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'MeetBookingGroupEvent_pageId_fkey'
  ) THEN
    ALTER TABLE "MeetBookingGroupEvent"
      ADD CONSTRAINT "MeetBookingGroupEvent_pageId_fkey"
      FOREIGN KEY ("pageId") REFERENCES "MeetBookingPage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "MeetBookingGroupRegistration" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "publicToken" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "note" TEXT,
    "mode" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MeetBookingGroupRegistration_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "MeetBookingGroupRegistration_publicToken_key" ON "MeetBookingGroupRegistration"("publicToken");
CREATE UNIQUE INDEX IF NOT EXISTS "MeetBookingGroupRegistration_eventId_email_key" ON "MeetBookingGroupRegistration"("eventId", "email");
CREATE INDEX IF NOT EXISTS "MeetBookingGroupRegistration_eventId_idx" ON "MeetBookingGroupRegistration"("eventId");
CREATE INDEX IF NOT EXISTS "MeetBookingGroupRegistration_email_idx" ON "MeetBookingGroupRegistration"("email");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'MeetBookingGroupRegistration_eventId_fkey'
  ) THEN
    ALTER TABLE "MeetBookingGroupRegistration"
      ADD CONSTRAINT "MeetBookingGroupRegistration_eventId_fkey"
      FOREIGN KEY ("eventId") REFERENCES "MeetBookingGroupEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
