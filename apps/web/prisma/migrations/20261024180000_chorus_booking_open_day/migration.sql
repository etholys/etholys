-- Dia aberto partilhável da agenda CHORUS (/a/d/{code})

CREATE TABLE IF NOT EXISTS "MeetBookingOpenDay" (
    "id" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "publicCode" TEXT NOT NULL,
    "dayYmd" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "locationText" TEXT,
    "slotMinutes" INTEGER NOT NULL DEFAULT 30,
    "startMin" INTEGER NOT NULL,
    "endMin" INTEGER NOT NULL,
    "allowVirtual" BOOLEAN NOT NULL DEFAULT true,
    "allowInPerson" BOOLEAN NOT NULL DEFAULT true,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MeetBookingOpenDay_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "MeetBookingOpenDay_publicCode_key" ON "MeetBookingOpenDay"("publicCode");
CREATE INDEX IF NOT EXISTS "MeetBookingOpenDay_pageId_dayYmd_idx" ON "MeetBookingOpenDay"("pageId", "dayYmd");
CREATE INDEX IF NOT EXISTS "MeetBookingOpenDay_pageId_active_idx" ON "MeetBookingOpenDay"("pageId", "active");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'MeetBookingOpenDay_pageId_fkey'
  ) THEN
    ALTER TABLE "MeetBookingOpenDay"
      ADD CONSTRAINT "MeetBookingOpenDay_pageId_fkey"
      FOREIGN KEY ("pageId") REFERENCES "MeetBookingPage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

ALTER TABLE "MeetBookingRequest" ADD COLUMN IF NOT EXISTS "openDayId" TEXT;

CREATE INDEX IF NOT EXISTS "MeetBookingRequest_openDayId_idx" ON "MeetBookingRequest"("openDayId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'MeetBookingRequest_openDayId_fkey'
  ) THEN
    ALTER TABLE "MeetBookingRequest"
      ADD CONSTRAINT "MeetBookingRequest_openDayId_fkey"
      FOREIGN KEY ("openDayId") REFERENCES "MeetBookingOpenDay"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
