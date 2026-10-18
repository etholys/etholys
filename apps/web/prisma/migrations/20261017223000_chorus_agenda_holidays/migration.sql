-- Feriados públicos e origem dos bloqueios da agenda CHORUS

ALTER TABLE "MeetBookingPage"
  ADD COLUMN IF NOT EXISTS "holidayCountries" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

ALTER TABLE "MeetBookingBlock"
  ADD COLUMN IF NOT EXISTS "source" TEXT NOT NULL DEFAULT 'manual';

ALTER TABLE "MeetBookingBlock"
  ADD COLUMN IF NOT EXISTS "label" TEXT;
